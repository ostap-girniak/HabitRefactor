"""
Catalyst Forge — Stats Router
Dashboard aggregation, streaks, trends.
"""
from typing import Optional
from uuid import UUID
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, Query
from supabase import AsyncClient

from app.dependencies import get_current_user, get_authenticated_client

router = APIRouter()


def _avg(values):
    nums = [v for v in values if isinstance(v, (int, float))]
    if not nums:
        return None
    return sum(nums) / len(nums)


def _series_avg(items, key: str):
    vals = []
    for it in items:
        v = it.get(key)
        if isinstance(v, (int, float)):
            vals.append(float(v))
    return _avg(vals)


@router.get("/dashboard")
async def get_dashboard(
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Get aggregated dashboard data — the war room overview."""
    user_id = str(user.id)

    # Get all active habits with streaks
    habits_resp = await (
        client.table("habits")
        .select("id, name, category, current_streak_days, best_streak_days, total_relapses, sobriety_start_date, cost_per_unit, time_per_unit_minutes, calories_per_unit")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )

    # Get today's checkins
    from datetime import date
    today = date.today().isoformat()
    checkins_resp = await (
        client.table("checkins")
        .select("habit_id, result")
        .eq("user_id", user_id)
        .eq("date", today)
        .execute()
    )

    # Get latest unread insights (handle potential schema mismatch)
    insights_data = []
    try:
        insights_resp = await (
            client.table("ai_analyses")
            .select("id, title, summary, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(3)
            .execute()
        )
        insights_data = insights_resp.data or []
    except Exception as e:
        print(f"[WARN] Failed to fetch ai_analyses: {e}")

    # Get profile stats
    profile_data = None
    try:
        profile_resp = await (
            client.table("profiles")
            .select("streak_best_ever, total_victories, current_identity_statement, hero_mode_enabled")
            .eq("id", user_id)
            .single()
            .execute()
        )
        profile_data = profile_resp.data
    except Exception as e:
        print(f"[WARN] Failed to fetch profile: {e}")

    # Calculate totals
    habits = habits_resp.data or []
    checked_in_today = {c["habit_id"] for c in (checkins_resp.data or [])}
    habits_needing_checkin = [h for h in habits if h["id"] not in checked_in_today]

    total_streak = sum(h["current_streak_days"] for h in habits)
    total_money_saved = sum(
        h["current_streak_days"] * (h["cost_per_unit"] or 0) for h in habits
    )
    total_time_saved = sum(
        h["current_streak_days"] * (h["time_per_unit_minutes"] or 0) for h in habits
    )

    return {
        "profile": profile_data,
        "habits": habits,
        "today_checkins": checkins_resp.data or [],
        "habits_needing_checkin": habits_needing_checkin,
        "unread_insights": insights_data,
        "totals": {
            "active_habits": len(habits),
            "total_streak_days": total_streak,
            "money_saved": round(total_money_saved, 2),
            "time_saved_minutes": round(total_time_saved, 1),
            "checked_in_today": len(checked_in_today),
        },
    }


@router.get("/streaks")
async def get_all_streaks(
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Get streak data for all habits."""
    response = await (
        client.table("habits")
        .select("id, name, category, current_streak_days, best_streak_days, total_relapses, sobriety_start_date")
        .eq("user_id", str(user.id))
        .eq("is_active", True)
        .order("current_streak_days", desc=True)
        .execute()
    )
    return {"streaks": response.data}


@router.get("/savings/{habit_id}")
async def get_habit_savings(
    habit_id: UUID,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Get detailed savings for a specific habit."""
    result = await client.rpc(
        "calculate_savings",
        {"p_habit_id": str(habit_id), "p_user_id": str(user.id)}
    ).execute()
    return result.data


@router.get("/trends/{habit_id}")
async def get_habit_trends(
    habit_id: UUID,
    period: str = Query("month", pattern="^(week|month|quarter|year)$"),
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Get trend data for charting."""
    limit_map = {"week": 7, "month": 30, "quarter": 90, "year": 365}
    limit = limit_map.get(period, 30)

    response = await (
        client.table("checkins")
        .select("date, result, mood_before, mood_after, stress_level, sleep_quality")
        .eq("user_id", str(user.id))
        .eq("habit_id", str(habit_id))
        .order("date", desc=True)
        .limit(limit)
        .execute()
    )
    return {"trends": response.data, "period": period}


@router.get("/oracle")
async def get_oracle_data(
    habit_id: Optional[UUID] = None,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """
    Get aggregated data for 'The Oracle' heatmap and trends.
    Identifies high-risk hours and correlation between stress and relapses.
    Supports filtering by habit_id.
    """
    user_id = str(user.id)

    # Base query for last 365 check-ins
    query = (
        client.table("checkins")
        .select("date, created_at, result, mood_before, stress_level, time_of_day, relapse_trigger")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .limit(365)
    )

    if habit_id:
        query = query.eq("habit_id", str(habit_id))

    response = await query.execute()
    checkins = response.data or []

    # Journal entries for sentiment drift + mood trend
    journal_query = (
        client.table("journal_entries")
        .select("created_at, mood_rating, raw_text, transcript")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(14)
    )
    if habit_id:
        journal_query = journal_query.eq("habit_id", str(habit_id))
    journal_resp = await journal_query.execute()
    journal_entries = journal_resp.data or []

    # 1. Aggregate by hour of day, weekday, and daily heatmap
    hourly_distribution = {i: {"hour": i, "success": 0, "relapse": 0, "total": 0} for i in range(24)}
    weekday_distribution = {i: {"weekday": i, "success": 0, "relapse": 0, "total": 0} for i in range(7)}
    trigger_counts = {}
    heatmap_map = {}

    for c in checkins:
        try:
            date_str = c["date"]
            if date_str not in heatmap_map:
                heatmap_map[date_str] = {"date": date_str, "success": 0, "relapse": 0, "hours": {}}

            if c["result"] == "relapse":
                heatmap_map[date_str]["relapse"] += 1
            else:
                heatmap_map[date_str]["success"] += 1

            # Aggregate triggers
            if c["result"] == "relapse" and c.get("relapse_trigger"):
                trigger = c["relapse_trigger"]
                trigger_counts[trigger] = trigger_counts.get(trigger, 0) + 1

            # Hour & Weekday analysis
            dt = datetime.fromisoformat(c["created_at"].replace('Z', '+00:00'))
            # Shift UTC to local time (UTC+4 for current local offset)
            local_dt = dt + timedelta(hours=4)
            hour = local_dt.hour % 24
            weekday = local_dt.weekday()

            # Record hourly status for the day (we append because there might be multiple checkins in the same hour)
            if hour not in heatmap_map[date_str]["hours"]:
                heatmap_map[date_str]["hours"][hour] = []
            heatmap_map[date_str]["hours"][hour].append(c["result"])

            hourly_distribution[hour]["total"] += 1
            weekday_distribution[weekday]["total"] += 1

            if c["result"] == "relapse":
                hourly_distribution[hour]["relapse"] += 1
                weekday_distribution[weekday]["relapse"] += 1
            else:
                hourly_distribution[hour]["success"] += 1
                weekday_distribution[weekday]["success"] += 1
        except:
            continue

    # 2. General Trends (Mood vs Stress) over time
    trends_data = checkins[:30][::-1]

    def _avg(values):
        nums = [v for v in values if isinstance(v, (int, float))]
        if not nums:
            return None
        return sum(nums) / len(nums)

    def _series_avg(items, key: str):
        vals = []
        for it in items:
            v = it.get(key)
            if isinstance(v, (int, float)):
                vals.append(float(v))
        return _avg(vals)

    # ---- Risk Scoring (24-48h heuristic) ----
    recent_checkins = checkins[:14]
    prev_checkins = checkins[14:42]

    recent_stress = _series_avg(recent_checkins, "stress_level")
    prev_stress = _series_avg(prev_checkins, "stress_level")
    recent_mood = _series_avg(recent_checkins, "mood_before")
    prev_mood = _series_avg(prev_checkins, "mood_before")

    recent_relapse_rate = _avg([1 if c.get("result") == "relapse" else 0 for c in recent_checkins]) or 0.0

    recent_j = journal_entries[:7]
    prev_j = journal_entries[7:14]
    recent_j_mood = _avg([e.get("mood_rating") for e in recent_j])
    prev_j_mood = _avg([e.get("mood_rating") for e in prev_j])

    NEG_WORDS = {
        "anxious", "anxiety", "panic", "stressed", "stress", "tired", "exhausted", "hopeless",
        "depressed", "angry", "lonely", "alone", "urge", "craving", "weak", "failed", "fail",
        "guilty", "shame", "shameful",
        # UA/RU-lite
        "тривога", "паніка", "стрес", "втом", "злий", "самот", "тяга", "сором", "вина",
    }

    def _neg_ratio(entries):
        text = " ".join(
            [
                ((e.get("raw_text") or "") + " " + (e.get("transcript") or "")).strip()
                for e in entries
            ]
        ).lower()
        if not text:
            return None
        tokens = [t.strip(".,!?;:()[]{}\"'") for t in text.split()]
        if not tokens:
            return None
        neg = 0
        for t in tokens:
            for w in NEG_WORDS:
                if t.startswith(w):
                    neg += 1
                    break
        return neg / max(len(tokens), 1)

    recent_neg = _neg_ratio(recent_j)
    prev_neg = _neg_ratio(prev_j)

    risk_score = 15.0
    risk_factors = []

    # Base relapse rate contribution
    risk_score += min(50.0, recent_relapse_rate * 100.0 * 0.6)
    if recent_relapse_rate >= 0.25:
        risk_factors.append("Elevated relapse rate in recent check-ins.")

    # Stress trend
    if recent_stress is not None and prev_stress is not None and prev_stress > 0:
        stress_delta = (recent_stress - prev_stress) / prev_stress
        if stress_delta > 0.20:
            risk_score += min(20.0, stress_delta * 50.0)
            risk_factors.append(f"Stress up ~{int(stress_delta * 100)}% vs prior period.")

    # Mood drop
    if recent_mood is not None and prev_mood is not None:
        mood_delta = recent_mood - prev_mood
        if mood_delta < -1.0:
            risk_score += min(15.0, abs(mood_delta) * 5.0)
            risk_factors.append("Mood trending down vs prior period.")

    # Journal mood drift
    if recent_j_mood is not None and prev_j_mood is not None:
        j_delta = float(recent_j_mood) - float(prev_j_mood)
        if j_delta < -1.0:
            risk_score += min(10.0, abs(j_delta) * 4.0)
            risk_factors.append("Journal mood_rating drifting downward.")

    # Negative language drift
    if recent_neg is not None and prev_neg is not None:
        neg_delta = float(recent_neg) - float(prev_neg)
        if neg_delta > 0.01:
            risk_score += min(10.0, neg_delta * 600.0)
            risk_factors.append("Journal language shows more negative/urge-related words.")

    risk_score = max(0.0, min(100.0, risk_score))
    danger_zone = risk_score >= 70.0
    warning_report = None
    if danger_zone:
        top = risk_factors[:4] if risk_factors else ["Multiple risk indicators detected."]
        warning_report = " ".join(top)

    # Sort triggers by frequency
    sorted_triggers = sorted(
        [{"name": k, "count": v} for k, v in trigger_counts.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:5]

    return {
        "hourly_risk": list(hourly_distribution.values()),
        "weekday_risk": list(weekday_distribution.values()),
        "heatmap": list(heatmap_map.values()),
        "recent_trends": trends_data,
        "top_triggers": sorted_triggers,
        "forecast": {
            "risk_score": round(risk_score, 1),
            "danger_zone": danger_zone,
            "risk_factors": risk_factors,
            "warning_report": warning_report,
            "window_hours": 48,
        },
        "summary": {
            "total_analyzed": len(checkins),
            "high_risk_hour": max(hourly_distribution.values(), key=lambda x: x["relapse"] if x["total"] > 0 else -1)["hour"] if checkins else None
        }
    }


@router.get("/battles")
async def get_battle_history(
    habit_id: Optional[UUID] = None,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """
    Calculate and return historical streaks (battles).
    A battle is the period between two relapses (or start and first relapse).
    """
    user_id = str(user.id)

    # Fetch relapses for either a specific habit or all
    query = (
        client.table("checkins")
        .select("date, result, relapse_trigger, habit_id, habits(name)")
        .eq("user_id", user_id)
        .eq("result", "relapse")
        .order("date", desc=True)
    )

    if habit_id:
        query = query.eq("habit_id", str(habit_id))

    response = await query.execute()
    relapses = response.data or []

    # Fetch habit creation dates to calculate the first streak for each habit
    habits_query = client.table("habits").select("id, name, created_at").eq("user_id", user_id)
    if habit_id:
        habits_query = habits_query.eq("id", str(habit_id))
    habits_resp = await habits_query.execute()
    habits_map = {h["id"]: h for h in (habits_resp.data or [])}

    battles = []

    # For each relapse, the previous one (or creation date) is the start
    # We group by habit to calculate durations correctly
    from collections import defaultdict
    relapses_by_habit = defaultdict(list)
    for r in relapses:
        relapses_by_habit[r["habit_id"]].append(r)

    from datetime import date
    for h_id, h_relapses in relapses_by_habit.items():
        # Sort chronologically to find intervals
        sorted_relapses = sorted(h_relapses, key=lambda x: x["date"])
        habit_info = habits_map.get(h_id)
        if not habit_info:
            continue

        prev_date = date.fromisoformat(habit_info["created_at"][:10])

        for r in sorted_relapses:
            curr_date = date.fromisoformat(r["date"])
            duration = (curr_date - prev_date).days

            if duration > 0:
                battles.append({
                    "habit_name": habit_info["name"],
                    "duration_days": duration,
                    "end_date": r["date"],
                    "trigger": r["relapse_trigger"],
                    "result": "relapse"
                })
            prev_date = curr_date

    # Sort final list by end_date descending
    battles.sort(key=lambda x: x["end_date"], reverse=True)

    return {"battles": battles[:20]}
