"""
Catalyst Forge — Notifications Router
Web Push subscription management and reminder configuration.
"""

from enum import Enum
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from supabase import AsyncClient

from app.config import get_settings
from app.dependencies import get_authenticated_client, get_current_user
from app.notifications.push import send_web_push, save_notification_to_history
from app.notifications import templates as nt
from app.stats.oracle import compute_oracle

router = APIRouter()


class PushSubscription(BaseModel):
    endpoint: str
    p256dh_key: str
    auth_key: str
    user_agent: Optional[str] = None


class ReminderType(str, Enum):
    morning_checkin = "morning_checkin"
    evening_review = "evening_review"
    motivation = "motivation"
    danger_zone = "danger_zone"
    streak_celebration = "streak_celebration"
    custom = "custom"


class ReminderCreate(BaseModel):
    habit_id: Optional[UUID] = None
    reminder_type: ReminderType
    time_of_day: Optional[str] = None  # HH:MM format
    days_of_week: Optional[list[int]] = None
    is_smart: bool = False
    danger_threshold: Optional[float] = None
    cooldown_minutes: Optional[int] = None
    quiet_hours_start: Optional[str] = None  # HH:MM
    quiet_hours_end: Optional[str] = None  # HH:MM
    title: str
    message: str


class ReminderUpdate(BaseModel):
    time_of_day: Optional[str] = None
    days_of_week: Optional[list[int]] = None
    is_smart: Optional[bool] = None
    danger_threshold: Optional[float] = None
    cooldown_minutes: Optional[int] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    title: Optional[str] = None
    message: Optional[str] = None
    is_enabled: Optional[bool] = None


# ---- Push Subscriptions ----


