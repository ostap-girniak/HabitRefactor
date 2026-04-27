"""
Catalyst Forge — Check-ins Router
"""
from typing import Annotated, Optional, Any
from uuid import UUID
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from supabase import AsyncClient
from enum import Enum

from app.dependencies import get_current_user, get_authenticated_client
from app.habits.service import HabitsService

router = APIRouter()


class CheckinResult(str, Enum):
    success = "success"
    relapse = "relapse"
    partial = "partial"


class CheckinCreate(BaseModel):
    habit_id: UUID
    date: date
    result: CheckinResult
    relapse_count: int = 0
    relapse_trigger: Optional[str] = None
    triggers: Optional[list[str]] = None  # Frontend sends tags as array
    mood_before: Optional[int] = Field(None, ge=1, le=10)
    mood_after: Optional[int] = Field(None, ge=1, le=10)
    thoughts_before: Optional[str] = None
    time_of_day: Optional[str] = None
    location: Optional[str] = None
    was_alone: Optional[bool] = None
    alcohol_involved: bool = False
    stress_level: Optional[int] = Field(None, ge=1, le=10)
    sleep_quality: Optional[int] = Field(None, ge=1, le=5)
    notes: Optional[str] = None


class CheckinResponse(BaseModel):
    id: UUID
    user_id: UUID
    habit_id: UUID
    date: date
    result: CheckinResult
    relapse_count: int = 0
    relapse_trigger: Optional[str] = None
    mood_before: Optional[int] = None
    mood_after: Optional[int] = None
    thoughts_before: Optional[str] = None
    time_of_day: Optional[str] = None
    location: Optional[str] = None
    was_alone: Optional[bool] = None
    alcohol_involved: bool = False
    stress_level: Optional[int] = None
    sleep_quality: Optional[int] = None
    notes: Optional[str] = None
    ai_processed: bool = False
    ai_insights: Optional[Any] = None
    created_at: datetime


@router.get("/today")
async def get_today_checkins(
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Get all check-ins for today."""
    today = date.today().isoformat()
    response = await (
        client.table("checkins")
        .select("*, habits(name, category)")
        .eq("user_id", str(user.id))
        .eq("date", today)
        .execute()
    )
    return {"checkins": response.data, "date": today}


@router.post("/", response_model=CheckinResponse, status_code=status.HTTP_201_CREATED)
async def create_checkin(
    data: CheckinCreate,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Submit a daily check-in. This is the core honesty tool."""
    # Merge triggers array into relapse_trigger string for DB storage
    trigger_text = data.relapse_trigger or ""
    if data.triggers:
        tags_str = ", ".join(data.triggers)
        trigger_text = f"{trigger_text}; tags: {tags_str}" if trigger_text else tags_str

    checkin_data = {
        **data.model_dump(exclude_none=True, exclude={"triggers"}),
        "user_id": str(user.id),
        "habit_id": str(data.habit_id),
        "date": data.date.isoformat(),
    }
    # Always set relapse_trigger if we have any trigger info
    if trigger_text:
        checkin_data["relapse_trigger"] = trigger_text
    # Ensure empty strings become null for optional fields
    for field in ("time_of_day", "notes", "relapse_trigger"):
        if field in checkin_data and checkin_data[field] == "":
            del checkin_data[field]

    try:
        response = await (
            client.table("checkins")
            .upsert(checkin_data, on_conflict="user_id,habit_id,date")
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to save check-in")

        # [NEW] Handle Autonomous Streak Reset
        if data.result == CheckinResult.relapse:
            habits_service = HabitsService(client)
            await habits_service.reset_streak(str(data.habit_id), str(user.id))
            print(f"[REFACTOR] Habit {data.habit_id} streak reset due to relapse.")

        # [NEW] Identity Integration: Reward success
        if data.result == CheckinResult.success:
            try:
                # Find the most recently active identity statement
                stmt_resp = await (
                    client.table("identity_statements")
                    .select("id, belief_score")
                    .eq("user_id", str(user.id))
                    .eq("is_active", True)
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if stmt_resp.data:
                    current_stmt = stmt_resp.data[0]
                    # Grow belief score on success
                    new_belief = min(100, current_stmt["belief_score"] + 1)
                    await (
                        client.table("identity_statements")
                        .update({"belief_score": new_belief})
                        .eq("id", current_stmt["id"])
                        .execute()
                    )
            except Exception as e:
                print(f"[WARN] Failed to update identity belief: {e}")

        return response.data[0]
    except Exception as e:
        error_msg = str(e).lower()
        print(f"[ERROR] Check-in creation failed: {error_msg}")
        
        # Handle duplicate check-ins (Unique constraint violation)
        if "23505" in error_msg or "duplicate key" in error_msg:
            raise HTTPException(
                status_code=400,
                detail="You have already submitted a check-in for this habit today."
            )
            
        # Handle the specific case of a missing column
        if "alcohol_involved" in error_msg:
            raise HTTPException(
                status_code=500, 
                detail="Database schema mismatch: 'alcohol_involved' column missing. Please run the SQL migration."
            )
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/history")
async def get_checkin_history(
    habit_id: Optional[UUID] = None,
    limit: int = Query(30, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Get paginated check-in history."""
    query = (
        client.table("checkins")
        .select("*, habits(name, category)")
        .eq("user_id", str(user.id))
        .order("date", desc=True)
        .range(offset, offset + limit - 1)
    )

    if habit_id:
        query = query.eq("habit_id", str(habit_id))

    response = await query.execute()
    return {"checkins": response.data, "total": len(response.data)}


@router.get("/calendar/{habit_id}")
async def get_calendar_data(
    habit_id: UUID,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Get calendar heatmap data for a habit (last 365 days)."""
    response = await (
        client.table("checkins")
        .select("date, result, mood_before, stress_level, created_at")
        .eq("user_id", str(user.id))
        .eq("habit_id", str(habit_id))
        .order("date", desc=True)
        .limit(365)
        .execute()
    )
    return {"calendar": response.data}
