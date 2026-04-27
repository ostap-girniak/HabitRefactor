from __future__ import annotations

from datetime import datetime
from typing import Optional

from supabase import AsyncClient


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


async def compute_oracle(
    client: AsyncClient,
    *,
    user_id: str,
    habit_id: Optional[str] = None,
    danger_threshold: float = 70.0,
) -> dict:
    """
    Shared Oracle computation used by:
    - API endpoint: /stats/oracle (authenticated client)
    - Relapse Interceptor worker (admin client)
    """
    # Base query for last 365 check-ins
    query = (
        client.table("checkins")
        .select("date, created_at, result, mood_before, stress_level, time_of_day, relapse_trigger, habit_id")
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
        .select("created_at, mood_rating, raw_text, transcript, habit_id")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(14)
    )
    if habit_id:
        journal_query = journal_query.eq("habit_id", str(habit_id))
    journal_resp = await journal_query.execute()
    journal_entries = journal_resp.data or []

    # 1. Aggregate by hour of day
    hourly_distribution = {
        i: {"hour": i, "success": 0, "relapse": 0, "total": 0} for i in range(24)
    }
    trigger_counts = {}

    for c in checkins:
        try:
            # Aggregate triggers
            if c.get("result") == "relapse" and c.get("relapse_trigger"):
                trigger = c["relapse_trigger"]
                trigger_counts[trigger] = trigger_counts.get(trigger, 0) + 1

            # Hour analysis
            created_at = c.get("created_at")
            if not created_at:
                continue
            dt = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
            hour = dt.hour

            hourly_distribution[hour]["total"] += 1
            if c.get("result") == "relapse":
                hourly_distribution[hour]["relapse"] += 1
            else:
                hourly_distribution[hour]["success"] += 1
        except Exception:
            continue

    # 2. General Trends (Mood vs Stress) over time
    trends_data = checkins[:30][::-1]

    # ---- Risk Scoring (24-48h heuristic) ----
    recent_checkins = checkins[:14]
    prev_checkins = checkins[14:42]

    recent_stress = _series_avg(recent_checkins, "stress_level")
    prev_stress = _series_avg(prev_checkins, "stress_level")
    recent_mood = _series_avg(recent_checkins, "mood_before")
    prev_mood = _series_avg(prev_checkins, "mood_before")

    recent_relapse_rate = (
        _avg([1 if c.get("result") == "relapse" else 0 for c in recent_checkins]) or 0.0
    )

    recent_j = journal_entries[:7]
    prev_j = journal_entries[7:14]
    recent_j_mood = _avg([e.get("mood_rating") for e in recent_j])
    prev_j_mood = _avg([e.get("mood_rating") for e in prev_j])

    NEG_WORDS = {
        "anxious",
        "anxiety",
        "panic",
        "stressed",
        "stress",
        "tired",
        "exhausted",
        "hopeless",
        "depressed",
        "angry",
        "lonely",
        "alone",
        "urge",
        "craving",
        "weak",
        "failed",
        "fail",
        "guilty",
        "shame",
        "shameful",
        # UA/RU-lite
        "тривога",
        "паніка",
        "стрес",
        "втом",
        "злий",
        "самот",
        "тяга",
        "сором",
        "вина",
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
    risk_factors: list[str] = []

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
    danger_zone = risk_score >= float(danger_threshold)
    warning_report = None
    if danger_zone:
        top = risk_factors[:4] if risk_factors else ["Multiple risk indicators detected."]
        warning_report = " ".join(top)

    # Sort triggers by frequency
    sorted_triggers = sorted(
        [{"name": k, "count": v} for k, v in trigger_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:5]

    high_risk_hour = None
    if checkins:
        high_risk_hour = max(
            hourly_distribution.values(),
            key=lambda x: x["relapse"] if x["total"] > 0 else -1,
        )["hour"]

    return {
        "hourly_risk": list(hourly_distribution.values()),
        "recent_trends": trends_data,
        "top_triggers": sorted_triggers,
        "forecast": {
            "risk_score": round(risk_score, 1),
            "danger_zone": danger_zone,
            "danger_threshold": float(danger_threshold),
            "risk_factors": risk_factors,
            "warning_report": warning_report,
            "window_hours": 48,
        },
        "summary": {"total_analyzed": len(checkins), "high_risk_hour": high_risk_hour},
    }
