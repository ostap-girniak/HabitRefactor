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

const CATEGORIES = [
  { value: "smoking", label: "Smoking", icon: Cigarette, emoji: "🚬" },
  { value: "alcohol", label: "Alcohol", icon: Wine, emoji: "🍺" },
  { value: "food", label: "Overeating / Junk Food", icon: Pizza, emoji: "🍔" },
  { value: "social_media", label: "Social Media", icon: Smartphone, emoji: "📱" },
  { value: "porn", label: "Pornography", icon: ShieldAlert, emoji: "🔞" },
  { value: "swearing", label: "Swearing", icon: MessageSquareWarning, emoji: "🤬" },
  { value: "gambling", label: "Gambling", icon: Gamepad2, emoji: "🎰" },
  { value: "drugs", label: "Drugs", icon: Pill, emoji: "💊" },
  { value: "procrastination", label: "Procrastination", icon: Clock, emoji: "⏰" },
  { value: "other", label: "Other", icon: Target, emoji: "🎯" },
];

const FREQUENCIES = [
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays only" },
  { value: "weekends", label: "Weekends only" },
  { value: "weekly", label: "Once a week" },
  { value: "custom", label: "Custom days" },
];

const MODES = [
  { value: "cold_turkey", label: "Cold Turkey 🧊", desc: "Quit completely. No exceptions." },
  { value: "gradual", label: "Gradual Reduction 📉", desc: "Reduce over time." },
  { value: "controlled", label: "Controlled Limit 🎯", desc: "Set a max per day." },
];

type Step = "category" | "details" | "tracking" | "triggers";

import { useCreateHabit } from "@/lib/hooks";

export default function NewHabitPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("category");
  const createHabit = useCreateHabit();

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
            New Battle ⚔️
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Define your enemy. Know it. Defeat it.
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
            What are you fighting?
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
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-forge"
              placeholder="e.g., Cigarettes, Instagram at night..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
              Why do you want to stop? (your WHY)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-forge min-h-[80px] resize-none"
              placeholder="Be honest. Write it for yourself. Why does this habit need to die?"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
              What to do instead? (alternative behavior)
            </label>
            <input
              type="text"
              value={alternativeBehavior}
              onChange={(e) => setAlternativeBehavior(e.target.value)}
              className="input-forge"
              placeholder="e.g., 10 pushups, chew gum, drink water, journal..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">Approach</label>
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

          <button onClick={nextStep} className="btn-fire w-full">Continue</button>
        </div>
      )}

      {/* Step 3: Tracking Metrics */}
      {step === "tracking" && (
        <div className="space-y-5 animate-slide-up">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            📊 Let&apos;s quantify the damage
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            These numbers will power your savings calculator and pain projections.
          </p>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
              Frequency
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
                💰 Cost per {unitName} (UAH)
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
                ⏱️ Time per {unitName} (min)
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
              🔥 Calories per {unitName} (optional)
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

          <button onClick={nextStep} className="btn-fire w-full">Continue</button>
        </div>
      )}

      {/* Step 4: Known Triggers */}
      {step === "triggers" && (
        <div className="space-y-5 animate-slide-up">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            🎯 Known triggers
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            When/where/with whom do you usually fall? The AI will learn more over time.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={newTrigger}
              onChange={(e) => setNewTrigger(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTrigger()}
              className="input-forge flex-1"
              placeholder="e.g., After lunch, When stressed, With friends..."
            />
            <button onClick={addTrigger} className="btn-fire px-4">
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {triggers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {triggers.map((t, i) => (
                <span
                  key={i}
                  className="badge badge-fire flex items-center gap-1 cursor-pointer hover:opacity-70"
                  onClick={() => setTriggers(triggers.filter((_, idx) => idx !== i))}
                >
                  {t} ×
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
              "Creating your battle..."
            ) : (
              <>
                <Flame className="w-5 h-5" />
                Start The Battle 🔥
              </>
            )}
          </button>

          <button
            onClick={handleSubmit}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] w-full text-center"
          >
            Skip triggers — I&apos;ll add them later
          </button>
        </div>
      )}

      {/* Back button */}
      {currentIndex > 0 && (
        <button onClick={prevStep} className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      )}
    </div>
  );
}
