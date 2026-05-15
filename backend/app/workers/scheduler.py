from __future__ import annotations

import asyncio
from datetime import datetime, time, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings
from app.dependencies import get_supabase_admin
from app.notifications.push import send_web_push, save_notification_to_history
from app.notifications import templates as nt
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
    if quiet_start <= quiet_end:
        return quiet_start <= t <= quiet_end
    return t >= quiet_start or t <= quiet_end


# ---- Pattern Analysis Helpers ----

def _compute_hourly_pattern(checkins: list[dict], tz: ZoneInfo) -> dict:
    """Hourly relapse stats in user's local timezone."""
    hourly = {i: {"success": 0, "relapse": 0, "total": 0} for i in range(24)}
    for c in checkins:
        ts = _parse_ts(c.get("created_at"))
        if not ts:
            continue
        try:
            local_ts = ts.astimezone(tz)
        except Exception:
            local_ts = ts
        h = local_ts.hour
        hourly[h]["total"] += 1
        if c.get("result") == "relapse":
            hourly[h]["relapse"] += 1
        else:
            hourly[h]["success"] += 1
    return hourly


def _compute_weekday_pattern(checkins: list[dict], tz: ZoneInfo) -> dict:
    """Weekday relapse stats in user's local timezone. {0=Mon...6=Sun}"""
    weekday: dict[int, dict] = {i: {"success": 0, "relapse": 0, "total": 0} for i in range(7)}
    for c in checkins:
        ts = _parse_ts(c.get("created_at"))
        if not ts:
            continue
        try:
            local_ts = ts.astimezone(tz)
        except Exception:
            local_ts = ts
        wd = local_ts.weekday()  # 0=Mon
        weekday[wd]["total"] += 1
        if c.get("result") == "relapse":
            weekday[wd]["relapse"] += 1
        else:
            weekday[wd]["success"] += 1
    return weekday


def _check_streak_pattern(checkins: list[dict]) -> Optional[dict]:
    """
    Detect if user's current check-in streak is approaching their
    historically typical break point. Returns a context dict (lang-free).
    """
    valid = [c for c in checkins if _parse_ts(c.get("created_at"))]
    if len(valid) < 15:
        return None

    sorted_checkins = sorted(valid, key=lambda c: _parse_ts(c.get("created_at")))  # type: ignore[arg-type]

    historical_breaks: list[int] = []
    run = 0
    for c in sorted_checkins:
        if c.get("result") == "relapse":
            if run > 0:
                historical_breaks.append(run)
            run = 0
        else:
            run += 1

    if len(historical_breaks) < 3:
        return None

    current_streak = run
    avg_break = sum(historical_breaks) / len(historical_breaks)

    if current_streak >= 3 and abs(current_streak - avg_break) <= 2:
        return {
            "type": "pattern_streak",
            "ctx": {"current": current_streak, "avg": int(avg_break)},
            "url": "/dashboard",
            "tag": "pattern-streak-risk",
        }
    return None


def _top_trigger_at_hour(checkins: list[dict], target_hour: int, tz: ZoneInfo) -> Optional[str]:
    """Return the most common relapse_trigger at a specific local hour."""
    counts: dict[str, int] = {}
    for c in checkins:
        if c.get("result") != "relapse":
            continue
        ts = _parse_ts(c.get("created_at"))
        if not ts:
            continue
        try:
            h = ts.astimezone(tz).hour
        except Exception:
            h = ts.hour
        if h == target_hour and c.get("relapse_trigger"):
            t = c["relapse_trigger"]
            counts[t] = counts.get(t, 0) + 1
    if not counts:
        return None
    return max(counts, key=lambda k: counts[k])


