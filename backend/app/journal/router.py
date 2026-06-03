"""
Catalyst Forge — Journal Router
Handles video/audio/text journal entries and transcription.
"""
from typing import Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status, BackgroundTasks
from pydantic import BaseModel, Field
from supabase import AsyncClient
from enum import Enum

from app.dependencies import get_current_user, get_authenticated_client, get_supabase_admin
from app.config import get_settings, Settings
from app.journal.transcription import transcribe_with_gemini
from app.notifications.push import save_notification_to_history
from app.notifications import templates as nt

router = APIRouter()


class JournalType(str, Enum):
    video = "video"
    audio = "audio"
    text = "text"


class JournalCreate(BaseModel):
    habit_id: Optional[UUID] = None
    entry_type: JournalType
    raw_text: Optional[str] = None
    media_url: Optional[str] = None
    media_duration_seconds: Optional[int] = None
    media_size_bytes: Optional[int] = None
    mood_rating: Optional[int] = Field(None, ge=1, le=10)
    energy_level: Optional[int] = Field(None, ge=1, le=10)


class JournalResponse(BaseModel):
    id: UUID
    user_id: UUID
    habit_id: Optional[UUID] = None
    entry_type: JournalType
    media_url: Optional[str] = None
    media_duration_seconds: Optional[int] = None
    raw_text: Optional[str] = None
    transcript: Optional[str] = None
    detected_emotions: Optional[dict] = None
    emotional_intensity: Optional[int] = None
    key_themes: Optional[list[str]] = None
    mood_rating: Optional[int] = None
    energy_level: Optional[int] = None
    transcription_status: Optional[str] = "completed"
    analysis_status: Optional[str] = "pending"
    created_at: datetime


@router.post("/upload/")
async def upload_media(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    admin_client: AsyncClient = Depends(get_supabase_admin),
):
    """Upload a video or audio file to Supabase Storage."""
    # Validate file type
    allowed_types = ["video/webm", "video/mp4", "audio/webm", "audio/mp4", "audio/mpeg", "audio/wav"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type {file.content_type} not allowed. Allowed: {allowed_types}"
        )

    # Max 50MB
    contents = await file.read()
    if len(contents) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    # Upload to Supabase Storage
    file_ext = file.filename.split(".")[-1] if file.filename else "webm"
    storage_path = f"{user.id}/{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{file_ext}"

    response = await (
        admin_client.storage
        .from_("journal-media")
        .upload(storage_path, contents, {"content-type": file.content_type})
    )

    # Get public URL
    public_url = await admin_client.storage.from_("journal-media").get_public_url(storage_path)

    return {
        "media_url": public_url,
        "storage_path": storage_path,
        "size_bytes": len(contents),
        "content_type": file.content_type,
    }


