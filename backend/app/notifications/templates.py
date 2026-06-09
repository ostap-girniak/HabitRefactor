"""
Bilingual notification templates with variety pools.

Each notification type has multiple variants per language. Variants are randomly
chosen so users see fresh, alive copy instead of robotic repetition.

Placeholders use Python str.format style: {streak}, {habit}, {hour}, {name}, etc.
Missing placeholders are tolerated (replaced with empty string) so templates can
be safely simplified.
"""
from __future__ import annotations

import random
from typing import Optional

Lang = str  # "uk" | "en"


def _safe_format(template: str, **kwargs) -> str:
    """str.format that tolerates missing keys."""
    class _SafeDict(dict):
        def __missing__(self, key):
            return ""
    return template.format_map(_SafeDict(**kwargs))


def _pick(pool: list[tuple[str, str]], **kwargs) -> tuple[str, str]:
    """Pick a random (title, body) pair and format it with kwargs."""
    if not pool:
        return ("", "")
    title, body = random.choice(pool)
    return _safe_format(title, **kwargs), _safe_format(body, **kwargs)


def normalize_lang(value: Optional[str]) -> Lang:
    v = (value or "uk").lower().strip()
    if v.startswith("uk"):
        return "uk"
    return "en"


# ---------- Pools ----------

TEST_PUSH = {
    "en": [
        ("🔥 Test push", "Push is working. Stay hard."),
        ("✅ Notifications wired", "You'll hear from us when it matters. Lock in."),
        ("🧪 Test fired", "Bell is alive. War Room is watching."),
        ("📡 Channel open", "When the danger zone hits, this is how we ping you."),
    ],
    "uk": [
        ("🔥 Тестове сповіщення", "Push працює. Stay hard."),
        ("✅ Сповіщення підключені", "Ми скажемо тільки тоді, коли це важливо."),
        ("🧪 Канал перевірено", "Дзвінок живий. Штаб на варті."),
        ("📡 Звʼязок встановлено", "Коли увімкнеться небезпечна зона — ось так ми тебе попередимо."),
    ],
}

DANGER_ZONE_DEFAULT = {
    "en": [
        ("🔥 Danger Zone", "High relapse risk detected. Open your War Room now."),
        ("⚠️ Defense breach incoming", "Patterns say a slip is coming. Stop it before it starts."),
        ("🛡️ Lock in", "Your data flags this hour as high risk. Stand guard."),
        ("⚡ Window of weakness", "Past you fell here. Future you needs this fight."),
    ],
    "uk": [
        ("🔥 Небезпечна зона", "Виявлено високий ризик зриву. Відкрий Штаб негайно."),
        ("⚠️ Зараз буде слабкість", "Патерни кажуть — зрив на підході. Зупини його зараз."),
        ("🛡️ Захист", "Дані позначили цю годину як ризикову. Будь напоготові."),
        ("⚡ Вікно вразливості", "Минулий ти падав тут. Майбутньому ти потрібна ця перемога."),
    ],
}

DANGER_ZONE_MANUAL = {
    "en": [
        ("🔥 Danger Zone (manual check)", "{warning}"),
        ("⚠️ Manual check triggered", "{warning} Stay sharp."),
    ],
    "uk": [
        ("🔥 Небезпечна зона (ручна перевірка)", "{warning}"),
        ("⚠️ Перевірка вручну", "{warning} Будь напоготові."),
    ],
}

JOURNAL_DANGER = {
    "en": [
        ("⚠️ Danger signal detected", "Your journal entry suggests a struggle: \"{snippet}\". Open the app — you're stronger than this."),
        ("🚨 Journal flagged", "Words in your entry match a known relapse pattern: \"{snippet}\". Take 60 seconds — breathe and check in."),
        ("🛡️ Watch yourself", "Your latest entry reads like a warning: \"{snippet}\". Pause. You've beaten worse."),
    ],
    "uk": [
        ("⚠️ Сигнал небезпеки", "Запис у журналі натякає на боротьбу: «{snippet}». Відкрий додаток — ти сильніший за це."),
        ("🚨 Журнал помітив тривогу", "У записі є слова з патерну зриву: «{snippet}». 60 секунд — дихай і зроби чек-ін."),
        ("🛡️ Будь з собою", "Цей запис звучить як попередження: «{snippet}». Пауза. Ти долав і гірше."),
    ],
}

