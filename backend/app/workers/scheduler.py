from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings
from app.dependencies import get_supabase_admin
from app.notifications.push import send_web_push
from app.stats.oracle import compute_oracle

_scheduler: Optional[AsyncIOScheduler] = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ts(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


async def _run_relapse_interceptor_tick() -> None:
    settings = get_settings()
    if not settings.enable_relapse_interceptor:
        return

    admin_client = await get_supabase_admin()

    try:
        # Smart reminders of type danger_zone act as opt-in for the interceptor
        reminders_resp = await (
            admin_client.table("reminders")
            .select(
                "id, user_id, habit_id, reminder_type, is_smart, is_enabled, title, message, last_sent_at"
            )
            .eq("is_enabled", True)
            .eq("is_smart", True)
            .eq("reminder_type", "danger_zone")
            .limit(500)
            .execute()
        )
        reminders = reminders_resp.data or []
        if not reminders:
            return
    except Exception as e:
        # If the DB schema is still on the legacy `migration.sql` format,
        # the reminders table won't have these columns. Avoid crashing the app.
        print(f"[WARN] Relapse Interceptor disabled due to schema mismatch: {e}")
        return

    min_interval = timedelta(minutes=int(settings.relapse_interceptor_min_send_interval_minutes))
    now = _utcnow()

    for r in reminders:
        last_sent = _parse_ts(r.get("last_sent_at"))
        if last_sent and (now - last_sent) < min_interval:
            continue

        user_id = str(r["user_id"])
        habit_id = str(r["habit_id"]) if r.get("habit_id") else None

        oracle = await compute_oracle(
            admin_client,
            user_id=user_id,
            habit_id=habit_id,
            danger_threshold=float(settings.relapse_interceptor_danger_zone_threshold),
        )
        forecast = oracle.get("forecast") or {}
        if not forecast.get("danger_zone"):
            continue

        risk_score = forecast.get("risk_score")
        warning_report = forecast.get("warning_report") or ""
        high_risk_hour = (oracle.get("summary") or {}).get("high_risk_hour")

        title = (r.get("title") or "").strip() or "🔥 Danger Zone"
        base_body = (r.get("message") or "").strip() or "High relapse risk detected. Open your War Room now."

        extra_bits = []
        if isinstance(risk_score, (int, float)):
            extra_bits.append(f"Risk {risk_score}/100.")
        if isinstance(high_risk_hour, int):
            extra_bits.append(f"High-risk hour: {high_risk_hour}:00.")
        if warning_report:
            extra_bits.append(warning_report)

        body = " ".join([base_body, *extra_bits]).strip()

        subs: list[dict] = []
        try:
            subs_resp = await (
                admin_client.table("push_subscriptions")
                .select("endpoint, p256dh_key, auth_key, keys, is_active")
                .eq("user_id", user_id)
                .eq("is_active", True)
                .limit(20)
                .execute()
            )
            subs = subs_resp.data or []
        except Exception:
            # Legacy schema fallback: endpoint + keys JSONB, no is_active
            try:
                subs_resp = await (
                    admin_client.table("push_subscriptions")
                    .select("endpoint, keys")
                    .eq("user_id", user_id)
                    .limit(20)
                    .execute()
                )
                subs = subs_resp.data or []
            except Exception as e:
                print(f"[WARN] Failed to read push_subscriptions: {e}")
                subs = []
        if not subs:
            continue

        sent_any = False
        for sub in subs:
            err = await send_web_push(
                settings=settings,
                subscription=sub,
                title=title,
                body=body,
                url="/dashboard",
                tag="danger-zone",
            )
            if err is None:
                sent_any = True
                continue
            if err == "subscription_gone":
                await (
                    admin_client.table("push_subscriptions")
                    .update({"is_active": False})
                    .eq("endpoint", sub.get("endpoint"))
                    .execute()
                )

        if sent_any:
            await (
                admin_client.table("reminders")
                .update({"last_sent_at": now.isoformat()})
                .eq("id", str(r["id"]))
                .execute()
            )


async def start_workers() -> None:
    """
    Start background workers (APScheduler).
    Safe to call multiple times.
    """
    global _scheduler
    if _scheduler is not None:
        return

    settings = get_settings()
    if not settings.enable_relapse_interceptor:
        return

    interval = max(5, int(settings.relapse_interceptor_interval_minutes))

    scheduler = AsyncIOScheduler(timezone="UTC")

    def _kickoff():
        asyncio.create_task(_run_relapse_interceptor_tick())

    scheduler.add_job(
        _kickoff,
        trigger="interval",
        minutes=interval,
        id="relapse-interceptor",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=60,
        replace_existing=True,
    )
    scheduler.start()
    _scheduler = scheduler

    # First run ASAP
    asyncio.create_task(_run_relapse_interceptor_tick())


async def stop_workers() -> None:
    global _scheduler
    if _scheduler is None:
        return
    try:
        _scheduler.shutdown(wait=False)
    finally:
        _scheduler = None