@router.post("/subscribe")
async def subscribe_push(
    data: PushSubscription,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Register a Web Push subscription."""
    payload = data.model_dump(exclude_none=True)
    # Prefer new schema (separate key columns + is_active)
    try:
        sub_data = {
            **payload,
            "user_id": str(user.id),
            "is_active": True,
        }
        await (
            client.table("push_subscriptions")
            .upsert(sub_data, on_conflict="endpoint")
            .execute()
        )
    except Exception:
        # Legacy schema fallback (`keys` JSONB)
        legacy_data = {
            "endpoint": payload["endpoint"],
            "user_id": str(user.id),
            "keys": {"p256dh": payload.get("p256dh_key"), "auth": payload.get("auth_key")},
        }
        await (
            client.table("push_subscriptions")
            .upsert(legacy_data, on_conflict="endpoint")
            .execute()
        )

    # Ensure a default smart Danger Zone reminder exists (Relapse Interceptor opt-in)
    try:
        existing = await (
            client.table("reminders")
            .select("id")
            .eq("user_id", str(user.id))
            .eq("reminder_type", ReminderType.danger_zone.value)
            .eq("is_smart", True)
            .limit(1)
            .execute()
        )
        if not (existing.data or []):
            user_lang = await nt.get_user_lang(client, str(user.id))
            default_title, default_message = nt.pick_danger_default(user_lang)
            await (
                client.table("reminders")
                .insert(
                    {
                        "user_id": str(user.id),
                        "habit_id": None,
                        "reminder_type": ReminderType.danger_zone.value,
                        "is_smart": True,
                        "is_enabled": True,
                        "title": default_title,
                        "message": default_message,
                    }
                )
                .execute()
            )
    except Exception as e:
        print(f"[WARN] Failed to ensure danger_zone reminder: {e}")

    return {"message": "Push subscription registered."}


@router.delete("/subscribe")
async def unsubscribe_push(
    endpoint: str,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Unsubscribe from push notifications."""
    try:
        await (
            client.table("push_subscriptions")
            .update({"is_active": False})
            .eq("endpoint", endpoint)
            .eq("user_id", str(user.id))
            .execute()
        )
    except Exception:
        # Legacy schema: no is_active column
        await (
            client.table("push_subscriptions")
            .delete()
            .eq("endpoint", endpoint)
            .eq("user_id", str(user.id))
            .execute()
        )
    return {"message": "Unsubscribed"}


@router.post("/test-push")
async def send_test_push(
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Send a test push to the current user."""
    settings = get_settings()
    subs_resp = await (
        client.table("push_subscriptions")
        .select("endpoint, p256dh_key, auth_key, is_active")
        .eq("user_id", str(user.id))
        .eq("is_active", True)
        .limit(20)
        .execute()
    )
    subs = subs_resp.data or []
    if not subs:
        raise HTTPException(status_code=400, detail="No active push subscriptions found.")

    sent = 0
    deactivated = 0
    user_lang = await nt.get_user_lang(client, str(user.id))
    title, body = nt.pick_test(user_lang)
    for sub in subs:
        err = await send_web_push(
            settings=settings,
            subscription=sub,
            title=title,
            body=body,
            url="/dashboard",
            tag="test-push",
        )
        if err is None:
            sent += 1
            continue
        if err == "subscription_gone":
            deactivated += 1
            await (
                client.table("push_subscriptions")
                .update({"is_active": False})
                .eq("endpoint", sub.get("endpoint"))
                .execute()
            )

    if sent > 0:
        await save_notification_to_history(
            client=client,
            user_id=str(user.id),
            title=title,
            body=body,
            notification_type="test",
            url="/dashboard",
        )

    return {"sent": sent, "deactivated": deactivated}


@router.post("/danger-check")
async def danger_check_now(
    habit_id: Optional[UUID] = None,
    force_send: bool = False,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """
    Debug helper: compute Oracle for the current user and (optionally) send a push immediately.

    - Sends when `danger_zone=true`, or when `force_send=true`.
    - Does not write `last_sent_at` cooldown bookkeeping.
    """
    settings = get_settings()
    oracle = await compute_oracle(
        client,
        user_id=str(user.id),
        habit_id=str(habit_id) if habit_id else None,
        danger_threshold=float(settings.relapse_interceptor_danger_zone_threshold),
    )
    forecast = oracle.get("forecast") or {}
    should_send = bool(force_send or forecast.get("danger_zone"))

    if not should_send:
        return {"sent": 0, "oracle": oracle}

    subs_resp = await (
        client.table("push_subscriptions")
        .select("endpoint, p256dh_key, auth_key, keys, is_active")
        .eq("user_id", str(user.id))
        .limit(20)
        .execute()
    )
    subs = subs_resp.data or []

    sent = 0
    user_lang = await nt.get_user_lang(client, str(user.id))
    warning_text = forecast.get("warning_report") or ""
    if not warning_text:
        _, warning_text = nt.pick_danger_default(user_lang)
    title, body = nt.pick_danger_manual(user_lang, warning=warning_text)
    for sub in subs:
        if sub.get("is_active") is False:
            continue
        err = await send_web_push(
            settings=settings,
            subscription=sub,
            title=title,
            body=body,
            url="/dashboard",
            tag="danger-zone-manual",
        )
        if err is None:
            sent += 1

    return {"sent": sent, "oracle": oracle}


# ---- Journal Alert (E2E test) ----

# Keywords that indicate the user is struggling
_DANGER_KEYWORDS = [
    "temptation", "tempt", "urge", "craving", "relapse", "slip", "fail",
    "gave in", "couldn't resist", "struggling", "weak", "porn", "drink",
    "smoke", "high", "wasted", "binged", "broke", "again",
    # Ukrainian
    "спокуса", "зрив", "не втримав", "знову", "слабкість", "тяга",
    "зламався", "хочеться", "дуже хочу", "не можу", "важко",
]


@router.post("/journal-alert")
async def journal_alert(
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """
    E2E notification test:
    1. Read the user's latest journal entry
    2. Scan the text for danger keywords
    3. Send a push notification with contextual message
    4. Save to notification_history

    This proves push notifications + history work end-to-end.
    """
    settings = get_settings()

    # 1. Fetch latest journal entry
    journal_resp = await (
        client.table("journal_entries")
        .select("id, raw_text, transcript, mood_rating, key_themes, detected_emotions, created_at")
        .eq("user_id", str(user.id))
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    entries = journal_resp.data or []
    if not entries:
        raise HTTPException(status_code=404, detail="No journal entries found. Write something in the journal first.")

    entry = entries[0]
    text = (entry.get("raw_text") or "") + " " + (entry.get("transcript") or "")
    text_lower = text.lower().strip()

    if not text_lower:
        raise HTTPException(status_code=400, detail="Latest journal entry has no text content.")

    # 2. Analyze: scan for danger keywords
    found_keywords = [kw for kw in _DANGER_KEYWORDS if kw in text_lower]
    mood = entry.get("mood_rating")
    is_danger = len(found_keywords) >= 1 or (mood is not None and mood <= 3)

    # 3. Build notification content
    user_lang = await nt.get_user_lang(client, str(user.id))
    if is_danger:
        snippet = text[:80].strip() + ("..." if len(text) > 80 else "")
        title, body = nt.pick_journal_danger(user_lang, snippet=snippet)
        notification_type = "danger_zone"
        url = "/dashboard"
        tag = "journal-danger-alert"
    else:
        themes = entry.get("key_themes") or []
        title, body = nt.pick_journal_motivation(user_lang, themes=themes)
        notification_type = "motivation"
        url = "/journal"
        tag = "journal-motivation"

    # 4. Send push
    subs_resp = await (
        client.table("push_subscriptions")
        .select("endpoint, p256dh_key, auth_key, keys, is_active")
        .eq("user_id", str(user.id))
        .eq("is_active", True)
        .limit(20)
        .execute()
    )
    subs = subs_resp.data or []

    sent = 0
    for sub in subs:
        err = await send_web_push(
            settings=settings,
            subscription=sub,
            title=title,
            body=body,
            url=url,
            tag=tag,
        )
        if err is None:
            sent += 1
        elif err == "subscription_gone":
            await (
                client.table("push_subscriptions")
                .update({"is_active": False})
                .eq("endpoint", sub.get("endpoint"))
                .execute()
            )

    # 5. Save to notification_history
    await save_notification_to_history(
        client=client,
        user_id=str(user.id),
        title=title,
        body=body,
        notification_type=notification_type,
        url=url,
        metadata={
            "journal_entry_id": str(entry["id"]),
            "found_keywords": found_keywords,
            "mood_rating": mood,
            "is_danger": is_danger,
        },
    )

    return {
        "sent": sent,
        "is_danger": is_danger,
        "found_keywords": found_keywords,
        "title": title,
        "body": body,
        "journal_entry_id": str(entry["id"]),
    }


# ---- Notification History ----


@router.get("/history")
async def list_notification_history(
    limit: int = 30,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """List recent notification history for the bell icon."""
    response = await (
        client.table("notification_history")
        .select("*")
        .eq("user_id", str(user.id))
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"notifications": response.data}


@router.get("/unread-count")
async def unread_count(
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Return count of unread notifications."""
    response = await (
        client.table("notification_history")
        .select("id", count="exact")
        .eq("user_id", str(user.id))
        .eq("is_read", False)
        .execute()
    )
    return {"unread": response.count or 0}


@router.post("/history/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Mark a single notification as read."""
    await (
        client.table("notification_history")
        .update({"is_read": True})
        .eq("id", str(notification_id))
        .eq("user_id", str(user.id))
        .execute()
    )
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Mark all notifications as read."""
    await (
        client.table("notification_history")
        .update({"is_read": True})
        .eq("user_id", str(user.id))
        .eq("is_read", False)
        .execute()
    )
    return {"ok": True}


# ---- Reminders ----


@router.get("/reminders")
async def list_reminders(
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """List configured reminders."""
    response = await (
        client.table("reminders")
        .select("*, habits(name)")
        .eq("user_id", str(user.id))
        .order("time_of_day")
        .execute()
    )
    return {"reminders": response.data}


@router.post("/reminders", status_code=status.HTTP_201_CREATED)
async def create_reminder(
    data: ReminderCreate,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Create a new reminder."""
    reminder_data = {**data.model_dump(exclude_none=True), "user_id": str(user.id)}
    if data.habit_id:
        reminder_data["habit_id"] = str(data.habit_id)

    response = await client.table("reminders").insert(reminder_data).execute()
    return response.data[0]


@router.put("/reminders/{reminder_id}")
async def update_reminder(
    reminder_id: UUID,
    data: ReminderUpdate,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Update a reminder."""
    update_data = data.model_dump(exclude_none=True)
    response = await (
        client.table("reminders")
        .update(update_data)
        .eq("id", str(reminder_id))
        .eq("user_id", str(user.id))
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return response.data[0]


@router.delete("/reminders/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    reminder_id: UUID,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Delete a reminder."""
    await (
        client.table("reminders")
        .delete()
        .eq("id", str(reminder_id))
        .eq("user_id", str(user.id))
        .execute()
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
