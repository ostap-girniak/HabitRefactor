"""
Catalyst Forge — AI Analysis Router
The heart of the system — AI-powered insights, Hero Mode, Catalyst Forge.
"""
import asyncio
from typing import Awaitable, Callable, Optional
from uuid import UUID
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from supabase import AsyncClient

from app.dependencies import get_current_user, get_authenticated_client, get_supabase_admin
from app.config import get_settings
from app.ai.analyzer import AIAnalyzer

router = APIRouter()

async def _run_with_retries(
    action_factory: Callable[[], Awaitable[dict]],
    attempts: int = 2,
    delay_seconds: float = 1.0,
) -> dict:
    """Run AI action with small retry budget before fallback."""
    last_error: Optional[Exception] = None
    for attempt in range(1, attempts + 1):
        try:
            return await action_factory()
        except Exception as err:
            last_error = err
            if attempt < attempts:
                await asyncio.sleep(delay_seconds)
    if last_error:
        raise last_error
    raise RuntimeError("AI action failed without error context")

def _can_use_openai_fallback(settings) -> bool:
    return bool((settings.openai_api_key or "").strip())

async def _try_openai_fallback(
    settings,
    admin_client: AsyncClient,
    action: Callable[[AIAnalyzer], Awaitable[dict]],
) -> Optional[dict]:
    """
    One-shot provider failover:
    if primary provider is Gemini, retry once via OpenAI-compatible provider (Groq).
    """
    if settings.ai_provider != "gemini" or not _can_use_openai_fallback(settings):
        return None
    fallback_settings = settings.model_copy(update={"ai_provider": "openai_compat"})
    fallback_analyzer = AIAnalyzer(fallback_settings, admin_client)
    return await action(fallback_analyzer)


class AnalysisRequest(BaseModel):
    habit_id: Optional[UUID] = None
    date: Optional[date] = None


class InsightFeedback(BaseModel):
    feedback: str  # "helpful", "not_helpful", "inaccurate"
    comment: Optional[str] = None


class CatalystLetterRequest(BaseModel):
    habit_id: Optional[UUID] = None
    tone: str = "tough_love"  # "tough_love", "compassionate", "stoic", "warrior"
    future_date: str = "1 year from now"


class ManifestoRequest(BaseModel):
    habit_id: Optional[UUID] = None
    identity_statement: Optional[str] = None


class OracleChatRequest(BaseModel):
    message: str
    include_history: bool = True


# ---- Daily / Weekly Analysis ----