async def _analyze_and_notify_patterns(
    admin_client,
    settings,
    now: datetime,
    user_id: str,
    subs: list[dict],
) -> None:
    """Run all pattern checks for one user and send relevant pre-emptive notifications."""

    # Resolve user timezone + language
    tz_name = "UTC"
    user_lang = "uk"
    try:
        prof = await (
            admin_client.table("profiles")
            .select("timezone, preferred_language")
            .eq("id", user_id)
            .single()
            .execute()
        )
        prof_data = prof.data or {}
        tz_name = prof_data.get("timezone") or "UTC"
        user_lang = nt.normalize_lang(prof_data.get("preferred_language"))
    except Exception:
        pass

    try:
        tz_info = ZoneInfo(tz_name)
        now_local = now.astimezone(tz_info)
    except Exception:
        tz_info = ZoneInfo("UTC")
        now_local = now

    # Fetch last 90 days of check-ins
    ninety_days_ago = now - timedelta(days=90)
    try:
        checkins_resp = await (
            admin_client.table("checkins")
            .select("created_at, result, mood_before, stress_level, relapse_trigger, habit_id")
            .eq("user_id", user_id)
            .gte("created_at", ninety_days_ago.isoformat())
            .order("created_at", desc=True)
            .limit(500)
            .execute()
        )
        checkins = checkins_resp.data or []
    except Exception as e:
        print(f"[WARN] Pattern: failed checkins fetch for {user_id}: {e}")
        return

    if len(checkins) < 15:
        return  # Not enough history for reliable patterns

    # Cooldown: which pattern types were already sent in the last 6 hours?
    six_hours_ago = now - timedelta(hours=6)
    try:
        hist_resp = await (
            admin_client.table("notification_history")
            .select("notification_type")
            .eq("user_id", user_id)
            .in_("notification_type", ["pattern_hourly", "pattern_weekday", "pattern_consecutive", "pattern_streak"])
            .gte("created_at", six_hours_ago.isoformat())
            .limit(20)
            .execute()
        )
        recent_types = {r["notification_type"] for r in (hist_resp.data or [])}
    except Exception:
        recent_types = set()

    notifications_to_send: list[dict] = []

    # 1. Hourly relapse pattern: warn 15–35 min before the high-risk hour
    if "pattern_hourly" not in recent_types:
        hourly = _compute_hourly_pattern(checkins, tz_info)
        current_minutes = now_local.hour * 60 + now_local.minute

        for h, stats in hourly.items():
            if stats["total"] < 5 or stats["relapse"] < 3:
                continue
            relapse_rate = stats["relapse"] / stats["total"]
            if relapse_rate < 0.5:
                continue
            diff = h * 60 - current_minutes
            if diff < 0:
                diff += 24 * 60
            if 15 <= diff <= 35:
                trigger = _top_trigger_at_hour(checkins, h, tz_info)
                notifications_to_send.append({
                    "type": "pattern_hourly",
                    "ctx": {
                        "hour": h,
                        "now_local": now_local.strftime("%H:%M"),
                        "trigger": trigger,
                    },
                    "url": "/dashboard",
                    "tag": "pattern-hourly-risk",
                })
                break

    # 2. Day-of-week risk: send morning warning (8–10am) on historically high-risk days
    if "pattern_weekday" not in recent_types and 8 <= now_local.hour <= 10:
        weekday_stats = _compute_weekday_pattern(checkins, tz_info)
        total_relapses = sum(v["relapse"] for v in weekday_stats.values())
        if total_relapses > 0:
            today_wd = now_local.weekday()
            today_stats = weekday_stats[today_wd]
            overall_avg_rate = total_relapses / max(sum(v["total"] for v in weekday_stats.values()), 1)
            today_rate = today_stats["relapse"] / max(today_stats["total"], 1)

            if today_stats["total"] >= 3 and today_rate >= 0.45 and today_rate > overall_avg_rate * 1.4:
                notifications_to_send.append({
                    "type": "pattern_weekday",
                    "ctx": {"day_en": now_local.strftime("%A")},
                    "url": "/checkin",
                    "tag": "pattern-weekday-risk",
                })

    # 3. Consecutive relapses: 2+ in the last 24 hours
    if "pattern_consecutive" not in recent_types:
        one_day_ago = now - timedelta(hours=24)
        recent_relapses = [
            c for c in checkins
            if c.get("result") == "relapse"
            and (_parse_ts(c.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc)) >= one_day_ago
        ]
        if len(recent_relapses) >= 2:
            notifications_to_send.append({
                "type": "pattern_consecutive",
                "ctx": {"count": len(recent_relapses)},
                "url": "/dashboard",
                "tag": "pattern-consecutive",
            })

    # 4. Streak break pattern: approaching historical break point
    if "pattern_streak" not in recent_types:
        streak_warning = _check_streak_pattern(checkins)
        if streak_warning:
            notifications_to_send.append(streak_warning)

    # Render with user's language, then send
    for notif in notifications_to_send:
        ctx = notif.get("ctx") or {}
        ntype = notif["type"]
        if ntype == "pattern_hourly":
            title, body = nt.pick_pattern_hourly(
                user_lang,
                hour=ctx["hour"],
                now_local=ctx["now_local"],
                trigger=ctx.get("trigger"),
            )
        elif ntype == "pattern_weekday":
            title, body = nt.pick_pattern_weekday(user_lang, day_en=ctx["day_en"])
        elif ntype == "pattern_consecutive":
            title, body = nt.pick_pattern_consecutive(user_lang, count=ctx["count"])
        elif ntype == "pattern_streak":
            title, body = nt.pick_pattern_streak(
                user_lang, current=ctx["current"], avg=ctx["avg"]
            )
        else:
            continue

        sent_any = False
        for sub in subs:
            err = await send_web_push(
                settings=settings,
                subscription=sub,
                title=title,
                body=body,
                url=notif["url"],
                tag=notif["tag"],
            )
            if err is None:
                sent_any = True
            elif err == "subscription_gone":
                try:
                    await (
                        admin_client.table("push_subscriptions")
                        .update({"is_active": False})
                        .eq("endpoint", sub.get("endpoint"))
                        .execute()
                    )
                except Exception:
                    pass

        if sent_any:
            await save_notification_to_history(
                client=admin_client,
                user_id=user_id,
                title=title,
                body=body,
                notification_type=ntype,
                url=notif["url"],
            )
            print(f"[PUSH] Pattern notification sent user={user_id} type={ntype}")


