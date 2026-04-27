"""
Catalyst Forge — AI Analyzer Engine
The heart of the system. Generates daily/weekly analyses using Gemini + RAG.
"""
import json
from datetime import date, timedelta
from google import genai
from google.genai import types
from openai import AsyncOpenAI
from supabase import AsyncClient

from app.config import Settings
from app.ai.rag import RAGPipeline
from app.ai.prompts import (
    SYSTEM_PROMPT,
    DAILY_ANALYSIS_PROMPT,
    HERO_CHAPTER_PROMPT,
    CATALYST_LETTER_PROMPT,
    WEEKLY_ANALYSIS_PROMPT,
    PAIN_PROJECTION_PROMPT,
    IDENTITY_AFFIRMATION_PROMPT,
    MANIFESTO_PROMPT,
)


class AIAnalyzer:
    """Core AI analysis engine powered by Gemini 2.5 Flash + RAG."""

    def __init__(self, settings: Settings, db_client: AsyncClient):
        self.settings = settings
        self.db = db_client
        self.rag = RAGPipeline(settings, db_client)
        
        # Initialize the appropriate client
        if settings.ai_provider == "gemini":
            print(f"[AI] Initializing Gemini client...")
            self.gemini_client = genai.Client(api_key=settings.gemini_api_key)
            self.openai_client = None
        else:
            print(f"[AI] Initializing OpenAI-compatible client ({settings.openai_base_url})...")
            self.openai_client = AsyncOpenAI(
                api_key=settings.openai_api_key,
                base_url=settings.openai_base_url
            )
            self.gemini_client = None

    async def _generate(self, prompt: str, temperature: float = 0.7) -> dict:
        """Generate a JSON response from the selected AI provider."""
        if self.settings.ai_provider == "gemini":
            response = self.gemini_client.models.generate_content(
                model=self.settings.gemini_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=temperature,
                    max_output_tokens=16384,
                    response_mime_type="application/json",
                ),
            )
            return self._parse_json_response(response.text)
        else:
            # OpenAI-compatible providers (Groq, DeepSeek, etc.)
            response = await self.openai_client.chat.completions.create(
                model=self.settings.openai_model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content
            return self._parse_json_response(content)

    @staticmethod
    def _parse_json_response(text: str) -> dict:
        """Parse JSON from AI response, handling extra data or markdown fences."""
        # Strip markdown fences if present
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Gemini sometimes returns extra data after the JSON object.
            # Find the first complete JSON object by matching braces.
            depth = 0
            start = cleaned.index("{")
            for i, ch in enumerate(cleaned[start:], start):
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        return json.loads(cleaned[start:i + 1])
            # Last resort: try loading up to the first closing brace at depth 0
            raise

    async def analyze_daily(self, user_id: str, target_date: date | None = None) -> dict:
        """
        Perform a comprehensive daily analysis.
        Gathers all data → RAG retrieval → Gemini analysis → store result.
        """
        if target_date is None:
            target_date = date.today()

        date_str = target_date.isoformat()
        print(f"[AI] Starting daily analysis for user {user_id}, date {date_str}")

        # 1. Gather user data
        profile = await self._get_profile(user_id)
        checkins = await self._get_checkins(user_id, date_str)
        journals = await self._get_journals(user_id, date_str)
        habits = await self._get_active_habits(user_id)
        streaks = self._format_streaks(habits)
        print(f"[AI] Data gathered: {len(checkins)} checkins, {len(journals)} journals, {len(habits)} habits")

        # 2. Build query for RAG
        query_parts = []
        for c in checkins:
            if c.get("notes"):
                query_parts.append(c["notes"])
            if c.get("relapse_trigger"):
                query_parts.append(f"trigger: {c['relapse_trigger']}")
        for j in journals:
            if j.get("transcript"):
                query_parts.append(j["transcript"])
            elif j.get("raw_text"):
                query_parts.append(j["raw_text"])

        query = " ".join(query_parts) if query_parts else "daily check-in motivation habit struggle"

        # 3. RAG retrieval (gracefully degrades)
        print("[AI] Running RAG retrieval...")
        rag_context = await self.rag.build_context(
            user_id=user_id,
            query=query,
            habit_category=habits[0]["category"] if habits else None,
        )

        # 4. Build prompt
        prompt = DAILY_ANALYSIS_PROMPT.format(
            display_name=profile.get("display_name", "Warrior"),
            identity_statement=profile.get("current_identity_statement", "Not set yet"),
            member_since=profile.get("created_at", "Unknown"),
            date=date_str,
            checkins_data=json.dumps(checkins, indent=2, default=str),
            journal_data=json.dumps(journals, indent=2, default=str),
            habits_data=json.dumps(habits, indent=2, default=str),
            streaks_data=streaks,
            personal_context=rag_context["personal_context"],
            knowledge_context=rag_context["knowledge_context"],
        )

        # 5. Generate analysis
        print("[AI] Calling Gemini for daily analysis...")
        analysis = await self._generate(prompt, temperature=0.9)
        print(f"[AI] Analysis generated: {analysis.get('title', 'Untitled')}")

        # 6. Store in database
        stored = await (
            self.db.table("ai_analyses")
            .insert({
                "user_id": user_id,
                "analysis_type": "daily_review",
                "title": analysis.get("title", f"Daily Analysis — {date_str}"),
                "summary": analysis.get("summary", ""),
                "full_analysis": analysis.get("full_analysis", ""),
                "insights": analysis.get("insights"),
                "recommendations": analysis.get("recommendations"),
                "trigger_patterns": analysis.get("trigger_patterns"),
                "tomorrow_action": analysis.get("tomorrow_action", ""),
                "motivational_close": analysis.get("motivational_close", ""),
                "severity_score": max(
                    (i.get("severity", 5) for i in analysis.get("insights", [{"severity": 5}])),
                    default=5,
                ),
                "confidence_score": 0.85,
                "period_start": date_str,
                "period_end": date_str,
            })
            .execute()
        )
        print(f"[AI] Analysis stored in DB: {stored.data[0]['id']}")

        # 7. Embed the analysis summary for future RAG (non-critical)
        try:
            await self.rag.embed_and_store_user_document(
                user_id=user_id,
                source_type="analysis",
                source_id=stored.data[0]["id"],
                content=f"{analysis.get('summary', '')} {analysis.get('full_analysis', '')}",
            )
        except Exception as e:
            print(f"[AI] Embedding storage skipped (non-critical): {e}")

        # 8. Mark checkins as processed (non-critical)
        for c in checkins:
            try:
                await (
                    self.db.table("checkins")
                    .update({"ai_processed": True, "ai_insights": analysis.get("insights")})
                    .eq("id", c["id"])
                    .execute()
                )
            except Exception as e:
                print(f"[AI] Checkin update skipped: {e}")

        print("[AI] Daily analysis complete!")
        return analysis

    async def generate_hero_chapter(self, user_id: str) -> dict:
        """Generate a Hero Mode chapter covering the last 7 days."""
        profile = await self._get_profile(user_id)
        habits = await self._get_active_habits(user_id)
        end_date = date.today()
        start_date = end_date - timedelta(days=7)

        # Get existing chapters count
        chapters_resp = await (
            self.db.table("hero_chapters")
            .select("chapter_number")
            .eq("user_id", user_id)
            .order("chapter_number", desc=True)
            .limit(1)
            .execute()
        )
        next_chapter = (chapters_resp.data[0]["chapter_number"] + 1) if chapters_resp.data else 1

        # Get week's checkins
        checkins = await (
            self.db.table("checkins")
            .select("*")
            .eq("user_id", user_id)
            .gte("date", start_date.isoformat())
            .lte("date", end_date.isoformat())
            .execute()
        )

        victories = [c for c in (checkins.data or []) if c["result"] == "success"]
        defeats = [c for c in (checkins.data or []) if c["result"] == "relapse"]

        prompt = HERO_CHAPTER_PROMPT.format(
            chapter_number=next_chapter,
            display_name=profile.get("display_name", "The Warrior"),
            habits_summary=", ".join(h["name"] for h in habits),
            identity_statement=profile.get("current_identity_statement", "Becoming unstoppable"),
            period_start=start_date.isoformat(),
            period_end=end_date.isoformat(),
            victories=json.dumps(victories, default=str),
            defeats=json.dumps(defeats, default=str),
            key_moments="See victories and defeats above",
            emotional_data="Derived from check-in mood scores",
            previous_chapters="First chapter" if next_chapter == 1 else "Previous chapters exist",
        )

        chapter = await self._generate(prompt, temperature=0.9)

        # Store chapter
        await (
            self.db.table("hero_chapters")
            .insert({
                "user_id": user_id,
                "chapter_number": next_chapter,
                "title": chapter.get("title", f"Chapter {next_chapter}"),
                "narrative": chapter.get("narrative", ""),
                "victories": chapter.get("victories"),
                "battles": chapter.get("battles"),
                "character_growth": chapter.get("character_growth", ""),
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat(),
            })
            .execute()
        )

        return chapter

    async def analyze_weekly(self, user_id: str) -> dict:
        """
        Perform a strategic weekly review.
        Aggregates last 7 days of daily insights + stats + themes.
        """
        end_date = date.today()
        start_date = end_date - timedelta(days=7)
        period_start = start_date.isoformat()
        period_end = end_date.isoformat()

        print(f"[AI] Starting weekly review for user {user_id}, {period_start} to {period_end}")

        # 1. Gather data
        profile = await self._get_profile(user_id)
        habits = await self._get_active_habits(user_id)
        
        # Get daily insights from the week
        daily_insights_resp = await (
            self.db.table("ai_analyses")
            .select("title, summary, created_at")
            .eq("user_id", user_id)
            .eq("analysis_type", "daily_review")
            .gte("created_at", f"{period_start}T00:00:00")
            .lte("created_at", f"{period_end}T23:59:59")
            .execute()
        )
        daily_summary = "\n".join([f"- {i['created_at'][:10]}: {i['title']} - {i['summary']}" for i in daily_insights_resp.data])

        # Get stats summary
        checkins_resp = await (
            self.db.table("checkins")
            .select("result, relapse_trigger")
            .eq("user_id", user_id)
            .gte("date", period_start)
            .lte("date", period_end)
            .execute()
        )
        checkins = checkins_resp.data or []
        victories = len([c for c in checkins if c["result"] == "success"])
        relapses = len([c for c in checkins if c["result"] == "relapse"])
        triggers = {}
        for c in checkins:
            if c.get("relapse_trigger"):
                triggers[c["relapse_trigger"]] = triggers.get(c["relapse_trigger"], 0) + 1
        
        stats_summary = f"Victories: {victories}, Relapses: {relapses}. Top Triggers: {json.dumps(triggers)}"

        # 2. Build Prompt
        prompt = WEEKLY_ANALYSIS_PROMPT.format(
            display_name=profile.get("display_name", "Warrior"),
            identity_statement=profile.get("current_identity_statement", "Not set yet"),
            period_start=period_start,
            period_end=period_end,
            daily_insights_summary=daily_summary or "No daily insights generated this week.",
            stats_summary=stats_summary,
            habits_data=json.dumps(habits, indent=2, default=str),
            streaks_data=self._format_streaks(habits),
            journal_themes="Deep analysis of identity and struggle patterns.",
        )

        # 3. Generate
        print("[AI] Calling Gemini for weekly review...")
        analysis = await self._generate(prompt, temperature=0.9)

        # 4. Store
        stored = await (
            self.db.table("ai_analyses")
            .insert({
                "user_id": user_id,
                "analysis_type": "weekly_review",
                "title": analysis.get("title", f"Weekly Review: {period_start} to {period_end}"),
                "summary": analysis.get("summary", ""),
                "full_analysis": analysis.get("full_analysis", ""),
                "insights": analysis.get("strategic_adjustments"),
                "recommendations": analysis.get("strategic_adjustments"),
                "trigger_patterns": analysis.get("systemic_weaknesses"),
                "tomorrow_action": analysis.get("next_week_objective", ""),
                "motivational_close": analysis.get("commander_briefing", ""),
                "severity_score": 5,
                "confidence_score": 0.85,
                "period_start": period_start,
                "period_end": period_end,
            })
            .execute()
        )
        print(f"[AI] Weekly review stored: {stored.data[0]['id']}")
        return analysis

    async def generate_catalyst_letter(
        self,
        user_id: str,
        tone: str = "tough_love",
        habit_id: str | None = None,
    ) -> dict:
        """
        Generate a letter from the user's future self.
        Uses RAG for deep personal context.
        """
        print(f"[AI] Generating catalyst letter for user {user_id}, tone: {tone}")
        profile = await self._get_profile(user_id)
        habits = await self._get_active_habits(user_id)
        target_habit = None
        if habit_id:
            target_habit = next((habit for habit in habits if habit["id"] == habit_id), None)
        if target_habit is None and habits:
            target_habit = habits[0]
        
        # Aggregate a bit of journey data
        checkins_query = (
            self.db.table("checkins")
            .select("result, date")
            .eq("user_id", user_id)
            .order("date", desc=True)
            .limit(50)
        )
        if target_habit:
            checkins_query = checkins_query.eq("habit_id", target_habit["id"])

        checkins_resp = await checkins_query.execute()
        checkins = checkins_resp.data or []
        success_count = len([c for c in checkins if c["result"] == "success"])
        
        journey_summary = f"In the last 50 tracked days, you had {success_count} victories. "
        if target_habit:
            journey_summary += (
                f"Your focus front is {target_habit['name']} "
                f"with {target_habit['current_streak_days']} clean days."
            )
        elif habits:
            journey_summary += (
                f"Your current strongest front is {habits[0]['name']} "
                f"with {habits[0]['current_streak_days']} days."
            )

        # RAG context for deep feelings
        rag_context = await self.rag.build_context(
            user_id=user_id,
            query=(
                f"my struggles with {target_habit['name']}, why I want to change, my vision for the future"
                if target_habit
                else "my struggles, why I want to change, my vision for the future"
            ),
            habit_category=target_habit["category"] if target_habit else None,
        )

        # Build prompt
        prompt = CATALYST_LETTER_PROMPT.format(
            display_name=profile.get("display_name", "Warrior"),
            habit_name=target_habit["name"] if target_habit else "your habits",
            category=target_habit["category"] if target_habit else "general",
            current_streak=target_habit["current_streak_days"] if target_habit else 0,
            total_relapses=target_habit["total_relapses"] if target_habit else 0,
            user_notes=rag_context["personal_context"][:1000],
            journey_summary=journey_summary,
            tone=tone,
            knowledge_context=rag_context["knowledge_context"],
        )

        # Generate (not JSON this time, just text)
        if self.settings.ai_provider == "gemini":
            response = self.gemini_client.models.generate_content(
                model=self.settings.gemini_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.9,
                ),
            )
            letter_text = response.text
        else:
            resp = await self.openai_client.chat.completions.create(
                model=self.settings.openai_model,
                messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
                temperature=0.9,
            )
            letter_text = resp.choices[0].message.content

        return {"letter": letter_text, "tone": tone}

    async def generate_manifesto(self, user_id: str) -> dict:
        """
        Generate a personalized voice manifesto.
        """
        print(f"[AI] Generating manifesto for user {user_id}")
        profile = await self._get_profile(user_id)
        habits = await self._get_active_habits(user_id)
        
        # RAG context for their specific pain and vision
        rag_context = await self.rag.build_context(
            user_id=user_id,
            query="my deepest values, my reasons for fighting, my future self",
        )

        prompt = MANIFESTO_PROMPT.format(
            display_name=profile.get("display_name", "Warrior"),
            identity_statement=profile.get("current_identity_statement", "Becoming unstoppable"),
            habits_summary=", ".join(h["name"] for h in habits),
            personal_context=rag_context["personal_context"],
        )

        return await self._generate(prompt, temperature=0.9)

    async def generate_pain_projection(self, user_id: str, habit_id: str) -> list:
        """
        Calculate and store the true cost of a habit over time.
        """
        print(f"[AI] Generating pain projection for habit {habit_id}")
        
        # Get habit data
        habit_resp = await self.db.table("habits").select("*").eq("id", habit_id).eq("user_id", user_id).single().execute()
        habit = habit_resp.data
        if not habit:
            return []

        # Build prompt
        prompt = PAIN_PROJECTION_PROMPT.format(
            habit_name=habit["name"],
            category=habit["category"],
            cost_per_unit=habit.get("cost_per_unit", 0),
            time_per_unit=habit.get("time_per_unit", 0),
            calories_per_unit=habit.get("calories_per_unit", 0),
            avg_usage=habit.get("units_per_day", 1),
            unit_name=habit.get("unit_name", "units"),
            current_streak=habit.get("current_streak_days", 0),
            total_relapses=habit.get("total_relapses", 0),
        )

        # Generate (Expects a JSON array of objects)
        projections = await self._generate(prompt, temperature=0.5)
        
        # Projections is likely the list directly if model followed prompt well
        if isinstance(projections, dict) and "projections" in projections:
            projections = projections["projections"]
        
        # Store in DB (Clean old ones first)
        await self.db.table("pain_projections").delete().eq("habit_id", habit_id).eq("user_id", user_id).execute()
        
        for p in projections:
            p["user_id"] = user_id
            p["habit_id"] = habit_id
            await self.db.table("pain_projections").insert(p).execute()

        return projections

    # ---- Helper methods ----

    async def _get_profile(self, user_id: str) -> dict:
        resp = await self.db.table("profiles").select("*").eq("id", user_id).single().execute()
        return resp.data or {}

    async def _get_checkins(self, user_id: str, date_str: str) -> list[dict]:
        resp = await (
            self.db.table("checkins")
            .select("*")
            .eq("user_id", user_id)
            .eq("date", date_str)
            .execute()
        )
        return resp.data or []

    async def _get_journals(self, user_id: str, date_str: str) -> list[dict]:
        resp = await (
            self.db.table("journal_entries")
            .select("*")
            .eq("user_id", user_id)
            .gte("created_at", f"{date_str}T00:00:00")
            .lte("created_at", f"{date_str}T23:59:59")
            .execute()
        )
        return resp.data or []

    async def _get_active_habits(self, user_id: str) -> list[dict]:
        resp = await (
            self.db.table("habits")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )
        return resp.data or []

    def _format_streaks(self, habits: list[dict]) -> str:
        if not habits:
            return "No active habits."
        lines = []
        for h in habits:
            lines.append(
                f"- {h['name']}: {h['current_streak_days']} days "
                f"(best: {h['best_streak_days']}, relapses: {h['total_relapses']})"
            )
        return "\n".join(lines)