@router.post("/analyze/daily")
async def trigger_daily_analysis(
    data: AnalysisRequest,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """
    Trigger AI daily analysis for the user.
    Analyzes all check-ins, journal entries, mood data for the day.
    """
    settings = get_settings()
    admin_client = await get_supabase_admin()
    analyzer = AIAnalyzer(settings, admin_client)
    
    # Run analysis (can be backgrounded but user wants to see it immediately for now)
    result = await analyzer.analyze_daily(str(user.id), data.date or date.today())

    return {
        "message": "Daily analysis complete. Your forge is glowing. 🔥",
        "status": "success",
        "analysis": result
    }


@router.post("/analyze/weekly")
async def trigger_weekly_analysis(
    data: AnalysisRequest,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Trigger AI weekly review."""
    settings = get_settings()
    admin_client = await get_supabase_admin()
    analyzer = AIAnalyzer(settings, admin_client)
    
    result = await analyzer.analyze_weekly(str(user.id))

    return {
        "message": "Weekly review complete. Strategic adjustments identified. 🏛️",
        "status": "success",
        "analysis": result
    }


# ---- Insights ----

@router.get("/insights")
async def list_insights(
    analysis_type: Optional[str] = None,
    limit: int = Query(20, le=50),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Get AI-generated insights (paginated)."""
    query = (
        client.table("ai_analyses")
        .select("*")
        .eq("user_id", str(user.id))
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )

    if analysis_type:
        query = query.eq("analysis_type", analysis_type)

    response = await query.execute()
    return {"insights": response.data, "total": len(response.data)}


@router.get("/insights/{insight_id}")
async def get_insight(
    insight_id: UUID,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Get full detail of an AI insight."""
    response = await (
        client.table("ai_analyses")
        .select("*")
        .eq("id", str(insight_id))
        .eq("user_id", str(user.id))
        .single()
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Insight not found")

    # Note: is_read removed because column does not exist in the remote DB schema.
    # if not response.data.get("is_read"):
    #     await (
    #         client.table("ai_analyses")
    #         .update({"is_read": True})
    #         .eq("id", str(insight_id))
    #         .execute()
    #     )

    return response.data


@router.delete("/insights/{insight_id}")
async def delete_insight(
    insight_id: UUID,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Delete an AI analysis."""
    response = (
        await client.table("ai_analyses")
        .delete()
        .eq("id", str(insight_id))
        .eq("user_id", str(user.id))
        .execute()
    )
    return {"message": "Insight purged."}


@router.post("/insights/{insight_id}/feedback")
async def submit_insight_feedback(
    insight_id: UUID,
    data: InsightFeedback,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Submit feedback on an AI insight."""
    await (
        client.table("ai_analyses")
        .update({"user_feedback": data.feedback})
        .eq("id", str(insight_id))
        .eq("user_id", str(user.id))
        .execute()
    )
    return {"message": "Feedback recorded. The AI learns from your honesty."}


# ---- Hero Mode ----

@router.get("/hero/chapters")
async def get_hero_chapters(
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Get all Hero Mode chapters."""
    response = await (
        client.table("hero_chapters")
        .select("*")
        .eq("user_id", str(user.id))
        .order("chapter_number", desc=True)
        .execute()
    )
    return {"chapters": response.data}


@router.post("/hero/generate")
async def generate_hero_chapter(
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Force-generate a new Hero Mode chapter."""
    settings = get_settings()
    admin_client = await get_supabase_admin()
    analyzer = AIAnalyzer(settings, admin_client)

    try:
        chapter = await _run_with_retries(
            lambda: analyzer.generate_hero_chapter(str(user.id)),
            attempts=3,
            delay_seconds=1.2,
        )
        return {
            "message": "Your chapter has been forged in the deep fire.",
            "chapter": chapter
        }
    except Exception as e:
        try:
            alt_chapter = await _try_openai_fallback(
                settings,
                admin_client,
                lambda alt: alt.generate_hero_chapter(str(user.id)),
            )
            if alt_chapter:
                return {
                    "message": "Gemini was unavailable. Switched to Groq for this chapter.",
                    "chapter": alt_chapter,
                    "provider": "openai_compat",
                }
        except Exception:
            pass
        # Fallback path when AI provider is temporarily unavailable.
        end_date = date.today()
        start_date = end_date - timedelta(days=7)
        chapters_resp = await (
            client.table("hero_chapters")
            .select("chapter_number")
            .eq("user_id", str(user.id))
            .order("chapter_number", desc=True)
            .limit(1)
            .execute()
        )
        next_chapter = (chapters_resp.data[0]["chapter_number"] + 1) if chapters_resp.data else 1

        fallback_chapter = {
            "title": f"Chapter {next_chapter}: Hold The Line",
            "narrative": (
                "AI narration is temporarily unavailable, but your progress is still real. "
                "This week, your mission is simple: keep showing up daily, protect your morning routine, "
                "and win one hard moment each day."
            ),
        }
        # Insert only conservative columns to stay compatible with schema variants.
        await (
            client.table("hero_chapters")
            .insert({
                "user_id": str(user.id),
                "chapter_number": next_chapter,
                "title": fallback_chapter["title"],
                "narrative": fallback_chapter["narrative"],
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat(),
            })
            .execute()
        )
        return {
            "message": f"Hero chapter generated in fallback mode ({str(e)[:90]}).",
            "chapter": fallback_chapter
        }


# ---- Catalyst Forge ----

@router.post("/catalyst/letter")
async def generate_catalyst_letter(
    data: CatalystLetterRequest,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Generate a letter to your future self."""
    settings = get_settings()
    admin_client = await get_supabase_admin()
    analyzer = AIAnalyzer(settings, admin_client)
    
    try:
        result = await _run_with_retries(
            lambda: analyzer.generate_catalyst_letter(
                str(user.id),
                data.tone,
                str(data.habit_id) if data.habit_id else None,
            ),
            attempts=3,
            delay_seconds=1.0,
        )
        return {
            "message": "Your letter has been written by fire...", 
            "status": "success",
            "letter": result["letter"],
            "tone": result["tone"]
        }
    except Exception:
        try:
            alt_result = await _try_openai_fallback(
                settings,
                admin_client,
                lambda alt: alt.generate_catalyst_letter(
                    str(user.id),
                    data.tone,
                    str(data.habit_id) if data.habit_id else None,
                ),
            )
            if alt_result:
                return {
                    "message": "Gemini was unavailable. Switched to Groq for this letter.",
                    "status": "success",
                    "letter": alt_result["letter"],
                    "tone": alt_result["tone"],
                    "provider": "openai_compat",
                }
        except Exception:
            pass
        return {
            "message": "AI is temporarily overloaded. Fallback letter generated.",
            "status": "fallback",
            "letter": (
                "You do not need perfect conditions to become who you promised to be. "
                "Today, protect one decision: no self-sabotage. One clean day is a brick in your new life."
            ),
            "tone": data.tone
        }


@router.post("/catalyst/manifesto")
async def generate_manifesto(
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Generate a powerful voice manifesto text."""
    settings = get_settings()
    admin_client = await get_supabase_admin()
    analyzer = AIAnalyzer(settings, admin_client)
    
    try:
        result = await _run_with_retries(
            lambda: analyzer.generate_manifesto(str(user.id)),
            attempts=3,
            delay_seconds=1.0,
        )
        return {
            "message": "Your manifesto has been forged...", 
            "status": "success",
            "manifesto": result.get("manifesto"),
            "principles": result.get("core_principles"),
            "oath": result.get("daily_oath")
        }
    except Exception:
        try:
            alt_result = await _try_openai_fallback(
                settings,
                admin_client,
                lambda alt: alt.generate_manifesto(str(user.id)),
            )
            if alt_result:
                return {
                    "message": "Gemini was unavailable. Switched to Groq for this manifesto.",
                    "status": "success",
                    "manifesto": alt_result.get("manifesto"),
                    "principles": alt_result.get("core_principles"),
                    "oath": alt_result.get("daily_oath"),
                    "provider": "openai_compat",
                }
        except Exception:
            pass
        return {
            "message": "AI is temporarily overloaded. Fallback manifesto generated.",
            "status": "fallback",
            "manifesto": (
                "I choose discipline over impulse. I choose truth over comfort. "
                "I build my future through daily action, not promises."
            ),
            "principles": [
                "One hard choice every day.",
                "No negotiation with old patterns.",
                "Track reality, not excuses.",
            ],
            "oath": "Today I act as the person I am becoming."
        }


# ---- Pain Projections ----

@router.get("/pain-projection/{habit_id}")
async def get_pain_projection(
    habit_id: UUID,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Get pain accumulator / consequence visualization data."""
    response = await (
        client.table("pain_projections")
        .select("*")
        .eq("habit_id", str(habit_id))
        .eq("user_id", str(user.id))
        .order("projection_months")
        .execute()
    )
    return {"projections": response.data}


@router.post("/pain-projection/{habit_id}/generate")
async def generate_pain_projection(
    habit_id: UUID,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Trigger generation of pain projections for a habit."""
    settings = get_settings()
    admin_client = await get_supabase_admin()
    analyzer = AIAnalyzer(settings, admin_client)
    
    projections = await analyzer.generate_pain_projection(str(user.id), str(habit_id))
    return {"message": "Pain projections forged.", "projections": projections}


# ---- Oracle Chat ----

@router.get("/oracle/history")
async def get_oracle_chat_history(
    limit: int = Query(50, le=100),
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Get the conversation history with the Oracle."""
    response = await (
        client.table("oracle_chats")
        .select("*")
        .eq("user_id", str(user.id))
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    # Return in chronological order
    history = response.data or []
    history.reverse()
    return {"history": history}


@router.post("/oracle/chat")
async def chat_with_oracle(
    data: OracleChatRequest,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """
    Send a message to the Oracle and get a context-aware response.
    """
    settings = get_settings()
    admin_client = await get_supabase_admin()
    analyzer = AIAnalyzer(settings, admin_client)
    
    # 1. Store user message
    await client.table("oracle_chats").insert({
        "user_id": str(user.id),
        "role": "user",
        "content": data.message,
    }).execute()

    # 2. Get recent history for context
    history_resp = await (
        client.table("oracle_chats")
        .select("role, content")
        .eq("user_id", str(user.id))
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    history = history_resp.data or []
    history.reverse()

    # 3. Generate Oracle response
    try:
        result = await analyzer.chat_with_oracle(
            user_id=str(user.id),
            message=data.message,
            history=history
        )
        
        # 4. Store Oracle response
        await client.table("oracle_chats").insert({
            "user_id": str(user.id),
            "role": "assistant",
            "content": result.get("response", "The Oracle is silent..."),
            "metadata": {
                "suggested_actions": result.get("suggested_actions"),
                "mood_detected": result.get("mood_detected"),
                "threat_level": result.get("threat_level")
            }
        }).execute()

        return result
        
    except Exception as e:
        # Simple fallback if AI fails
        error_msg = f"The Forge is currently unstable. Try again in a moment. ({str(e)[:50]})"
        return {
            "response": error_msg,
            "suggested_actions": [],
            "mood_detected": "neutral",
            "threat_level": 1
        }

