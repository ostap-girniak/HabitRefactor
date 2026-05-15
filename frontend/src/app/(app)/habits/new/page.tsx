"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Flame,
  Plus,
  Cigarette,
  Wine,
  Smartphone,
  ShieldAlert,
  Gamepad2,
  Clock,
  Pizza,
  MessageSquareWarning,
  Pill,
  Target,
} from "lucide-react";
import { getCategoryEmoji } from "@/lib/utils";
import { useT } from "@/lib/i18n";

type Step = "category" | "details" | "tracking" | "triggers";

import { useCreateHabit } from "@/lib/hooks";

export default function NewHabitPage() {
  const router = useRouter();
  const t = useT();
  const [step, setStep] = useState<Step>("category");
  const createHabit = useCreateHabit();

  const CATEGORIES = [
    { value: "smoking", label: t.cat_smoking, icon: Cigarette, emoji: "🚬" },
    { value: "alcohol", label: t.cat_alcohol, icon: Wine, emoji: "🍺" },
    { value: "food", label: t.cat_food, icon: Pizza, emoji: "🍔" },
    { value: "social_media", label: t.cat_social_media, icon: Smartphone, emoji: "📱" },
    { value: "porn", label: t.cat_porn, icon: ShieldAlert, emoji: "🔞" },
    { value: "swearing", label: t.cat_swearing, icon: MessageSquareWarning, emoji: "🤬" },
    { value: "gambling", label: t.cat_gambling, icon: Gamepad2, emoji: "🎰" },
    { value: "drugs", label: t.cat_drugs, icon: Pill, emoji: "💊" },
    { value: "procrastination", label: t.cat_procrastination, icon: Clock, emoji: "⏰" },
    { value: "other", label: t.cat_other, icon: Target, emoji: "🎯" },
  ];

  const FREQUENCIES = [
    { value: "daily", label: t.freq_daily },
    { value: "weekdays", label: t.freq_weekdays },
    { value: "weekends", label: t.freq_weekends },
    { value: "weekly", label: t.freq_weekly },
    { value: "custom", label: t.freq_custom },
  ];

  const MODES = [
    { value: "cold_turkey", label: t.mode_cold_turkey, desc: t.mode_cold_turkey_desc },
    { value: "gradual", label: t.mode_gradual, desc: t.mode_gradual_desc },
    { value: "controlled", label: t.mode_controlled, desc: t.mode_controlled_desc },
  ];

  // Form state
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [reductionMode, setReductionMode] = useState("cold_turkey");
  const [unitName, setUnitName] = useState("times");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [timePerUnit, setTimePerUnit] = useState("");
  const [caloriesPerUnit, setCaloriesPerUnit] = useState("");
  const [alternativeBehavior, setAlternativeBehavior] = useState("");
  const [triggers, setTriggers] = useState<string[]>([]);
  const [newTrigger, setNewTrigger] = useState("");

  const steps: Step[] = ["category", "details", "tracking", "triggers"];
  const currentIndex = steps.indexOf(step);

  const nextStep = () => {
    if (currentIndex < steps.length - 1) setStep(steps[currentIndex + 1]);
  };
  const prevStep = () => {
    if (currentIndex > 0) setStep(steps[currentIndex - 1]);
  };

  const addTrigger = () => {
    if (newTrigger.trim()) {
      setTriggers([...triggers, newTrigger.trim()]);
      setNewTrigger("");
    }
  };

  const handleSubmit = async () => {
    try {
      await createHabit.mutateAsync({
        name,
        category,
        description,
        is_active: true,
        reduction_mode: reductionMode as any,
        frequency: frequency as any,
        unit_name: unitName,
        cost_per_unit: parseInt(costPerUnit, 10) || 0,
        time_per_unit_minutes: parseInt(timePerUnit, 10) || 0,
        calories_per_unit: parseInt(caloriesPerUnit, 10) || 0,
        alternative_behavior: alternativeBehavior,
      });
      router.push("/dashboard");
    } catch (error) {
      console.error("Failed to create habit:", error);
    }
  };

  const isSubmitting = createHabit.isPending;

  const selectedCat = CATEGORIES.find((c) => c.value === category);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)]">
            {t.habit_new_title}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {t.habit_new_subtitle}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[var(--accent-fire)] to-[var(--accent-ember)] rounded-full transition-all duration-500"
          style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Step 1: Category */}
      {step === "category" && (
        <div className="space-y-4 animate-slide-up">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {t.habit_new_what_fighting}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => {
                  setCategory(cat.value);
                  setName(cat.label);
                  setUnitName(
                    cat.value === "smoking" ? "cigarettes" :
                    cat.value === "alcohol" ? "drinks" :
                    cat.value === "social_media" ? "minutes" :
                    cat.value === "food" ? "snacks" : "times"
                  );
                  nextStep();
                }}
                className={`card flex items-center gap-3 group cursor-pointer text-left ${
                  category === cat.value ? "border-[var(--accent-fire)]" : ""
                }`}
              >
                <span className="text-2xl">{cat.emoji}</span>
                <span className="font-semibold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent-fire)]">
                  {cat.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Details */}
      {step === "details" && (
        <div className="space-y-5 animate-slide-up">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {selectedCat?.emoji} Describe your enemy
          </h2>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">{t.habit_new_name}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-forge"
              placeholder={t.habit_new_name_placeholder}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
              {t.habit_new_why}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-forge min-h-[80px] resize-none"
              placeholder={t.habit_new_why_placeholder}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
              {t.habit_new_instead}
            </label>
            <input
              type="text"
              value={alternativeBehavior}
              onChange={(e) => setAlternativeBehavior(e.target.value)}
              className="input-forge"
              placeholder={t.habit_new_instead_placeholder}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">{t.habit_new_approach}</label>
            <div className="space-y-2">
              {MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setReductionMode(mode.value)}
                  className={`card w-full text-left cursor-pointer ${
                    reductionMode === mode.value ? "border-[var(--accent-fire)] bg-[var(--accent-fire-subtle)]" : ""
                  }`}
                >
                  <div className="font-bold text-sm text-[var(--text-primary)]">{mode.label}</div>
                  <div className="text-xs text-[var(--text-secondary)]">{mode.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={nextStep} className="btn-fire w-full">{t.continue}</button>
        </div>
      )}

      {/* Step 3: Tracking Metrics */}
      {step === "tracking" && (
        <div className="space-y-5 animate-slide-up">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {t.habit_new_quantify}
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {t.habit_new_quantify_desc}
          </p>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
              {t.habit_new_frequency}
            </label>
            <div className="flex flex-wrap gap-2">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFrequency(f.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    frequency === f.value
                      ? "bg-[var(--accent-fire)] text-white"
                      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
                {t.habit_new_cost_per.replace("{unit}", unitName)}
              </label>
              <input
                type="number"
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(e.target.value)}
                className="input-forge"
                placeholder="e.g., 15"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
                {t.habit_new_time_per.replace("{unit}", unitName)}
              </label>
              <input
                type="number"
                value={timePerUnit}
                onChange={(e) => setTimePerUnit(e.target.value)}
                className="input-forge"
                placeholder="e.g., 7"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
              {t.habit_new_cal_per.replace("{unit}", unitName)}
            </label>
            <input
              type="number"
              value={caloriesPerUnit}
              onChange={(e) => setCaloriesPerUnit(e.target.value)}
              className="input-forge"
              placeholder="e.g., 200"
              min="0"
            />
          </div>

          <button onClick={nextStep} className="btn-fire w-full">{t.continue}</button>
        </div>
      )}

      {/* Step 4: Known Triggers */}
      {step === "triggers" && (
        <div className="space-y-5 animate-slide-up">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {t.habit_new_triggers_title}
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {t.habit_new_triggers_desc}
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={newTrigger}
              onChange={(e) => setNewTrigger(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTrigger()}
              className="input-forge flex-1"
              placeholder={t.habit_new_trigger_placeholder}
            />
            <button onClick={addTrigger} className="btn-fire px-4">
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {triggers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {triggers.map((trig, i) => (
                <span
                  key={i}
                  className="badge badge-fire flex items-center gap-1 cursor-pointer hover:opacity-70"
                  onClick={() => setTriggers(triggers.filter((_, idx) => idx !== i))}
                >
                  {trig} ×
                </span>
              ))}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-fire w-full py-4 text-base flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              t.habit_new_creating
            ) : (
              <>
                <Flame className="w-5 h-5" />
                {t.habit_new_start}
              </>
            )}
          </button>

          <button
            onClick={handleSubmit}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] w-full text-center"
          >
            {t.habit_new_skip_triggers}
          </button>
        </div>
      )}

      {/* Back button */}
      {currentIndex > 0 && (
        <button onClick={prevStep} className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          <ChevronLeft className="w-4 h-4" /> {t.back}
        </button>
      )}
    </div>
  );
}