@router.post("/", response_model=JournalResponse, status_code=status.HTTP_201_CREATED)
async def create_journal_entry(
    data: JournalCreate,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
    admin_client: AsyncClient = Depends(get_supabase_admin),
    settings: Settings = Depends(get_settings),
):
    """Create a journal entry (text, or after media upload)."""
    # Only map fields that actually exist in the remote Supabase DB
    entry_data = {
        "user_id": str(user.id),
        "entry_type": data.entry_type.value,
    }
    
    if data.habit_id:
        entry_data["habit_id"] = str(data.habit_id)
    if data.mood_rating is not None:
        entry_data["mood_rating"] = data.mood_rating
    if data.energy_level is not None:
        entry_data["energy_level"] = data.energy_level
    if data.raw_text:
        entry_data["raw_text"] = data.raw_text
    if data.media_url:
        entry_data["media_url"] = data.media_url
    if data.media_duration_seconds is not None:
        entry_data["media_duration_seconds"] = data.media_duration_seconds

    # Set initial statuses
    if data.entry_type == JournalType.text:
        entry_data["transcription_status"] = "completed"
    else:
        entry_data["transcription_status"] = "pending"

    print(f"[DEBUG] Creating entry type={data.entry_type}, raw_text_len={len(data.raw_text) if data.raw_text else 0}")
    try:
        response = await admin_client.table("journal_entries").insert(entry_data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create journal entry (no data returned)")
    except Exception as e:
        import traceback
        err_msg = "".join(traceback.format_exception(type(e), e, e.__traceback__))
        print(f"DATABASE INSERT ERROR: {err_msg}")
        raise HTTPException(status_code=500, detail=f"DB Error: {str(e)}")

    try:
        user_lang = await nt.get_user_lang(admin_client, str(user.id))
        if user_lang == "uk":
            title = "Журнал прийнято — аналізуємо"
            body = "AI розбирає емоції, теми й сигнали з твого запису."
        else:
            title = "Journal received — analyzing"
            body = "AI is reading the emotions, themes, and signals in your entry."
        await save_notification_to_history(
            client=admin_client,
            user_id=str(user.id),
            title=title,
            body=body,
            notification_type="journal_processing",
            url="/journal/notifications",
            metadata={"journal_entry_id": str(response.data[0]["id"])},
        )
    except Exception as e:
        print(f"[WARN] Failed to save journal processing notification: {e}")

    # Trigger async analysis for all types if content is available
    print(f"[DEBUG] Triggering AI check. Type={data.entry_type}, has_text={bool(data.raw_text)}")
    if data.entry_type == JournalType.text and data.raw_text:
        print(f"[DEBUG] Adding background task for TEXT entry: {response.data[0]['id']}")
        background_tasks.add_task(
            transcribe_with_gemini,
            settings=settings,
            db_client=admin_client,
            entry_id=str(response.data[0]["id"]),
            media_url=None,
            media_type=data.entry_type.value,
            raw_text=data.raw_text,
        )
    elif data.entry_type in [JournalType.audio, JournalType.video] and data.media_url:
        background_tasks.add_task(
            transcribe_with_gemini,
            settings=settings,
            db_client=admin_client,
            entry_id=str(response.data[0]["id"]),
            media_url=data.media_url,
            media_type=data.entry_type.value,
        )

    return response.data[0]


@router.get("/")
async def list_journal_entries(
    habit_id: Optional[UUID] = None,
    sort: str = Query("desc", regex="^(asc|desc)$"),
    limit: int = Query(20, le=50),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
    admin_client: AsyncClient = Depends(get_supabase_admin),
):
    """List journal entries (paginated)."""
    query = (
        admin_client.table("journal_entries")
        .select("*")
        .eq("user_id", str(user.id))
        .order("created_at", desc=(sort == "desc"))
        .range(offset, offset + limit - 1)
    )

    if habit_id:
        query = query.eq("habit_id", str(habit_id))

    response = await query.execute()
    return {"entries": response.data, "total": len(response.data)}


@router.get("/{entry_id}/", response_model=JournalResponse)
async def get_journal_entry(
    entry_id: UUID,
    user=Depends(get_current_user),
    admin_client: AsyncClient = Depends(get_supabase_admin),
):
    """Get a single journal entry with transcript and analysis."""
    response = await (
        admin_client.table("journal_entries")
        .select("*")
        .eq("id", str(entry_id))
        .eq("user_id", str(user.id))
        .maybe_single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return response.data


@router.delete("/{entry_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_journal_entry(
    entry_id: UUID,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
    admin_client: AsyncClient = Depends(get_supabase_admin),
):
    """Delete a journal entry and its media."""
    # Get entry to find media path (using admin_client to avoid RLS select issues)
    entry = await (
        admin_client.table("journal_entries")
        .select("media_url")
        .eq("id", str(entry_id))
        .eq("user_id", str(user.id))
        .maybe_single()
        .execute()
    )

    if not entry.data:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    # Delete from storage if media exists
    if entry.data.get("media_url"):
        try:
            storage_path = entry.data["media_url"].split("/journal-media/")[-1]
            await admin_client.storage.from_("journal-media").remove([storage_path])
        except Exception:
            pass  # Don't fail if media deletion fails

    # Delete DB record
    await (
        admin_client.table("journal_entries")
        .delete()
        .eq("id", str(entry_id))
        .eq("user_id", str(user.id))
        .execute()
    )


@router.post("/{entry_id}/transcribe/")
async def trigger_transcription(
    entry_id: UUID,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
    admin_client: AsyncClient = Depends(get_supabase_admin),
    settings: Settings = Depends(get_settings),
):
    """Manually trigger transcription for a journal entry."""
    # Get the entry first to find the media URL
    res = await admin_client.table("journal_entries").select("*").eq("id", str(entry_id)).eq("user_id", str(user.id)).maybe_single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    entry = res.data
    if not entry.get("media_url") and not entry.get("raw_text"):
        raise HTTPException(status_code=400, detail="Entry has no content to analyze")

    # Mark as processing
    await (
        admin_client.table("journal_entries")
        .update({"transcription_status": "processing"})
        .eq("id", str(entry_id))
        .eq("user_id", str(user.id))
        .execute()
    )

    background_tasks.add_task(
        transcribe_with_gemini,
        settings=settings,
        db_client=admin_client,
        entry_id=str(entry_id),
        media_url=entry.get("media_url"),
        media_type=entry["entry_type"],
        raw_text=entry.get("raw_text"),
    )

    return {"message": "Transcription started in background", "entry_id": str(entry_id)}