async def _run_pattern_interceptor_tick() -> None:
    """
    Runs every 15 minutes. Fetches all users with active push subscriptions
    and runs behavioral pattern analysis for each, sending pre-emptive alerts.
    """
    settings = get_settings()
    if not settings.enable_pattern_interceptor:
        return

    try:
        admin_client = await get_supabase_admin()
    except Exception as e:
        print(f"[WARN] Pattern interceptor: admin client error: {e}")
        return

    try:
        subs_resp = await (
            admin_client.table("push_subscriptions")
            .select("user_id, endpoint, p256dh_key, auth_key, keys, is_active")
            .eq("is_active", True)
            .limit(1000)
            .execute()
        )
        all_subs = subs_resp.data or []
    except Exception as e:
        print(f"[WARN] Pattern interceptor: failed to fetch subscriptions: {e}")
        return

    # Group by user
    user_subs: dict[str, list[dict]] = {}
    for sub in all_subs:
        uid = sub.get("user_id")
        if uid:
            user_subs.setdefault(uid, []).append(sub)

    now = _utcnow()
    for user_id, subs in user_subs.items():
        try:
            await _analyze_and_notify_patterns(admin_client, settings, now, user_id, subs)
        except Exception as e:
            print(f"[WARN] Pattern analysis failed for user={user_id}: {e}")


# ---- Relapse Interceptor ----

async def _run_relapse_interceptor_tick() -> None:
    settings = get_settings()
    if not settings.enable_relapse_interceptor:
        return

    try:
        admin_client = await get_supabase_admin()
    except Exception as e:
        print(f"[WARN] Relapse interceptor: admin client error: {e}")
        return

    try:
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

        tz_name = "UTC"
        user_lang = "uk"
        try:
            prof = (
                await admin_client.table("profiles")
                .select("timezone, preferred_language")
                .eq("id", user_id)
                .single()
                .execute()
            )
            prof_data = prof.data or {}
            tz_name = prof_data.get("timezone") or "UTC"
            user_lang = nt.normalize_lang(prof_data.get("preferred_language"))
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

        default_title, default_body = nt.pick_danger_default(user_lang)
        title = (r.get("title") or "").strip() or default_title
        base_body = (r.get("message") or "").strip() or default_body

        extra_bits = []
        if isinstance(risk_score, (int, float)):
            risk_label = "Ризик" if user_lang == "uk" else "Risk"
            extra_bits.append(f"{risk_label} {risk_score}/100.")
        if isinstance(high_risk_hour, int):
            hour_label = "Небезпечна година" if user_lang == "uk" else "High-risk hour"
            extra_bits.append(f"{hour_label}: {high_risk_hour}:00.")
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


# ---- Scheduled Reminders ----

