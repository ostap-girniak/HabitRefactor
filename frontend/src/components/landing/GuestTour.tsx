"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Flame,
  Mic,
  MessageCircle,
  Bell,
  ChevronRight,
  ChevronLeft,
  X,
  ArrowRight,
  Shield,
  Swords,
  Brain,
  Smartphone,
} from "lucide-react";
import { useUIStore } from "@/lib/store";

const TOUR_SEEN_KEY = "habitrefactor_guest_tour_seen_v2";

type Slide = {
  icon: typeof Flame;
  color: string;
  title_en: string;
  title_uk: string;
  desc_en: string;
  desc_uk: string;
  highlights_en?: string[];
  highlights_uk?: string[];
};

const SLIDES: Slide[] = [
  // 1. Hook
  {
    icon: Shield,
    color: "var(--accent-fire)",
    title_en: "Not another tracker — an identity lab.",
    title_uk: "Не tracker — лабораторія ідентичності.",
    desc_en:
      "You don't \"quit smoking\" — you become someone who doesn't smoke. Every check-in is a vote for the person you're becoming.",
    desc_uk:
      "Ти не \"кидаєш курити\" — ти стаєш людиною, яка не курить. Кожен check-in — це голос за того, ким ти хочеш бути.",
    highlights_en: [
      "Warrior Identity setup",
      "Identity Shift Lab",
      "Built on Atomic Habits + Goggins",
    ],
    highlights_uk: [
      "Налаштування Воїнської ідентичності",
      "Identity Shift Lab",
      "Базується на Atomic Habits + Goggins",
    ],
  },

  // 2. Track
  {
    icon: Swords,
    color: "var(--accent-success)",
    title_en: "Your battlefield, mapped.",
    title_uk: "Твоє поле бою — у даних.",
    desc_en:
      "Every habit, every streak, every check-in turns into a clean picture you can actually read. No vanity metrics.",
    desc_uk:
      "Кожна звичка, серія і check-in перетворюються на чітку картину яку реально читати. Без vanity-метрик.",
    highlights_en: [
      "Sobriety counter (days/hours/min)",
      "Current + longest streak per habit",
      "GitHub-style 365-day heatmap",
      "Hourly & weekday risk analysis",
    ],
    highlights_uk: [
      "Лічильник тверезості (дні/години/хв)",
      "Поточна + найдовша серія для кожної звички",
      "GitHub-style heatmap на 365 днів",
      "Аналіз ризику по годинах і днях тижня",
    ],
  },

  // 3. Multimodal Journal
  {
    icon: Mic,
    color: "var(--accent-info)",
    title_en: "Multimodal AI journal.",
    title_uk: "Мультимодальний AI-журнал.",
    desc_en:
      "Record voice or video right in the browser, or type. Gemini 2.0 transcribes, scores 5 emotions on a radar chart, and pulls out your key themes.",
    desc_uk:
      "Записуй голос або відео прямо в браузері, або пиши текстом. Gemini 2.0 транскрибує, оцінює 5 емоцій на радар-графіку і витягує ключові теми.",
    highlights_en: [
      "Voice / video / text entries",
      "Verbatim transcription",
      "Emotion radar (joy, anger, sadness, shame, relief)",
      "Auto-detected themes + notable quotes",
    ],
    highlights_uk: [
      "Голос / відео / текст",
      "Дослівна транскрипція",
      "Радар емоцій (радість, злість, сум, сором, полегшення)",
      "Авто-виявлені теми + цитати",
    ],
  },

  // 4. AI Insights
  {
    icon: Brain,
    color: "var(--accent-ember)",
    title_en: "AI that actually sees your patterns.",
    title_uk: "AI що бачить твої патерни.",
    desc_en:
      "Weekly AI analyses your data and surfaces what you'd miss. Pain & Pleasure projections show what continuing this habit costs you in 1/5/10 years — written using your own words.",
    desc_uk:
      "Щотижневий AI-аналіз показує те що ти не помітиш сам. Проекції болю і задоволення показують скільки звичка коштуватиме за 1/5/10 років — твоїми ж словами.",
    highlights_en: [
      "Daily + weekly AI insights",
      "Pain & Pleasure 1/5/10-year projections",
      "Hero Mode — your story in chapters",
      "Catalyst Forge — letter from future you",
    ],
    highlights_uk: [
      "Щоденний + тижневий AI-аналіз",
      "Проекції болю і задоволення на 1/5/10 років",
      "Hero Mode — твоя історія главами",
      "Catalyst Forge — лист від майбутнього себе",
    ],
  },

  // 5. Oracle
  {
    icon: MessageCircle,
    color: "#7C4DFF",
    title_en: "Oracle — your AI companion.",
    title_uk: "Oracle — твій AI-радник.",
    desc_en:
      "Ask anything at 3 AM, at your weakest moment. Oracle pulls from 85+ curated sources (Goggins, James Clear, stoicism, addiction science) AND the full context of your journey.",
    desc_uk:
      "Запитуй що завгодно о 3 ночі, у найслабший момент. Oracle підтягує контекст з 85+ джерел (Goggins, James Clear, стоїцизм, addiction science) І повну історію твого журналу.",
    highlights_en: [
      "RAG over knowledge base + your journals",
      "Book / YouTube / article recommendations",
      "Suggests professional help when needed",
      "Responds in your language (UK/EN)",
    ],
    highlights_uk: [
      "RAG по базі знань + твоїх журналах",
      "Рекомендує книги / YouTube / статті",
      "Підказує коли звертатись по фахову допомогу",
      "Відповідає твоєю мовою (UK/EN)",
    ],
  },

  // 6. Smart Push (Defense)
  {
    icon: Bell,
    color: "#FF9800",
    title_en: "Defense BEFORE the slip, not after.",
    title_uk: "Захист ДО зриву, а не після.",
    desc_en:
      "Pattern interceptor learns when you slip (Fridays at 8 PM?) and sends a push 5 minutes before. Journal danger-words trigger instant alerts. Streak milestones get celebrated.",
    desc_uk:
      "Pattern interceptor вчиться коли ти зриваєшся (щоп'ятниці о 20:00?) і шле push за 5 хв до того. Слова небезпеки в журналі — миттєвий алерт. Серії святкуються.",
    highlights_en: [
      "Hourly + weekday risk push",
      "Danger zone forecasts (relapse interceptor)",
      "Journal keyword scanner",
      "Milestones at 1/3/7/14/21/30/100+ days",
    ],
    highlights_uk: [
      "Push по найризикованіших годинах і днях",
      "Прогноз danger zone (relapse interceptor)",
      "Сканер ключових слів у журналі",
      "Святкування 1/3/7/14/21/30/100+ днів",
    ],
  },

  // 7. Always there
  {
    icon: Smartphone,
    color: "#4CAF50",
    title_en: "Always with you.",
    title_uk: "Завжди з тобою.",
    desc_en:
      "Install as an app on your phone (PWA). Works offline. Bilingual interface. All notifications archived in a built-in bell so nothing gets lost.",
    desc_uk:
      "Встановлюй як додаток на телефон (PWA). Працює офлайн. Двомовний інтерфейс. Усі сповіщення зберігаються у вбудованому дзвіночку — нічого не загубиться.",
    highlights_en: [
      "PWA — installable on iOS / Android / desktop",
      "Offline mode with cached UI",
      "🇺🇦 Ukrainian / 🇬🇧 English switch",
      "Notification history with read/unread",
    ],
    highlights_uk: [
      "PWA — встановлюється на iOS / Android / desktop",
      "Офлайн-режим з кешованим інтерфейсом",
      "🇺🇦 Українська / 🇬🇧 English перемикач",
      "Історія сповіщень з read/unread",
    ],
  },

  // 8. CTA
  {
    icon: Flame,
    color: "var(--accent-fire)",
    title_en: "Ready to forge yourself?",
    title_uk: "Готовий перебудувати себе?",
    desc_en:
      "Free. 30 seconds to register. You vs. you — no mediators, no excuses. The old you is dying. The new you is winning.",
    desc_uk:
      "Безкоштовно. 30 секунд на реєстрацію. Ти проти себе — без посередників і виправдань. Старий ти помирає. Новий ти перемагає.",
  },
];

