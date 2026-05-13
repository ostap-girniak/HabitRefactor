from __future__ import annotations

import asyncio
from datetime import datetime, time, timedelta, timezone
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from zoneinfo import ZoneInfo

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


def _is_quiet_hours(
    *,
    now_local: datetime,
    quiet_start: Optional[time],
    quiet_end: Optional[time],
) -> bool:
    if quiet_start is None or quiet_end is None:
        return False
    t = now_local.timetz().replace(tzinfo=None)
    # Same-day window
    if quiet_start <= quiet_end:
        return quiet_start <= t <= quiet_end
    # Overnight window (e.g. 22:00 -> 07:00)
    return t >= quiet_start or t <= quiet_end


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
                "id, user_id, habit_id, reminder_type, is_smart, is_enabled, title, message, last_sent_at, danger_threshold, cooldown_minutes, quiet_hours_start, quiet_hours_end"
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

    now = _utcnow()

    for r in reminders:
        cooldown_minutes = (
            int(r.get("cooldown_minutes"))
            if isinstance(r.get("cooldown_minutes"), int)
            else int(settings.relapse_interceptor_min_send_interval_minutes)
        )
        min_interval = timedelta(minutes=max(0, cooldown_minutes))

        last_sent = _parse_ts(r.get("last_sent_at"))
        if last_sent and (now - last_sent) < min_interval:
            continue

        user_id = str(r["user_id"])
        habit_id = str(r["habit_id"]) if r.get("habit_id") else None

        # quiet hours (per reminder) in user's timezone (fallback UTC)
        tz_name = "UTC"
        try:
            prof = (
                await admin_client.table("profiles")
                .select("timezone")
                .eq("id", user_id)
                .single()
                .execute()
            )
            tz_name = (prof.data or {}).get("timezone") or "UTC"
        except Exception:
            tz_name = "UTC"

        try:
            now_local = now.astimezone(ZoneInfo(tz_name))
        except Exception:
            now_local = now

        quiet_start = r.get("quiet_hours_start")
        quiet_end = r.get("quiet_hours_end")
        if isinstance(quiet_start, str):
            try:
                quiet_start = time.fromisoformat(quiet_start)
            except Exception:
                quiet_start = None
        if isinstance(quiet_end, str):
            try:
                quiet_end = time.fromisoformat(quiet_end)
            except Exception:
                quiet_end = None

        if _is_quiet_hours(now_local=now_local, quiet_start=quiet_start, quiet_end=quiet_end):
            continue

        threshold = r.get("danger_threshold")
        threshold_value = (
            float(threshold)
            if isinstance(threshold, (int, float))
            else float(settings.relapse_interceptor_danger_zone_threshold)
        )

        oracle = await compute_oracle(
            admin_client,
            user_id=user_id,
            habit_id=habit_id,
            danger_threshold=threshold_value,
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
            print(f"[PUSH] Danger Zone sent user={user_id} habit={habit_id or 'all'}")
            await (
                admin_client.table("reminders")
                .update({"last_sent_at": now.isoformat()})
                .eq("id", str(r["id"]))
                .execute()
            )


async def _run_scheduled_reminders_tick() -> None:
    """
    Tick for time-based (non-smart) reminders.
    Checks reminders with is_smart=false, compares time_of_day + days_of_week
    with the user's local time, and sends push if it's time.
    """
    settings = get_settings()
    if not settings.enable_scheduled_reminders:
        return

    admin_client = await get_supabase_admin()

    try:
        reminders_resp = await (
            admin_client.table("reminders")
            .select(
                "id, user_id, habit_id, reminder_type, is_smart, is_enabled, title, message, time_of_day, days_of_week, last_sent_at"
            )
            .eq("is_enabled", True)
            .eq("is_smart", False)
            .limit(500)
            .execute()
        )
        reminders = reminders_resp.data or []
        if not reminders:
            return
    except Exception as e:
        print(f"[WARN] Scheduled reminders disabled due to schema mismatch: {e}")
        return

    now = _utcnow()

    for r in reminders:
        time_of_day_str = r.get("time_of_day")
        if not time_of_day_str:
            continue

        try:
            reminder_time = time.fromisoformat(str(time_of_day_str))
        except Exception:
            continue

        user_id = str(r["user_id"])

        # Resolve user timezone
        tz_name = "UTC"
        try:
            prof = (
                await admin_client.table("profiles")
                .select("timezone")
                .eq("id", user_id)
                .single()
                .execute()
            )
            tz_name = (prof.data or {}).get("timezone") or "UTC"
        except Exception:
            tz_name = "UTC"

        try:
            now_local = now.astimezone(ZoneInfo(tz_name))
        except Exception:
            now_local = now

        # Check day of week (0=Sunday ... 6=Saturday in our schema)
        days = r.get("days_of_week")
        if days and isinstance(days, list):
            # Python: Monday=0 ... Sunday=6.  Our DB: 0=Sunday, 1=Monday ... 6=Saturday
            py_weekday = now_local.weekday()  # 0=Mon
            db_weekday = (py_weekday + 1) % 7  # shift: Mon=1, Tue=2, ..., Sun=0
            if db_weekday not in days:
                continue

        # Check if current time is within ±1 min of reminder time
        current_time = now_local.timetz().replace(tzinfo=None)
        diff_minutes = abs(
            (current_time.hour * 60 + current_time.minute)
            - (reminder_time.hour * 60 + reminder_time.minute)
        )
        if diff_minutes > 1:
            continue

        # Cooldown: don't send if already sent today
        last_sent = _parse_ts(r.get("last_sent_at"))
        if last_sent:
            try:
                last_sent_local = last_sent.astimezone(ZoneInfo(tz_name))
            except Exception:
                last_sent_local = last_sent
            if last_sent_local.date() == now_local.date():
                continue

        # Fetch push subscriptions
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

        title = (r.get("title") or "").strip() or "⏰ Reminder"
        body = (r.get("message") or "").strip() or "Time to check in, warrior."
        reminder_type = r.get("reminder_type", "custom")

        # Choose URL based on type
        url_map = {
            "morning_checkin": "/checkin",
            "evening_review": "/dashboard",
            "motivation": "/forge",
            "streak_celebration": "/dashboard",
        }
        url = url_map.get(reminder_type, "/dashboard")

        sent_any = False
        for sub in subs:
            err = await send_web_push(
                settings=settings,
                subscription=sub,
                title=title,
                body=body,
                url=url,
                tag=f"scheduled-{reminder_type}",
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
            print(f"[PUSH] Scheduled reminder sent user={user_id} type={reminder_type}")
            await (
                admin_client.table("reminders")
                .update({"last_sent_at": now.isoformat()})
                .eq("id", str(r["id"]))
                .execute()
            )


# Keywords that indicate the user is struggling
_DANGER_KEYWORDS = [
    "temptation", "tempt", "urge", "craving", "relapse", "slip", "fail",
    "gave in", "couldn't resist", "struggling", "weak", "porn", "drink",
    "smoke", "high", "wasted", "binged", "broke", "again",
    # Ukrainian
    "спокуса", "зрив", "не втримав", "знову", "слабкість", "тяга",
    "зламався", "хочеться", "дуже хочу", "не можу", "важко",
]

async def _run_journal_alert_tick() -> None:
    """
    Runs every 5 minutes. Checks all journal entries created in the last 5 minutes.
    If danger is detected, sends an alert push notification.
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    five_mins_ago = now - timedelta(minutes=5)

    try:
        admin_client = get_supabase_admin()
        
        # 1. Fetch entries from the last 5 minutes
        resp = await (
            admin_client.table("journal_entries")
            .select("id, user_id, raw_text, transcript, mood_rating")
            .gte("created_at", five_mins_ago.isoformat())
            .execute()
        )
        entries = resp.data or []
        if not entries:
            return

        for entry in entries:
            text = (entry.get("raw_text") or "") + " " + (entry.get("transcript") or "")
            text_lower = text.lower().strip()
            
            if not text_lower:
                continue

            # 2. Analyze
            found_keywords = [kw for kw in _DANGER_KEYWORDS if kw in text_lower]
            mood = entry.get("mood_rating")
            is_danger = len(found_keywords) >= 1 or (mood is not None and mood <= 3)

            if not is_danger:
                continue # Do nothing if no danger
                
            # 3. Danger detected! Send Push
            title = "⚠️ Journal Danger Detected"
            snippet = text[:80].strip() + ("..." if len(text) > 80 else "")
            body = f"Your latest journal entry indicates a struggle: \"{snippet}\". Stay strong, Warrior!"
            notification_type = "danger_zone"
            url = "/dashboard"
            
            subs_resp = await (
                admin_client.table("push_subscriptions")
                .select("endpoint, p256dh_key, auth_key, keys, is_active")
                .eq("user_id", entry["user_id"])
                .eq("is_active", True)
                .limit(20)
                .execute()
            )
            subs = subs_resp.data or []
            
            for sub in subs:
                err = await send_web_push(
                    settings=settings,
                    subscription=sub,
                    title=title,
                    body=body,
                    url=url,
                    tag="journal-auto-danger",
                )
                if err == "subscription_gone":
                    await (
                        admin_client.table("push_subscriptions")
                        .update({"is_active": False})
                        .eq("endpoint", sub.get("endpoint"))
                        .execute()
                    )
            
            # 4. Save to history
            from app.notifications.push import save_notification_to_history
            await save_notification_to_history(
                client=admin_client,
                user_id=entry["user_id"],
                title=title,
                body=body,
                notification_type=notification_type,
                url=url,
                metadata={
                    "journal_entry_id": str(entry["id"]),
                    "found_keywords": found_keywords,
                    "mood_rating": mood,
                    "is_auto": True
                },
            )
            print(f"[PUSH] Sent auto-danger journal alert to user {entry['user_id']}")

    except Exception as e:
        print(f"[WARN] Failed to run journal alert tick: {e}")
        import traceback
        traceback.print_exc()


async def start_workers() -> None:
    """
    Start background workers (APScheduler).
    Safe to call multiple times.
    """
    global _scheduler
    if _scheduler is not None:
        return

    settings = get_settings()
    has_relapse = settings.enable_relapse_interceptor
    has_scheduled = settings.enable_scheduled_reminders

    if not (has_relapse or has_scheduled):
        return

    scheduler = AsyncIOScheduler(timezone="UTC")

    if has_relapse:
        interval = max(5, int(settings.relapse_interceptor_interval_minutes))

        def _kickoff_relapse():
            asyncio.create_task(_run_relapse_interceptor_tick())

        scheduler.add_job(
            _kickoff_relapse,
            trigger="interval",
            minutes=interval,
            id="relapse-interceptor",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=60,
            replace_existing=True,
        )

    if has_scheduled:
        sched_interval = max(1, int(settings.scheduled_reminders_interval_minutes))

        def _kickoff_scheduled():
            asyncio.create_task(_run_scheduled_reminders_tick())

        scheduler.add_job(
            _kickoff_scheduled,
            trigger="interval",
            minutes=sched_interval,
            id="scheduled-reminders",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=30,
            replace_existing=True,
        )

    # Journal Alert Auto-Check (Every 5 minutes)
    def _kickoff_journal_alert():
        asyncio.create_task(_run_journal_alert_tick())

    scheduler.add_job(
        _kickoff_journal_alert,
        trigger="interval",
        minutes=5,
        id="journal-alert-check",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )

    scheduler.start()
    _scheduler = scheduler

    # First run ASAP
    if has_relapse:
        asyncio.create_task(_run_relapse_interceptor_tick())
    if has_scheduled:
        asyncio.create_task(_run_scheduled_reminders_tick())
    
    asyncio.create_task(_run_journal_alert_tick())


async def stop_workers() -> None:
    global _scheduler
    if _scheduler is None:
        return
    try:
        _scheduler.shutdown(wait=False)
    finally:
        _scheduler = None