async def _run_scheduled_reminders_tick() -> None:
    """
    Tick for time-based (non-smart) reminders.
    Checks reminders with is_smart=false, compares time_of_day + days_of_week
    with the user's local time, and sends push if it's time.
    """
    settings = get_settings()
    if not settings.enable_scheduled_reminders:
        return

    try:
        admin_client = await get_supabase_admin()
    except Exception as e:
        print(f"[WARN] Scheduled reminders: admin client error: {e}")
        return

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

        tz_name = "UTC"
        user_lang = "uk"
        try:
            prof = (
                await admin_client.table("profiles")
                .select("timezone, preferred_language")
                .eq("id", user_id)
                .single()
                .execute()
            )
            prof_data = prof.data or {}
            tz_name = prof_data.get("timezone") or "UTC"
            user_lang = nt.normalize_lang(prof_data.get("preferred_language"))
        except Exception:
            tz_name = "UTC"

        try:
            now_local = now.astimezone(ZoneInfo(tz_name))
        except Exception:
            now_local = now

        days = r.get("days_of_week")
        if days and isinstance(days, list):
            py_weekday = now_local.weekday()  # 0=Mon
            db_weekday = (py_weekday + 1) % 7  # shift: Mon=1, ..., Sun=0
            if db_weekday not in days:
                continue

        current_time = now_local.timetz().replace(tzinfo=None)
        diff_minutes = abs(
            (current_time.hour * 60 + current_time.minute)
            - (reminder_time.hour * 60 + reminder_time.minute)
        )
        if diff_minutes > 1:
            continue

        last_sent = _parse_ts(r.get("last_sent_at"))
        if last_sent:
            try:
                last_sent_local = last_sent.astimezone(ZoneInfo(tz_name))
            except Exception:
                last_sent_local = last_sent
            if last_sent_local.date() == now_local.date():
                continue

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

        reminder_type = r.get("reminder_type", "custom")
        default_title, default_body = nt.scheduled_reminder_defaults(user_lang, reminder_type)
        title = (r.get("title") or "").strip() or default_title
        body = (r.get("message") or "").strip() or default_body

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


# ---- Journal Alert ----

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
        admin_client = await get_supabase_admin()

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

            found_keywords = [kw for kw in _DANGER_KEYWORDS if kw in text_lower]
            mood = entry.get("mood_rating")
            is_danger = len(found_keywords) >= 1 or (mood is not None and mood <= 3)

            if not is_danger:
                continue

            user_lang = await nt.get_user_lang(admin_client, entry["user_id"])
            snippet = text[:80].strip() + ("..." if len(text) > 80 else "")
            title, body = nt.pick_journal_danger(user_lang, snippet=snippet)
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
                    "is_auto": True,
                },
            )
            print(f"[PUSH] Sent auto-danger journal alert to user {entry['user_id']}")

    except Exception as e:
        print(f"[WARN] Failed to run journal alert tick: {e}")
        import traceback
        traceback.print_exc()


# ---- Milestone Celebrations ----