JOURNAL_MOTIVATION_WITH_THEMES = {
    "en": [
        ("💪 Journal analyzed — keep going!", "Themes detected: {themes}. Stay on the path, warrior."),
        ("🧠 Pattern logged", "We picked up: {themes}. The map is getting clearer."),
        ("✍️ Entry filed", "Recurring themes: {themes}. Every word is intel."),
    ],
    "uk": [
        ("💪 Журнал проаналізовано — продовжуй!", "Виявлені теми: {themes}. Тримай курс, воїне."),
        ("🧠 Патерн зафіксовано", "Помічено: {themes}. Карта стає чіткішою."),
        ("✍️ Запис прийнято", "Повторювані теми: {themes}. Кожне слово — це розвідка."),
    ],
}

JOURNAL_MOTIVATION_PLAIN = {
    "en": [
        ("💪 Journal analyzed — keep going!", "Your entry has been recorded. Consistency is the weapon. Stay hard."),
        ("📓 Entry logged", "Another rep for self-awareness. That's how it gets built."),
        ("🔥 Step taken", "You wrote it down. That's already a win. Keep going."),
    ],
    "uk": [
        ("💪 Журнал проаналізовано — продовжуй!", "Запис збережено. Послідовність — твоя зброя. Stay hard."),
        ("📓 Запис прийнято", "Ще одне повторення для самоусвідомлення. Так це й будується."),
        ("🔥 Крок зроблено", "Ти це записав. Це вже перемога. Продовжуй."),
    ],
}

# Pattern-based pre-emptive alerts (scheduler-driven)
PATTERN_HOURLY = {
    "en": [
        ("⚡ High-Risk Hour Approaching", "You tend to relapse around {hour}:00. It's {now} — stay locked in for the next 30 minutes.{trigger_hint}"),
        ("⏰ Danger window opening", "Your data shows {hour}:00 is your weakest hour. {now} now — prepare, don't react.{trigger_hint}"),
    ],
    "uk": [
        ("⚡ Небезпечна година наближається", "Ти зазвичай зриваєшся близько {hour}:00. Зараз {now} — наступні 30 хв трим́айся.{trigger_hint}"),
        ("⏰ Відкривається вікно ризику", "Дані кажуть, {hour}:00 — твоя найслабша година. Зараз {now}. Готуйся, не реагуй.{trigger_hint}"),
    ],
}

PATTERN_HOURLY_TRIGGER_HINT = {
    "en": " Watch out for: {trigger}.",
    "uk": " Обережно з тригером: {trigger}.",
}

PATTERN_WEEKDAY = {
    "en": [
        ("📅 {day} Risk Day", "{day}s have been historically challenging for you. Prepare your defense today."),
        ("🛡️ {day} — eyes open", "Statistically, this day breaks your streak more than others. Stack your defenses."),
    ],
    "uk": [
        ("📅 {day} — ризиковий день", "{day} історично складний для тебе. Готуй захист уже зараз."),
        ("🛡️ {day} — пильнуй", "Статистично цей день ламає твою серію частіше. Захист — на максимум."),
    ],
}

# Map English weekday name -> Ukrainian for templates
WEEKDAY_NAME = {
    "en": {
        "Monday": "Monday", "Tuesday": "Tuesday", "Wednesday": "Wednesday",
        "Thursday": "Thursday", "Friday": "Friday", "Saturday": "Saturday",
        "Sunday": "Sunday",
    },
    "uk": {
        "Monday": "Понеділок", "Tuesday": "Вівторок", "Wednesday": "Середа",
        "Thursday": "Четвер", "Friday": "П'ятниця", "Saturday": "Субота",
        "Sunday": "Неділя",
    },
}