export function GuestTour() {
  const language = useUIStore((s) => s.language);
  const uk = language === "uk";

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(TOUR_SEEN_KEY);
    if (seen) return;
    const timer = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const close = () => {
    try {
      localStorage.setItem(TOUR_SEEN_KEY, "1");
    } catch {
      // Storage might be blocked (private mode) — ignore
    }
    setOpen(false);
  };

  const next = () => {
    if (step < SLIDES.length - 1) setStep(step + 1);
  };
  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!open) return null;

  const slide = SLIDES[step];
  const Icon = slide.icon;
  const isLast = step === SLIDES.length - 1;
  const isFirst = step === 0;
  const highlights = uk ? slide.highlights_uk : slide.highlights_en;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={uk ? "Знайомство з HabitRefactor" : "HabitRefactor intro"}
    >
      <div className="relative w-full max-w-md my-auto animate-slide-up">
        {/* Close button */}
        <button
          onClick={close}
          aria-label={uk ? "Закрити" : "Close"}
          className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-fire)] flex items-center justify-center transition-colors shadow-lg"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="card px-6 py-7 space-y-5">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`${uk ? "Слайд" : "Slide"} ${i + 1}`}
                className={`rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-7 h-1.5 bg-[var(--accent-fire)]"
                    : i < step
                    ? "w-1.5 h-1.5 bg-[var(--accent-fire)] opacity-50"
                    : "w-1.5 h-1.5 bg-[var(--border-default)]"
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: `${slide.color}15` }}
          >
            <Icon className="w-8 h-8" style={{ color: slide.color }} />
          </div>

          {/* Title + desc */}
          <div className="space-y-2.5 text-center">
            <h2 className="text-xl md:text-2xl font-black text-[var(--text-primary)] leading-tight">
              {uk ? slide.title_uk : slide.title_en}
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed text-sm max-w-sm mx-auto">
              {uk ? slide.desc_uk : slide.desc_en}
            </p>
          </div>

          {/* Highlights */}
          {highlights && highlights.length > 0 && (
            <ul className="space-y-1.5 bg-[var(--bg-elevated)] rounded-xl p-3.5 border border-[var(--border-default)]">
              {highlights.map((h, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-[var(--text-secondary)] leading-snug"
                >
                  <span
                    className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full"
                    style={{ background: slide.color }}
                  />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Step counter */}
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider text-center">
            {step + 1} / {SLIDES.length}
          </p>

          {/* Buttons */}
          {isLast ? (
            <div className="flex flex-col gap-2 pt-1">
              <Link
                href="/register"
                onClick={close}
                className="btn-fire w-full flex items-center justify-center gap-2 text-base py-3"
              >
                <Flame className="w-5 h-5" />
                {uk ? "Почати безкоштовно" : "Start for free"}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={close}
                className="btn-ghost text-sm py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {uk ? "Подивлюсь спочатку" : "I'll look around first"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={prev}
                disabled={isFirst}
                aria-label={uk ? "Назад" : "Back"}
                className="btn-ghost flex items-center justify-center gap-1 px-3 py-2.5 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                {uk ? "Назад" : "Back"}
              </button>
              <button
                onClick={close}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-2"
              >
                {uk ? "Пропустити" : "Skip"}
              </button>
              <button
                onClick={next}
                className="btn-fire flex-1 flex items-center justify-center gap-2 py-2.5 text-sm"
              >
                {uk ? "Далі" : "Next"}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
