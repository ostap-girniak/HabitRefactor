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
from app.notifications.push import send_web_push
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
    title: str
    message: str


class ReminderUpdate(BaseModel):
    time_of_day: Optional[str] = None
    days_of_week: Optional[list[int]] = None
    is_smart: Optional[bool] = None
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
            await (
                client.table("reminders")
                .insert(
                    {
                        "user_id": str(user.id),
                        "habit_id": None,
                        "reminder_type": ReminderType.danger_zone.value,
                        "is_smart": True,
                        "is_enabled": True,
                        "title": "🔥 Danger Zone",
                        "message": "High relapse risk detected. Open your War Room now.",
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
    for sub in subs:
        err = await send_web_push(
            settings=settings,
            subscription=sub,
            title="🔥 Test push",
            body="Push is working. Stay hard.",
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
    for sub in subs:
        if sub.get("is_active") is False:
            continue
        err = await send_web_push(
            settings=settings,
            subscription=sub,
            title="🔥 Danger Zone (manual check)",
            body=(forecast.get("warning_report") or "High risk detected. Open your War Room."),
            url="/dashboard",
            tag="danger-zone-manual",
        )
        if err is None:
            sent += 1

    return {"sent": sent, "oracle": oracle}


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