PATTERN_CONSECUTIVE = {
    "en": [
        ("🛡️ Multiple Relapses Detected", "{count} relapses in the last 24 hours. One bad day doesn't have to become two. Open your War Room."),
        ("🚨 Two slips, no third", "{count} relapses in 24h. Stop the spiral right now. Open the app."),
    ],
    "uk": [
        ("🛡️ Виявлено декілька зривів", "{count} зривів за останні 24 години. Поганий день не мусить стати двома. Відкрий Штаб."),
        ("🚨 Два зриви — третього не буде", "{count} зривів за 24 год. Зупини спіраль зараз. Відкрий додаток."),
    ],
}

PATTERN_STREAK = {
    "en": [
        ("⚠️ Streak Danger Zone", "Your {current}-check-in streak is approaching your historical break point (~{avg}). You've been here before. Stay sharp."),
        ("🛑 Familiar territory", "Streak {current} — past you usually fell around {avg}. Different this time. Stay sharp."),
    ],
    "uk": [
        ("⚠️ Серія в зоні ризику", "Твоя серія з {current} чек-інів наближається до історичної точки зриву (~{avg}). Ти вже був тут. Будь напоготові."),
        ("🛑 Знайома територія", "Серія {current} — раніше ти зривався близько {avg}. Цього разу інакше. Тримайся."),
    ],
}

# Streak milestones (NEW — celebratory)
MILESTONE = {
    "en": [
        ("🏆 {days}-day streak", "{habit}: {days} days clean. The old you is dying. The new you is winning."),
        ("⚡ {days} days locked in", "{habit}: {days} consecutive days. This isn't luck. This is identity."),
        ("🔥 {days} clean — keep burning", "{habit}: {days} days. The compound effect is on YOUR side now."),
        ("💪 Day {days}", "{habit}: another day, another vote for the person you're becoming."),
    ],
    "uk": [
        ("🏆 {days} днів серії", "{habit}: {days} днів без зривів. Старий ти помирає. Новий ти перемагає."),
        ("⚡ {days} днів в строю", "{habit}: {days} днів поспіль. Це не везіння. Це ідентичність."),
        ("🔥 {days} чистих — продовжуй горіти", "{habit}: {days} днів. Складний відсоток нарешті працює на ТЕБЕ."),
        ("💪 День {days}", "{habit}: ще один день — ще один голос за людину, якою ти стаєш."),
    ],
}

MILESTONE_DAYS = {1, 3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 1000}

# Defaults for scheduled reminders when title/message blank
SCHEDULED_REMINDER_DEFAULTS = {
    "en": {
        "morning_checkin": ("☀️ Morning check-in", "Set your intent for the day, warrior."),
        "evening_review": ("🌙 Evening review", "Close the day with truth. Open your War Room."),
        "motivation": ("💪 Power dose", "You vs. you. No mediators. Hit the forge."),
        "streak_celebration": ("🏆 Streak update", "Another day on the board. Keep stacking."),
        "danger_zone": ("🔥 Danger Zone", "Watch yourself in the next hour."),
        "custom": ("⏰ Reminder", "Time to check in, warrior."),
    },
    "uk": {
        "morning_checkin": ("☀️ Ранковий чек-ін", "Постав ціль на день, воїне."),
        "evening_review": ("🌙 Вечірній огляд", "Закрий день правдою. Відкрий Штаб."),
        "motivation": ("💪 Доза сили", "Ти проти себе. Без посередників. До Forge."),
        "streak_celebration": ("🏆 Оновлення серії", "Ще один день у скарбничці. Накопичуй."),
        "danger_zone": ("🔥 Небезпечна зона", "Будь обережний наступну годину."),
        "custom": ("⏰ Нагадування", "Час зробити чек-ін, воїне."),
    },
}

# ---------- Public API ----------

def pick_test(lang: Optional[str]) -> tuple[str, str]:
    return _pick(TEST_PUSH[normalize_lang(lang)])


