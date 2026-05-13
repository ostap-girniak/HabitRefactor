"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Swords, CheckCircle, ChevronRight, Globe } from "lucide-react";
import { authApi } from "@/lib/api";
import { useUserStore, useUIStore } from "@/lib/store";

const CATEGORIES = [
  { value: "smoking", label: "🚬", name: "Куріння / Smoking" },
  { value: "alcohol", label: "🍺", name: "Алкоголь / Alcohol" },
  { value: "porn", label: "🔞", name: "Порно / Porn" },
  { value: "social_media", label: "📱", name: "Соцмережі / Social Media" },
  { value: "gambling", label: "🎲", name: "Азарт / Gambling" },
  { value: "junk_food", label: "🍔", name: "Шкідлива їжа / Junk Food" },
  { value: "gaming", label: "🎮", name: "Ігри / Gaming" },
  { value: "other", label: "⚡", name: "Інше / Other" },
];

const TIMEZONES = [
  { value: "Europe/Kyiv", label: "🇺🇦 Kyiv (UTC+2/+3)" },
  { value: "Europe/Warsaw", label: "🇵🇱 Warsaw (UTC+1/+2)" },
  { value: "Europe/Berlin", label: "🇩🇪 Berlin (UTC+1/+2)" },
  { value: "Europe/London", label: "🇬🇧 London (UTC+0/+1)" },
  { value: "America/New_York", label: "🇺🇸 New York (UTC-5/-4)" },
  { value: "America/Los_Angeles", label: "🇺🇸 Los Angeles (UTC-8/-7)" },
  { value: "Asia/Dubai", label: "🇦🇪 Dubai (UTC+4)" },
  { value: "UTC", label: "🌐 UTC" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);
  const language = useUIStore((s) => s.language);
  const uk = language === "uk";

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    timezone: "Europe/Kyiv",
    first_habit_name: "",
    first_habit_category: "",
  });

  const isUk = uk;

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      const payload: Record<string, string> = {
        display_name: form.display_name.trim() || (uk ? "Воїн" : "Warrior"),
        timezone: form.timezone,
      };
      if (form.first_habit_name && form.first_habit_category) {
        payload.first_habit_name = form.first_habit_name;
        payload.first_habit_category = form.first_habit_category;
      }
      const { data } = await authApi.completeOnboarding(payload);
      setUser(data as any);
      router.push("/dashboard");
    } catch (e) {
      console.error("Onboarding failed:", e);
      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg animate-fade-in">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(255,77,0,0.4)] mb-3">
            <img src="/logo.png" alt="HabitRefactor" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-black text-[var(--text-primary)]">HabitRefactor</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1 italic">you vs you</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`rounded-full transition-all duration-300 ${
                s === step
                  ? "w-8 h-2.5 bg-[var(--accent-fire)]"
                  : s < step
                  ? "w-2.5 h-2.5 bg-[var(--accent-fire)] opacity-60"
                  : "w-2.5 h-2.5 bg-[var(--border-default)]"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Name + Timezone */}
        {step === 1 && (
          <div className="card space-y-6 animate-slide-up">
            <div>
              <h2 className="text-2xl font-black text-[var(--text-primary)] mb-1">
                {isUk ? "Ласкаво просимо, Воїне 🔥" : "Welcome, Warrior 🔥"}
              </h2>
              <p className="text-[var(--text-secondary)] text-sm">
                {isUk
                  ? "HabitRefactor — це не черговий трекер. Це зброя проти твоїх гірших звичок."
                  : "HabitRefactor is not another tracker. It's a weapon against your worst habits."}
              </p>
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                {isUk ? "Як тебе звати?" : "What should we call you?"}
              </label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => setForm((s) => ({ ...s, display_name: e.target.value }))}
                placeholder={isUk ? "Твоє ім'я або псевдо" : "Your name or alias"}
                className="input-forge"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                {isUk ? "Твій часовий пояс" : "Your timezone"}
              </label>
              <select
                value={form.timezone}
                onChange={(e) => setForm((s) => ({ ...s, timezone: e.target.value }))}
                className="input-forge"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                {isUk ? "Потрібно для точних сповіщень у твій час." : "Needed for accurate notifications in your local time."}
              </p>
            </div>

            <button
              onClick={() => setStep(2)}
              className="btn-fire w-full flex items-center justify-center gap-2"
            >
              {isUk ? "Далі" : "Continue"} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: First habit */}
        {step === 2 && (
          <div className="card space-y-5 animate-slide-up">
            <div>
              <h2 className="text-2xl font-black text-[var(--text-primary)] mb-1 flex items-center gap-2">
                <Swords className="w-6 h-6 text-[var(--accent-fire)]" />
                {isUk ? "Оголоси першу битву" : "Declare Your First Battle"}
              </h2>
              <p className="text-[var(--text-secondary)] text-sm">
                {isUk
                  ? "З якою звичкою ти хочеш почати боротьбу? Можна пропустити і додати пізніше."
                  : "Which habit do you want to fight first? You can skip and add later."}
              </p>
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">
                {isUk ? "Категорія" : "Category"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setForm((s) => ({ ...s, first_habit_category: cat.value }))}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-sm font-medium transition-all ${
                      form.first_habit_category === cat.value
                        ? "bg-[var(--accent-fire-subtle)] border-[var(--accent-fire)] text-[var(--accent-fire)]"
                        : "bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-fire)]"
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className="truncate">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {form.first_habit_category && (
              <div className="animate-slide-up">
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                  {isUk ? "Назва звички" : "Habit name"}
                </label>
                <input
                  type="text"
                  value={form.first_habit_name}
                  onChange={(e) => setForm((s) => ({ ...s, first_habit_name: e.target.value }))}
                  placeholder={isUk ? "Напр. Куріння сигарет" : "E.g. Cigarette smoking"}
                  className="input-forge"
                  autoFocus
                />
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="btn-ghost text-sm flex-1">
                {isUk ? "Пропустити" : "Skip for now"}
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={form.first_habit_category !== "" && form.first_habit_name.trim() === ""}
                className="btn-fire text-sm flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isUk ? "Далі" : "Continue"} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Ready */}
        {step === 3 && (
          <div className="card text-center space-y-6 animate-slide-up">
            <div className="w-20 h-20 rounded-full bg-[var(--accent-fire-subtle)] flex items-center justify-center mx-auto">
              <Flame className="w-10 h-10 text-[var(--accent-fire)]" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-[var(--text-primary)] mb-2">
                {isUk ? "Готовий до бою! 🔥" : "Ready to Fight! 🔥"}
              </h2>
              <p className="text-[var(--text-secondary)] text-sm max-w-sm mx-auto">
                {isUk
                  ? `${form.display_name || "Воїне"}, твій Forge налаштований. Щоденні чек-іни, AI-аналіз, Oracle — все готово. Жодних виправдань.`
                  : `${form.display_name || "Warrior"}, your Forge is ready. Daily check-ins, AI analysis, Oracle — all set. No excuses.`}
              </p>
            </div>

            {form.first_habit_name && (
              <div className="bg-[var(--accent-fire-subtle)] border border-[var(--accent-fire)] rounded-xl p-4 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-[var(--accent-fire)]" />
                  <span className="text-xs font-bold text-[var(--accent-fire)] uppercase tracking-wider">
                    {isUk ? "Перша битва" : "First Battle"}
                  </span>
                </div>
                <p className="font-bold text-[var(--text-primary)]">{form.first_habit_name}</p>
              </div>
            )}

            <div className="space-y-2 text-sm text-[var(--text-secondary)] text-left bg-[var(--bg-elevated)] rounded-xl p-4">
              {[
                isUk ? "✓ Щоденний чек-ін для відстеження" : "✓ Daily check-in tracking",
                isUk ? "✓ AI-аналіз твоїх патернів" : "✓ AI pattern analysis",
                isUk ? "✓ Oracle чат — запитай будь-що" : "✓ Oracle chat — ask anything",
                isUk ? "✓ Push-сповіщення в небезпечні моменти" : "✓ Push alerts at high-risk moments",
              ].map((item, i) => (
                <p key={i}>{item}</p>
              ))}
            </div>

            <button
              onClick={handleComplete}
              disabled={isLoading}
              className="btn-fire w-full text-lg py-4 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Flame className="w-5 h-5" />
                  {isUk ? "Увійти у War Room 🔥" : "Enter the War Room 🔥"}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
