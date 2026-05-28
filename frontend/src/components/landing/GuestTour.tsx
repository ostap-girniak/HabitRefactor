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
} from "lucide-react";
import { useUIStore } from "@/lib/store";

const TOUR_SEEN_KEY = "habitrefactor_guest_tour_seen_v1";

type Slide = {
  icon: typeof Flame;
  color: string;
  emoji: string;
  title_en: string;
  title_uk: string;
  desc_en: string;
  desc_uk: string;
};

const SLIDES: Slide[] = [
  {
    icon: Shield,
    color: "var(--accent-fire)",
    emoji: "🛡️",
    title_en: "Not another habit tracker.",
    title_uk: "Не черговий habit tracker.",
    desc_en:
      "HabitRefactor is an identity transformation tool. You don't \"quit smoking\" — you become someone who doesn't smoke.",
    desc_uk:
      "HabitRefactor — інструмент трансформації ідентичності. Ти не \"кидаєш курити\" — ти стаєш людиною, яка не курить.",
  },
  {
    icon: Mic,
    color: "var(--accent-info)",
    emoji: "🎙️",
    title_en: "Multimodal AI Journal",
    title_uk: "Мультимодальний AI-журнал",
    desc_en:
      "Speak by voice, record video, or type. Gemini 2.0 transcribes, detects emotions, and pulls out key themes. Your inner dialogue — deeper than ever.",
    desc_uk:
      "Розповідай голосом, відео або текстом. Gemini 2.0 транскрибує, виявляє емоції і витягує ключові теми. Твій внутрішній діалог — глибший ніж будь-коли.",
  },
  {
    icon: MessageCircle,
    color: "#7C4DFF",
    emoji: "🧙",
    title_en: "Oracle — your AI companion",
    title_uk: "Oracle — твій AI-радник",
    desc_en:
      "Ask anything at 3 AM, at your weakest moment. The Oracle has full context of your journey and recommends books, videos, professional help.",
    desc_uk:
      "Запитуй що завгодно о 3 ночі, у найслабший момент. Oracle знає твою історію і рекомендує книги, відео, фахову допомогу.",
  },
  {
    icon: Bell,
    color: "#FF9800",
    emoji: "⚡",
    title_en: "Pattern-based smart alerts",
    title_uk: "Розумні сповіщення за патернами",
    desc_en:
      "Your data shows you slip every Friday at 8 PM. We send a push at 7:55 PM — proactive defense, not reactive damage control.",
    desc_uk:
      "Дані кажуть що ти зриваєшся щоп'ятниці о 20:00. Ми шлемо push о 19:55 — захист до зриву, а не виправлення після.",
  },
  {
    icon: Flame,
    color: "var(--accent-fire)",
    emoji: "🔥",
    title_en: "Ready to forge yourself?",
    title_uk: "Готовий перебудувати себе?",
    desc_en:
      "Free. 30 seconds to register. You vs. you — no mediators, no excuses.",
    desc_uk:
      "Безкоштовно. 30 секунд на реєстрацію. Ти проти себе — без посередників і виправдань.",
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
      // Storage might be blocked (e.g. private mode) — ignore
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={uk ? "Знайомство з HabitRefactor" : "HabitRefactor intro"}
    >
      <div className="relative w-full max-w-md animate-slide-up">
        {/* Close button */}
        <button
          onClick={close}
          aria-label={uk ? "Закрити" : "Close"}
          className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-fire)] flex items-center justify-center transition-colors shadow-lg"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="card text-center px-6 py-8 space-y-6">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`${uk ? "Слайд" : "Slide"} ${i + 1}`}
                className={`rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-8 h-2 bg-[var(--accent-fire)]"
                    : i < step
                    ? "w-2 h-2 bg-[var(--accent-fire)] opacity-50"
                    : "w-2 h-2 bg-[var(--border-default)]"
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: `${slide.color}15` }}
          >
            <Icon className="w-10 h-10" style={{ color: slide.color }} />
          </div>

          {/* Title + desc */}
          <div className="space-y-3">
            <h2 className="text-2xl font-black text-[var(--text-primary)] leading-tight">
              {uk ? slide.title_uk : slide.title_en}
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed text-sm max-w-sm mx-auto">
              {uk ? slide.desc_uk : slide.desc_en}
            </p>
          </div>

          {/* Step counter */}
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
            {step + 1} / {SLIDES.length}
          </p>

          {/* Buttons */}
          {isLast ? (
            <div className="flex flex-col gap-2.5 pt-2">
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
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={prev}
                disabled={isFirst}
                aria-label={uk ? "Назад" : "Back"}
                className="btn-ghost flex items-center justify-center gap-1 px-4 py-2.5 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
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