def pick_danger_default(lang: Optional[str]) -> tuple[str, str]:
    return _pick(DANGER_ZONE_DEFAULT[normalize_lang(lang)])


def pick_danger_manual(lang: Optional[str], warning: str = "") -> tuple[str, str]:
    return _pick(DANGER_ZONE_MANUAL[normalize_lang(lang)], warning=warning or "")


def pick_journal_danger(lang: Optional[str], snippet: str) -> tuple[str, str]:
    return _pick(JOURNAL_DANGER[normalize_lang(lang)], snippet=snippet)


def pick_journal_motivation(lang: Optional[str], themes: list[str] | None) -> tuple[str, str]:
    L = normalize_lang(lang)
    if themes:
        return _pick(JOURNAL_MOTIVATION_WITH_THEMES[L], themes=", ".join(themes[:3]))
    return _pick(JOURNAL_MOTIVATION_PLAIN[L])


def pick_pattern_hourly(
    lang: Optional[str], hour: int, now_local: str, trigger: Optional[str]
) -> tuple[str, str]:
    L = normalize_lang(lang)
    trigger_hint = ""
    if trigger:
        trigger_hint = _safe_format(PATTERN_HOURLY_TRIGGER_HINT[L], trigger=trigger)
    return _pick(
        PATTERN_HOURLY[L],
        hour=f"{hour:02d}",
        now=now_local,
        trigger_hint=trigger_hint,
    )


def pick_pattern_weekday(lang: Optional[str], day_en: str) -> tuple[str, str]:
    L = normalize_lang(lang)
    day_name = WEEKDAY_NAME[L].get(day_en, day_en)
    return _pick(PATTERN_WEEKDAY[L], day=day_name)


def pick_pattern_consecutive(lang: Optional[str], count: int) -> tuple[str, str]:
    L = normalize_lang(lang)
    return _pick(PATTERN_CONSECUTIVE[L], count=count)


def pick_pattern_streak(lang: Optional[str], current: int, avg: int) -> tuple[str, str]:
    L = normalize_lang(lang)
    return _pick(PATTERN_STREAK[L], current=current, avg=avg)


def pick_milestone(lang: Optional[str], days: int, habit_name: str) -> tuple[str, str]:
    L = normalize_lang(lang)
    return _pick(MILESTONE[L], days=days, habit=habit_name)


def scheduled_reminder_defaults(lang: Optional[str], reminder_type: str) -> tuple[str, str]:
    L = normalize_lang(lang)
    return SCHEDULED_REMINDER_DEFAULTS[L].get(
        reminder_type, SCHEDULED_REMINDER_DEFAULTS[L]["custom"]
    )


DEFAULT_CHECKIN_REMINDERS = {
    "en": {
        "09:00": ("Morning check-in", "Take one minute to mark your state and set the tone for today."),
        "14:00": ("Midday check-in", "Pause, check your state, and keep the day under your control."),
        "21:00": ("Evening check-in", "Close the day honestly. Log your progress and protect tomorrow."),
    },
    "uk": {
        "09:00": ("Ранковий чек-ін", "Зайди на хвилину, зафіксуй стан і задай напрямок дню."),
        "14:00": ("Денний чек-ін", "Зупинись на мить, перевір стан і втримай день під контролем."),
        "21:00": ("Вечірній чек-ін", "Закрий день чесно: відміть прогрес і захисти завтрашнього себе."),
    },
}


def pick_default_checkin_reminder(lang: Optional[str], slot: str) -> tuple[str, str]:
    L = normalize_lang(lang)
    return DEFAULT_CHECKIN_REMINDERS[L].get(slot, DEFAULT_CHECKIN_REMINDERS[L]["09:00"])


async def get_user_lang(client, user_id: str) -> Lang:
    """Read user's language from profiles. Default 'uk'."""
    try:
        resp = await (
            client.table("profiles")
            .select("*")
            .eq("id", user_id)
            .single()
            .execute()
        )
        data = resp.data or {}
        return normalize_lang(data.get("preferred_language") or data.get("locale"))
    except Exception:
        return "uk"