async def _run_milestone_tick() -> None:
    """
    Run every 6 hours. For each active habit with a streak that lands on a
    milestone day (1, 3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365,
    500, 1000), send a celebration push — but only once per (habit, streak)
    pair (deduplicated via notification_history metadata).
    """
    settings = get_settings()
    if not bool(settings.vapid_private_key and settings.vapid_public_key):
        return

    try:
        admin_client = await get_supabase_admin()
    except Exception as e:
        print(f"[WARN] Milestone worker: admin client error: {e}")
        return

    try:
        habits_resp = await (
            admin_client.table("habits")
            .select("id, user_id, name, current_streak_days, is_active")
            .eq("is_active", True)
            .in_("current_streak_days", list(nt.MILESTONE_DAYS))
            .limit(2000)
            .execute()
        )
        habits = habits_resp.data or []
    except Exception as e:
        print(f"[WARN] Milestone worker: habits fetch failed: {e}")
        return

    if not habits:
        return

    # Group habits by user
    by_user: dict[str, list[dict]] = {}
    for h in habits:
        uid = h.get("user_id")
        if uid:
            by_user.setdefault(uid, []).append(h)

    for user_id, user_habits in by_user.items():
        # Already-celebrated (habit_id, streak) pairs in the last 60 days
        already: set[tuple[str, int]] = set()
        try:
            hist_resp = await (
                admin_client.table("notification_history")
                .select("metadata, created_at")
                .eq("user_id", user_id)
                .eq("notification_type", "milestone")
                .gte("created_at", (_utcnow() - timedelta(days=60)).isoformat())
                .limit(200)
                .execute()
            )
            for row in (hist_resp.data or []):
                meta = row.get("metadata") or {}
                hid = meta.get("habit_id")
                days = meta.get("streak_days")
                if hid and isinstance(days, int):
                    already.add((str(hid), int(days)))
        except Exception:
            already = set()

        # Get user lang + subs once
        user_lang = await nt.get_user_lang(admin_client, user_id)
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
            subs = []
        if not subs:
            continue

        for h in user_habits:
            hid = str(h["id"])
            days = int(h.get("current_streak_days") or 0)
            if days not in nt.MILESTONE_DAYS:
                continue
            if (hid, days) in already:
                continue

            habit_name = h.get("name") or ""
            title, body = nt.pick_milestone(user_lang, days=days, habit_name=habit_name)
            url = f"/habits/{hid}"

            sent_any = False
            for sub in subs:
                err = await send_web_push(
                    settings=settings,
                    subscription=sub,
                    title=title,
                    body=body,
                    url=url,
                    tag=f"milestone-{hid}-{days}",
                )
                if err is None:
                    sent_any = True
                elif err == "subscription_gone":
                    try:
                        await (
                            admin_client.table("push_subscriptions")
                            .update({"is_active": False})
                            .eq("endpoint", sub.get("endpoint"))
                            .execute()
                        )
                    except Exception:
                        pass

            if sent_any:
                await save_notification_to_history(
                    client=admin_client,
                    user_id=user_id,
                    title=title,
                    body=body,
                    notification_type="milestone",
                    url=url,
                    metadata={"habit_id": hid, "streak_days": days},
                )
                print(f"[PUSH] Milestone {days}d sent user={user_id} habit={hid}")


# ---- Scheduler Lifecycle ----

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
    has_pattern = settings.enable_pattern_interceptor
    has_vapid = bool(settings.vapid_private_key and settings.vapid_public_key)

    # Start scheduler whenever any worker is active or push is configured
    if not (has_relapse or has_scheduled or has_pattern or has_vapid):
        return

    scheduler = AsyncIOScheduler(timezone="UTC")

    if has_relapse:
        interval = max(5, int(settings.relapse_interceptor_interval_minutes))

        async def _kickoff_relapse():
            await _run_relapse_interceptor_tick()

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

        async def _kickoff_scheduled():
            await _run_scheduled_reminders_tick()

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

    if has_pattern:
        pattern_interval = max(5, int(settings.pattern_interceptor_interval_minutes))

        async def _kickoff_pattern():
            await _run_pattern_interceptor_tick()

        scheduler.add_job(
            _kickoff_pattern,
            trigger="interval",
            minutes=pattern_interval,
            id="pattern-interceptor",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=60,
            replace_existing=True,
        )

    # Journal alert + milestone celebrations run whenever push is configured
    if has_vapid:
        async def _kickoff_journal_alert():
            await _run_journal_alert_tick()

        scheduler.add_job(
            _kickoff_journal_alert,
            trigger="interval",
            minutes=5,
            id="journal-alert-check",
            max_instances=1,
            coalesce=True,
            replace_existing=True,
        )

        async def _kickoff_milestone():
            await _run_milestone_tick()

        scheduler.add_job(
            _kickoff_milestone,
            trigger="interval",
            hours=6,
            id="milestone-celebrations",
            max_instances=1,
            coalesce=True,
            replace_existing=True,
        )

    scheduler.start()
    _scheduler = scheduler

    if has_relapse:
        asyncio.create_task(_run_relapse_interceptor_tick())
    if has_scheduled:
        asyncio.create_task(_run_scheduled_reminders_tick())
    if has_pattern:
        asyncio.create_task(_run_pattern_interceptor_tick())
    if has_vapid:
        asyncio.create_task(_run_journal_alert_tick())
        asyncio.create_task(_run_milestone_tick())


async def stop_workers() -> None:
    global _scheduler
    if _scheduler is None:
        return
    try:
        _scheduler.shutdown(wait=False)
    finally:
        _scheduler = None
