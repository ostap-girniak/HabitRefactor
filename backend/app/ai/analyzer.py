"""
Catalyst Forge — AI Analyzer Engine
The heart of the system. Generates daily/weekly analyses using Gemini + RAG.
"""
import json
import re
from datetime import date, timedelta
from google import genai
from google.genai import types
from openai import AsyncOpenAI
from postgrest.exceptions import APIError
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
    ORACLE_CHAT_PROMPT,
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

    @staticmethod
    def _normalize_language(profile: dict, preferred_language: str | None = None) -> str:
        raw = preferred_language or profile.get("preferred_language") or profile.get("locale") or "uk"
        lang = str(raw).strip().lower()
        return "uk" if lang.startswith("uk") or lang.startswith("ua") else "en"

    @staticmethod
    def _language_label(lang: str) -> str:
        if lang == "uk":
            return (
                "Українська мова (Ukrainian, Cyrillic only). "
                "Every title, summary, paragraph, recommendation, insight, pattern, action, and briefing MUST be written in Ukrainian Cyrillic. "
                "English user-facing text is invalid."
            )
        return "English"

    @staticmethod
    def _as_list(value) -> list:
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            return list(value.values())
        return []

    @staticmethod
    def _as_text(value, default: str = "") -> str:
        if value is None:
            return default
        if isinstance(value, str):
            return value
        return json.dumps(value, ensure_ascii=False, default=str)

    @staticmethod
    def _as_score(value, default: int = 5) -> int:
        if value is None:
            return default
        if isinstance(value, bool):
            return default
        if isinstance(value, (int, float)):
            score = int(round(value))
        else:
            text = str(value).strip().lower()
            named_scores = {
                "critical": 10,
                "severe": 9,
                "high": 8,
                "medium": 5,
                "moderate": 5,
                "low": 3,
                "minor": 2,
            }
            if text in named_scores:
                score = named_scores[text]
            else:
                digits = "".join(ch if ch.isdigit() or ch == "." else " " for ch in text).split()
                try:
                    score = int(round(float(digits[0]))) if digits else default
                except (TypeError, ValueError):
                    score = default
        return max(1, min(10, score))

    @staticmethod
    def _is_latin_heavy(text: str) -> bool:
        latin = len(re.findall(r"[A-Za-z]", text or ""))
        cyrillic = len(re.findall(r"[А-Яа-яІіЇїЄєҐґ]", text or ""))
        return latin >= 30 and latin > cyrillic * 2

    def _needs_ukrainian_fallback(self, analysis: dict, lang: str) -> bool:
        if lang != "uk":
            return False
        sample = " ".join(
            self._as_text(analysis.get(key))
            for key in ("title", "summary", "full_analysis", "tomorrow_action", "motivational_close")
        )
        return self._is_latin_heavy(sample)

    def _build_daily_fallback_analysis(
        self,
        profile: dict,
        checkins: list[dict],
        journals: list[dict],
        habits: list[dict],
        date_str: str,
        lang: str,
        reason: str | None = None,
    ) -> dict:
        relapses = [c for c in checkins if c.get("result") == "relapse"]
        victories = [c for c in checkins if c.get("result") == "success"]
        partials = [c for c in checkins if c.get("result") == "partial"]
        triggers = [c.get("relapse_trigger") for c in checkins if c.get("relapse_trigger")]
        habit_names = [h.get("name", "habit") for h in habits]
        journal_count = len(journals)
        display_name = profile.get("display_name") or "Warrior"

        if lang == "uk":
            main_signal = (
                "ризик зриву" if relapses else
                "нестабільний день" if partials else
                "день контролю" if victories else
                "день для самоспостереження"
            )
            trigger_text = ", ".join(triggers) if triggers else "явних тригерів не зафіксовано"
            habits_text = ", ".join(habit_names) if habit_names else "активних звичок не знайдено"
            technical_note = f"\n\nТехнічна примітка: AI-провайдер не дав стабільну відповідь, тому створено локальний аналіз на основі твоїх даних. Причина: {reason[:160]}" if reason else ""
            return {
                "title": f"Щоденний аналіз: {main_signal}",
                "summary": (
                    f"{display_name}, сьогодні система бачить {len(victories)} перемог, "
                    f"{len(partials)} часткових результатів і {len(relapses)} зривів. "
                    f"Журналів за день: {journal_count}; ключовий сигнал: {trigger_text}."
                ),
                "full_analysis": (
                    f"Дата: {date_str}.\n\n"
                    f"Твої активні фронти: {habits_text}.\n\n"
                    f"Головний патерн дня: {main_signal}. Якщо були зриви або часткові результати, це не вирок, а дані. "
                    f"Дані показують, де саме система дала слабину, і завтра це місце треба закрити конкретною дією.\n\n"
                    f"Тригери: {trigger_text}. Не сперечайся з тригером у моменті. Заздалегідь постав бар'єр: прибери стимул, зміни маршрут, "
                    f"зроби паузу на 10 хвилин і переключи тіло на фізичну дію.\n\n"
                    f"Твоя задача не виглядати сильним, а діяти як людина, яка будує силу через повторення. Один чесний день важить більше, ніж сто обіцянок."
                    f"{technical_note}"
                ),
                "insights": [
                    {
                        "type": "pattern",
                        "title": "Дані важливіші за настрій",
                        "description": f"Сьогодні зафіксовано {len(checkins)} чекінів і {journal_count} записів журналу. Це вже матеріал для роботи, навіть якщо день був нерівний.",
                        "severity": 5,
                    },
                    {
                        "type": "warning" if relapses else "victory",
                        "title": "Контроль будується до тригера",
                        "description": f"Ключові тригери: {trigger_text}. Наступний крок — підготувати відповідь до того, як імпульс стане сильним.",
                        "severity": 7 if relapses else 4,
                    },
                ],
                "recommendations": [
                    {
                        "type": "action",
                        "title": "10-хвилинний бар'єр",
                        "description": "Коли з'явиться потяг до старої звички, постав таймер на 10 хвилин і зроби одну фізичну дію: душ, прогулянка, віджимання або вода. Не думай, рухайся.",
                    }
                ],
                "trigger_patterns": [
                    {
                        "trigger": trigger_text,
                        "frequency": "за сьогоднішніми записами",
                        "correlation": "Тригер треба зустрічати не силою волі, а заготовленим сценарієм.",
                    }
                ],
                "tomorrow_action": "Завтра перед першим ризиковим моментом зроби 10-хвилинний бар'єр і запиши результат у журнал.",
                "motivational_close": "Ти не програєш, коли бачиш правду. Ти програєш, коли перестаєш діяти.",
            }

        trigger_text = ", ".join(triggers) if triggers else "no explicit triggers logged"
        return {
            "title": "Daily analysis: control checkpoint",
            "summary": f"{display_name}, today shows {len(victories)} wins, {len(partials)} partials, and {len(relapses)} relapses. Journal entries: {journal_count}.",
            "full_analysis": f"Date: {date_str}.\n\nTriggers: {trigger_text}. Use this as data, not judgment. Tomorrow, build one concrete barrier before the risky moment.",
            "insights": [{"type": "pattern", "title": "Data beats mood", "description": "Your logs create a clearer system map.", "severity": 5}],
            "recommendations": [{"type": "action", "title": "10-minute barrier", "description": "When an urge appears, delay for 10 minutes and move your body."}],
            "trigger_patterns": [{"trigger": trigger_text, "frequency": "today", "correlation": "Prepare the response before the trigger hits."}],
            "tomorrow_action": "Use a 10-minute barrier before the first risky moment.",
            "motivational_close": "Truth plus action is how you rebuild.",
        }

    def _build_weekly_fallback_analysis(
        self,
        profile: dict,
        habits: list[dict],
        checkins: list[dict],
        triggers: dict,
        period_start: str,
        period_end: str,
        lang: str,
        reason: str | None = None,
    ) -> dict:
        victories = len([c for c in checkins if c.get("result") == "success"])
        relapses = len([c for c in checkins if c.get("result") == "relapse"])
        trigger_text = ", ".join(f"{k}: {v}" for k, v in triggers.items()) if triggers else "явних тригерів не зафіксовано"
        display_name = profile.get("display_name") or "Warrior"
        habit_names = ", ".join(h.get("name", "звичка") for h in habits) if habits else "активних звичок не знайдено"

        if lang == "uk":
            technical_note = f"\n\nТехнічна примітка: AI повернув нестабільну або неукраїнську відповідь, тому створено локальний український огляд. Причина: {reason[:160]}" if reason else ""
            return {
                "title": "Тижневий огляд: система, а не хаос",
                "summary": (
                    f"{display_name}, за період {period_start} - {period_end} зафіксовано {victories} перемог і {relapses} зривів. "
                    f"Головний фокус: {habit_names}. Найважливіші тригери: {trigger_text}."
                ),
                "full_analysis": (
                    f"Цей тиждень показує не твою слабкість, а структуру твоїх ризиків.\n\n"
                    f"Активні фронти: {habit_names}.\n\n"
                    f"Перемоги: {victories}. Зриви: {relapses}. Тригери: {trigger_text}.\n\n"
                    f"Твій наступний крок — не додавати ще більше цілей, а зробити одну систему захисту перед найчастішим тригером. "
                    f"Сила тут не в емоційному ривку, а в повторюваній підготовці."
                    f"{technical_note}"
                ),
                "strategic_adjustments": [
                    {
                        "type": "pattern",
                        "title": "Одна система захисту",
                        "description": "Обери найчастіший тригер тижня і постав перед ним конкретний бар'єр: таймер, зміна середовища, фізична дія або повідомлення людині підтримки.",
                        "severity": 6,
                    }
                ],
                "systemic_weaknesses": [
                    {
                        "trigger": trigger_text,
                        "frequency": "за останні 7 днів",
                        "correlation": "Ризик зростає там, де немає заздалегідь підготовленої відповіді.",
                    }
                ],
                "next_week_objective": "Наступного тижня захисти один найчастіший тригер однією конкретною дією.",
                "commander_briefing": "Менше обіцянок. Більше системи. Один бар'єр, повторений щодня.",
            }

        return {
            "title": "Weekly review: system over chaos",
            "summary": f"{display_name}, this week logged {victories} wins and {relapses} relapses. Main focus: {habit_names}.",
            "full_analysis": f"Period: {period_start} - {period_end}. Triggers: {trigger_text}. Build one barrier before the most common trigger.",
            "strategic_adjustments": [{"type": "pattern", "title": "One protection system", "description": "Protect the most common trigger with one concrete barrier.", "severity": 6}],
            "systemic_weaknesses": [{"trigger": trigger_text, "frequency": "last 7 days", "correlation": "Risk rises where no prepared response exists."}],
            "next_week_objective": "Protect one frequent trigger with one concrete action.",
            "commander_briefing": "Less promising. More system.",
        }

    def _normalize_daily_analysis(self, analysis: dict) -> dict:
        analysis = analysis or {}
        analysis["title"] = self._as_text(analysis.get("title"), "Daily Analysis")
        analysis["summary"] = self._as_text(analysis.get("summary"))
        analysis["full_analysis"] = self._as_text(analysis.get("full_analysis"))
        analysis["insights"] = self._as_list(analysis.get("insights"))
        analysis["recommendations"] = self._as_list(analysis.get("recommendations"))
        analysis["trigger_patterns"] = self._as_list(analysis.get("trigger_patterns"))
        analysis["tomorrow_action"] = self._as_text(analysis.get("tomorrow_action"))
        analysis["motivational_close"] = self._as_text(analysis.get("motivational_close"))
        return analysis

    def _normalize_weekly_analysis(self, analysis: dict) -> dict:
        analysis = analysis or {}
        analysis["title"] = self._as_text(analysis.get("title"), "Weekly Review")
        analysis["summary"] = self._as_text(analysis.get("summary"))
        analysis["full_analysis"] = self._as_text(analysis.get("full_analysis"))
        analysis["strategic_adjustments"] = self._as_list(analysis.get("strategic_adjustments"))
        analysis["systemic_weaknesses"] = self._as_list(analysis.get("systemic_weaknesses"))
        analysis["next_week_objective"] = self._as_text(analysis.get("next_week_objective"))
        analysis["commander_briefing"] = self._as_text(analysis.get("commander_briefing"))
        return analysis

    def _normalize_hero_chapter(self, chapter: dict, chapter_number: int) -> dict:
        chapter = chapter or {}
        chapter["title"] = self._as_text(chapter.get("title"), f"Chapter {chapter_number}")
        chapter["narrative"] = self._as_text(chapter.get("narrative"))
        chapter["victories"] = self._as_list(chapter.get("victories"))
        chapter["battles"] = self._as_list(chapter.get("battles"))
        chapter["character_growth"] = self._as_text(chapter.get("character_growth"))
        return chapter

    async def _insert_ai_analysis(self, row: dict):
        """Insert analysis rows across current and older Supabase schemas."""
        attempts = [row]
        no_action_columns = {
            k: v for k, v in row.items()
            if k not in {"tomorrow_action", "motivational_close"}
        }
        attempts.append(no_action_columns)

        legacy_row = {
            k: v for k, v in no_action_columns.items()
            if k not in {"analysis_type", "insights", "recommendations", "trigger_patterns", "confidence_score"}
        }
        if "analysis_type" in row:
            legacy_row["type"] = row["analysis_type"]
        attempts.append(legacy_row)

        last_error = None
        for attempt in attempts:
            pending = dict(attempt)
            try:
                return await self.db.table("ai_analyses").insert(pending).execute()
            except APIError as err:
                last_error = err
                message = str(err).lower()
                if "schema cache" in message or "could not find" in message:
                    missing_match = re.search(r"'([^']+)' column", str(err))
                    missing_column = missing_match.group(1) if missing_match else None
                    if missing_column and missing_column in pending:
                        pending.pop(missing_column, None)
                        try:
                            return await self.db.table("ai_analyses").insert(pending).execute()
                        except APIError as retry_err:
                            last_error = retry_err
                            continue
                    continue
                raise
        raise last_error

    async def _insert_hero_chapter(self, row: dict):
        """Insert a Hero Mode chapter and return the persisted row."""
        attempts = [
            row,
            {k: v for k, v in row.items() if k not in {"victories", "battles", "character_growth"}},
        ]
        last_error = None
        for attempt in attempts:
            try:
                return await self.db.table("hero_chapters").insert(attempt).execute()
            except APIError as err:
                last_error = err
                message = str(err).lower()
                if "schema cache" in message or "could not find" in message:
                    continue
                raise
        raise last_error

    async def _next_hero_chapter_number(self, user_id: str) -> int:
        chapters_resp = await (
            self.db.table("hero_chapters")
            .select("chapter_number")
            .eq("user_id", user_id)
            .order("chapter_number", desc=True)
            .limit(1)
            .execute()
        )
        return (chapters_resp.data[0]["chapter_number"] + 1) if chapters_resp.data else 1

    async def _previous_hero_chapters_summary(self, user_id: str) -> str:
        chapters_resp = await (
            self.db.table("hero_chapters")
            .select("chapter_number, title, narrative")
            .eq("user_id", user_id)
            .order("chapter_number", desc=True)
            .limit(3)
            .execute()
        )
        chapters = chapters_resp.data or []
        if not chapters:
            return "First chapter"
        return "\n".join(
            f"Chapter {c.get('chapter_number')}: {c.get('title')} - {self._as_text(c.get('narrative'))[:240]}"
            for c in chapters
        )

    def _build_local_hero_chapter(
        self,
        *,
        profile: dict,
        habits: list[dict],
        victories: list[dict],
        defeats: list[dict],
        chapter_number: int,
        period_start: str,
        period_end: str,
        lang: str,
        reason: str | None = None,
    ) -> dict:
        display_name = profile.get("display_name") or "Warrior"
        habit_names = ", ".join(h.get("name", "habit") for h in habits) or "active habits"
        victory_count = len(victories)
        defeat_count = len(defeats)

        if lang == "uk":
            title = f"Глава {chapter_number}: Тиждень, який тримав лінію"
            narrative = (
                f"{display_name} входить у період з {period_start} до {period_end} не як пасивний спостерігач, "
                f"а як людина, що вчиться бачити правду в даних. Поле бою цього тижня: {habit_names}.\n\n"
                f"Система зафіксувала {victory_count} перемог і {defeat_count} програних моментів. "
                "Перемоги показують, що нова ідентичність уже має докази. Поразки не стирають шлях, "
                "вони позначають місця, де старий патерн ще шукає слабкий вхід.\n\n"
                "Ця глава не про ідеальність. Вона про продовження руху після кожного чесного чек-іну. "
                "Наступний тиждень вимагає простого фокусу: один день, одна дія, одна чиста перемога за раз."
            )
            if reason:
                narrative += "\n\nAI-провайдер був тимчасово недоступний, тому глава створена локально на основі твоїх даних."
            character_growth = (
                "Користувач переходить від випадкової боротьби до спостереження за власною системою поведінки."
            )
            victory_label = "Перемога зафіксована в чек-іні"
            defeat_label = "Складний момент зафіксований в чек-іні"
        else:
            title = f"Chapter {chapter_number}: The Week That Held The Line"
            narrative = (
                f"{display_name} enters {period_start} to {period_end} not as a passive observer, "
                f"but as someone learning to read the truth in the data. The battlefield this week: {habit_names}.\n\n"
                f"The system recorded {victory_count} victories and {defeat_count} lost moments. "
                "The wins prove the new identity has evidence. The losses do not erase the path; "
                "they mark where the old pattern still looks for an opening.\n\n"
                "This chapter is not about perfection. It is about continuing after every honest check-in. "
                "Next week asks for one focus: one day, one action, one clean win at a time."
            )
            if reason:
                narrative += "\n\nThe AI provider was temporarily unavailable, so this chapter was generated locally from your data."
            character_growth = "The user is moving from random struggle into conscious observation of their behavior system."
            victory_label = "Victory recorded in check-in"
            defeat_label = "Hard moment recorded in check-in"

        return {
            "title": title,
            "narrative": narrative,
            "victories": [
                {"date": c.get("date"), "description": victory_label}
                for c in victories[:10]
            ],
            "battles": [
                {"date": c.get("date"), "description": defeat_label, "outcome": "loss"}
                for c in defeats[:10]
            ],
            "character_growth": character_growth,
        }

    async def analyze_daily(
        self,
        user_id: str,
        target_date: date | None = None,
        preferred_language: str | None = None,
    ) -> dict:
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
        lang = self._normalize_language(profile, preferred_language)
        response_language = self._language_label(lang)
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
            preferred_language=response_language,
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
        try:
            analysis = await self._generate(prompt, temperature=0.9)
            analysis = self._normalize_daily_analysis(analysis)
            if self._needs_ukrainian_fallback(analysis, lang):
                raise ValueError("AI returned English text while Ukrainian was requested")
        except Exception as err:
            print(f"[AI] Daily AI generation failed; using local fallback: {err}")
            analysis = self._build_daily_fallback_analysis(
                profile=profile,
                checkins=checkins,
                journals=journals,
                habits=habits,
                date_str=date_str,
                lang=lang,
                reason=str(err),
            )
        print(f"[AI] Analysis generated: {analysis.get('title', 'Untitled')}")

        severity_values = [
            self._as_score(item.get("severity", 5))
            for item in analysis.get("insights", [])
            if isinstance(item, dict)
        ]

        # 6. Store in database
        stored = await self._insert_ai_analysis({
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
            "severity_score": max(severity_values, default=5),
            "confidence_score": 0.85,
            "period_start": date_str,
            "period_end": date_str,
        })
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

    async def generate_hero_chapter(
        self,
        user_id: str,
        habit_id: str | None = None,
        preferred_language: str | None = None,
        local_fallback_reason: str | None = None,
    ) -> dict:
        """Generate a Hero Mode chapter covering the last 7 days."""
        profile = await self._get_profile(user_id)
        lang = self._normalize_language(profile, preferred_language)
        response_language = self._language_label(lang)
        all_habits = await self._get_active_habits(user_id)
        habits = all_habits
        if habit_id:
            focused = [h for h in all_habits if str(h.get("id")) == str(habit_id)]
            if focused:
                habits = focused
        end_date = date.today()
        start_date = end_date - timedelta(days=7)
        next_chapter = await self._next_hero_chapter_number(user_id)

        # Get week's checkins
        checkins_query = (
            self.db.table("checkins")
            .select("*")
            .eq("user_id", user_id)
            .gte("date", start_date.isoformat())
            .lte("date", end_date.isoformat())
        )
        if habit_id:
            checkins_query = checkins_query.eq("habit_id", habit_id)
        checkins = await checkins_query.execute()

        victories = [c for c in (checkins.data or []) if c["result"] == "success"]
        defeats = [c for c in (checkins.data or []) if c["result"] == "relapse"]

        if local_fallback_reason:
            chapter = self._build_local_hero_chapter(
                profile=profile,
                habits=habits,
                victories=victories,
                defeats=defeats,
                chapter_number=next_chapter,
                period_start=start_date.isoformat(),
                period_end=end_date.isoformat(),
                lang=lang,
                reason=local_fallback_reason,
            )
        else:
            prompt = HERO_CHAPTER_PROMPT.format(
                chapter_number=next_chapter,
                display_name=profile.get("display_name", "The Warrior"),
                habits_summary=", ".join(h["name"] for h in habits) or "No active habit selected",
                identity_statement=profile.get("current_identity_statement", "Becoming unstoppable"),
                preferred_language=response_language,
                period_start=start_date.isoformat(),
                period_end=end_date.isoformat(),
                victories=json.dumps(victories, default=str, ensure_ascii=False),
                defeats=json.dumps(defeats, default=str, ensure_ascii=False),
                key_moments="See victories and defeats above",
                emotional_data="Derived from check-in mood scores",
                previous_chapters=await self._previous_hero_chapters_summary(user_id),
            )

            chapter = await self._generate(prompt, temperature=0.9)
            chapter = self._normalize_hero_chapter(chapter, next_chapter)
            if lang == "uk" and self._is_latin_heavy(
                f"{chapter.get('title', '')} {chapter.get('narrative', '')} {chapter.get('character_growth', '')}"
            ):
                raise ValueError("Hero Mode returned English text while Ukrainian was requested")

        # Store chapter
        stored = await self._insert_hero_chapter(
            {
                "user_id": user_id,
                "chapter_number": next_chapter,
                "title": chapter.get("title", f"Chapter {next_chapter}"),
                "narrative": chapter.get("narrative", ""),
                "victories": chapter.get("victories"),
                "battles": chapter.get("battles"),
                "character_growth": chapter.get("character_growth", ""),
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat(),
            }
        )

        return (stored.data or [chapter])[0]

    async def analyze_weekly(self, user_id: str, preferred_language: str | None = None) -> dict:
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
        lang = self._normalize_language(profile, preferred_language)
        response_language = self._language_label(lang)
        habits = await self._get_active_habits(user_id)
        
        # Get daily insights from the week
        try:
            daily_insights_resp = await (
                self.db.table("ai_analyses")
                .select("title, summary, created_at")
                .eq("user_id", user_id)
                .eq("analysis_type", "daily_review")
                .gte("created_at", f"{period_start}T00:00:00")
                .lte("created_at", f"{period_end}T23:59:59")
                .execute()
            )
        except APIError as err:
            if "analysis_type" not in str(err):
                raise
            daily_insights_resp = await (
                self.db.table("ai_analyses")
                .select("title, summary, created_at")
                .eq("user_id", user_id)
                .eq("type", "daily_review")
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
            preferred_language=response_language,
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
        try:
            analysis = await self._generate(prompt, temperature=0.9)
            analysis = self._normalize_weekly_analysis(analysis)
            if self._needs_ukrainian_fallback(analysis, lang):
                raise ValueError("AI returned English text while Ukrainian was requested")
        except Exception as err:
            print(f"[AI] Weekly AI generation failed or wrong language; using local fallback: {err}")
            analysis = self._build_weekly_fallback_analysis(
                profile=profile,
                habits=habits,
                checkins=checkins,
                triggers=triggers,
                period_start=period_start,
                period_end=period_end,
                lang=lang,
                reason=str(err),
            )

        # 4. Store
        stored = await self._insert_ai_analysis({
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
    
    async def chat_with_oracle(
        self,
        user_id: str,
        message: str,
        history: list[dict] | None = None,
    ) -> dict:
        """
        Have an interactive chat with the Oracle.
        Uses RAG for context + recent user data for personalization.
        """
        print(f"[AI] Oracle chat for user {user_id}: {message[:50]}...")
        profile = await self._get_profile(user_id)

        # Detect preferred language: use profile setting or infer from message
        preferred_lang = profile.get("preferred_language", "en") or "en"
        lang_label = "Ukrainian (Українська)" if preferred_lang == "uk" else "English"

        # 1. RAG context
        rag_context = await self.rag.build_context(
            user_id=user_id,
            query=message,
            match_count=6,
        )

        # 2. Build rich current context (last 7 days)
        today = date.today()
        week_ago = (today - timedelta(days=7)).isoformat()
        today_str = today.isoformat()

        habits = await self._get_active_habits(user_id)
        habits_summary = ', '.join(h['name'] for h in habits) if habits else "No active habits yet."

        # Recent checkins (7 days)
        checkins_resp = await (
            self.db.table("checkins")
            .select("result, date, relapse_trigger, notes, mood_before, stress_level")
            .eq("user_id", user_id)
            .gte("date", week_ago)
            .lte("date", today_str)
            .order("date", desc=True)
            .limit(20)
            .execute()
        )
        recent_checkins = checkins_resp.data or []
        victories = len([c for c in recent_checkins if c["result"] == "success"])
        relapses = len([c for c in recent_checkins if c["result"] == "relapse"])
        top_triggers = {}
        for c in recent_checkins:
            if c.get("relapse_trigger"):
                top_triggers[c["relapse_trigger"]] = top_triggers.get(c["relapse_trigger"], 0) + 1
        trigger_summary = ", ".join(f"{k}({v}x)" for k, v in sorted(top_triggers.items(), key=lambda x: -x[1])[:3])

        # Recent journal entries (7 days)
        journals_resp = await (
            self.db.table("journal_entries")
            .select("raw_text, transcript, mood_rating, created_at")
            .eq("user_id", user_id)
            .gte("created_at", f"{week_ago}T00:00:00")
            .lte("created_at", f"{today_str}T23:59:59")
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        recent_journals = journals_resp.data or []
        journal_snippets = "\n".join([
            f"- [{j.get('created_at', '')[:10]}] mood={j.get('mood_rating', '?')} | "
            f"{(j.get('transcript') or j.get('raw_text') or '')[:200]}"
            for j in recent_journals
        ]) if recent_journals else "No journal entries this week."

        # Recent AI analyses (last 3 summaries for context)
        analyses_resp = await (
            self.db.table("ai_analyses")
            .select("title, summary, analysis_type, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(3)
            .execute()
        )
        recent_insights = "\n".join([
            f"- [{a.get('created_at', '')[:10]}] {a.get('analysis_type', '')}: {a.get('title', '')} — {(a.get('summary') or '')[:150]}"
            for a in (analyses_resp.data or [])
        ]) or "No previous AI analyses."

        streaks_info = self._format_streaks(habits)

        current_context = (
            f"Active habits: {habits_summary}\n"
            f"Streaks:\n{streaks_info}\n"
            f"Last 7 days: {victories} victories, {relapses} relapses out of {len(recent_checkins)} check-ins.\n"
            f"Top relapse triggers this week: {trigger_summary or 'none recorded'}\n"
            f"Recent journal entries:\n{journal_snippets}"
        )

        # 3. Build prompt
        prompt = ORACLE_CHAT_PROMPT.format(
            display_name=profile.get("display_name", "Warrior"),
            identity_statement=profile.get("current_identity_statement", "Becoming unstoppable"),
            preferred_language=lang_label,
            current_context=current_context,
            recent_insights=recent_insights,
            personal_context=rag_context["personal_context"],
            knowledge_context=rag_context["knowledge_context"],
            knowledge_sources_list=rag_context.get("knowledge_sources_list", "No sources available."),
            history=json.dumps(history or [], indent=2),
            message=message,
        )

        # 4. Generate
        response = await self._generate(prompt, temperature=0.7)

        return response

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
