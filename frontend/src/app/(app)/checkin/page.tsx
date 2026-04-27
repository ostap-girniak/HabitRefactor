"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Flame,
  MapPin,
  Clock,
  Users,
  Wine,
  Brain,
  Moon,
  Send,
  Zap,
} from "lucide-react";
import { getCategoryEmoji } from "@/lib/utils";
import { useHabits, useCreateCheckin, useTodayCheckins } from "@/lib/hooks";
import type { Habit } from "@/lib/store";

type Step = "habit" | "result" | "details" | "context" | "notes" | "done";

const TRIGGER_TAGS = [
  { id: "stress", label: "Stressed", icon: Brain },
  { id: "bored", label: "Bored", icon: Clock },
  { id: "alone", label: "Alone", icon: Users },
  { id: "social", label: "Social pressure", icon: Users },
  { id: "alcohol", label: "Alcohol involved", icon: Wine },
  { id: "tired", label: "Tired", icon: Moon },
  { id: "location", label: "Trigger location", icon: MapPin },
];

export default function CheckinPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-[var(--accent-fire)] border-t-transparent rounded-full animate-spin" /></div>}>
      <CheckinContent />
    </Suspense>
  );
}

function CheckinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRelapse = searchParams.get("relapse") === "true";
  const { data: habitsData, isLoading: habitsLoading } = useHabits();
  const { data: todayData } = useTodayCheckins();
  const createCheckin = useCreateCheckin();

  const habits = (habitsData as Habit[]) || [];
  const todayCheckins = (todayData as any)?.checkins || [];

  const [step, setStep] = useState<Step>("habit");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);
  const [result, setResult] = useState<"success" | "relapse" | "partial">(
    isRelapse ? "relapse" : "success"
  );
  const [relapseCount, setRelapseCount] = useState(1);
  const [relapseTrigger, setRelapseTrigger] = useState("");
  const [moodBefore, setMoodBefore] = useState(5);
  const [moodAfter, setMoodAfter] = useState(5);
  const [stressLevel, setStressLevel] = useState(5);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [timeOfDay, setTimeOfDay] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const steps: Step[] = ["habit", "result", ...(result !== "success" ? ["details" as Step] : []), "context", "notes", "done"];
  const currentStepIndex = steps.indexOf(step);
  const progress = Math.round(((currentStepIndex + 1) / steps.length) * 100);

  const nextStep = () => {
    const nextIdx = currentStepIndex + 1;
    if (nextIdx < steps.length) {
      setStep(steps[nextIdx]);
    }
  };

  const prevStep = () => {
    const prevIdx = currentStepIndex - 1;
    if (prevIdx >= 0) {
      setStep(steps[prevIdx]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedHabit) return;
    setSubmitError(null);
    try {
      const allTriggers = [relapseTrigger, ...selectedTags].filter(Boolean);
      await createCheckin.mutateAsync({
        habit_id: selectedHabit,
        date: new Date().toISOString().split("T")[0],
        result,
        relapse_count: result === "success" ? 0 : relapseCount,
        relapse_trigger: relapseTrigger || undefined,
        triggers: allTriggers.length > 0 ? allTriggers : undefined,
        mood_before: moodBefore,
        mood_after: moodAfter,
        stress_level: stressLevel,
        sleep_quality: sleepQuality,
        time_of_day: timeOfDay || undefined,
        notes: notes || undefined,
      });
      setStep("done");
    } catch (error: any) {
      console.error("Failed to submit check-in:", error);
      const msg = error?.response?.data?.detail || "Failed to save check-in. Please try again.";
      setSubmitError(msg);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((t) => t !== tagId)
        : [...prev, tagId]
    );
  };

  const isSubmitting = createCheckin.isPending;
  const selectedHabitData = habits.find((h: any) => h.id === selectedHabit);

  if (habitsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="w-12 h-12 border-4 border-[var(--accent-fire)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--text-secondary)]">Loading your battle records...</p>
      </div>
    );
  }

  if (!habits || habits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-6 animate-fade-in p-6">
        <div className="w-20 h-20 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center mb-2">
          <AlertTriangle className="w-10 h-10 text-[var(--accent-warning)]" />
        </div>
        <div className="max-w-md space-y-2">
          <h1 className="text-2xl font-black text-[var(--text-primary)]">No Battlefield Found</h1>
          <p className="text-[var(--text-secondary)]">
            You must declare a battle (add a habit) before you can check in.
          </p>
        </div>
        <Link href="/habits/new" className="btn-fire px-8 py-4">
          Declare Battle Now
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[var(--text-primary)]">
          Daily Check-in ✓
        </h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Be brutally honest with yourself. That&apos;s the only way this works.
        </p>
      </div>

      {/* Progress bar */}
      {step !== "done" && (
        <div className="relative">
          <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--accent-fire)] to-[var(--accent-ember)] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-2 text-right">
            Step {currentStepIndex + 1} of {steps.length - 1}
          </div>
        </div>
      )}

      {/* Step 1: Select Habit */}
      {step === "habit" && (
        <div className="space-y-4 animate-slide-up">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            Which battle are you checking in for?
          </h2>
          <div className="space-y-3">
            {habits.map((habit) => {
              const alreadyDone = todayCheckins.find((c: any) => c.habit_id === habit.id);
              return (
              <button
                key={habit.id}
                onClick={() => {
                  setSelectedHabit(habit.id);
                  nextStep();
                }}
                className={`card w-full text-left flex items-center gap-4 group cursor-pointer transition-all ${
                  selectedHabit === habit.id
                    ? "border-[var(--accent-fire)] bg-[var(--accent-fire-subtle)]"
                    : alreadyDone ? "border-[var(--accent-success)] bg-[var(--accent-success-subtle)]" : ""
                }`}
              >
                <span className="text-3xl">{getCategoryEmoji(habit.category)}</span>
                <div className="flex-1">
                  <span className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-fire)] block">
                    {habit.name}
                  </span>
                  {alreadyDone && (
                    <span className="text-xs text-[var(--accent-success)] font-semibold flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Done today ({alreadyDone.result})
                    </span>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-fire)]" />
              </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Result */}
      {step === "result" && (
        <div className="space-y-4 animate-slide-up">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            How did today go with {selectedHabitData?.name}?
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {[
              { value: "success" as const, label: "I stayed strong 💪", desc: "Zero relapses. Clean day.", icon: CheckCircle2, color: "var(--accent-success)", bgColor: "var(--accent-success-subtle)" },
              { value: "partial" as const, label: "I slipped but fought back", desc: "Partial relapse — you caught yourself.", icon: AlertTriangle, color: "var(--accent-warning)", bgColor: "rgba(255, 214, 0, 0.12)" },
              { value: "relapse" as const, label: "I relapsed 😤", desc: "Full relapse. But pain is data.", icon: XCircle, color: "var(--accent-danger)", bgColor: "var(--accent-danger-subtle)" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setResult(opt.value);
                  nextStep();
                }}
                className="card w-full text-left flex items-center gap-4 group cursor-pointer"
                style={{
                  borderColor: result === opt.value ? opt.color : undefined,
                  background: result === opt.value ? opt.bgColor : undefined,
                }}
              >
                <opt.icon className="w-8 h-8 flex-shrink-0" style={{ color: opt.color }} />
                <div className="flex-1">
                  <div className="font-bold text-[var(--text-primary)]">{opt.label}</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Relapse Details (only if relapse/partial) */}
      {step === "details" && (
        <div className="space-y-6 animate-slide-up">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            No judgment. Just data. What happened?
          </h2>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
              How many times today?
            </label>
            <div className="flex items-center gap-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRelapseCount(n)}
                  className={`w-12 h-12 rounded-xl font-bold text-lg transition-all ${
                    relapseCount === n
                      ? "bg-[var(--accent-danger)] text-white"
                      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {n}{n === 5 ? "+" : ""}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
              What triggered it?
            </label>
            <textarea
              value={relapseTrigger}
              onChange={(e) => setRelapseTrigger(e.target.value)}
              className="input-forge min-h-[80px] resize-none"
              placeholder="Be specific. Where were you? What were you feeling?"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
              Quick tags (select all that apply)
            </label>
            <div className="flex flex-wrap gap-2">
              {TRIGGER_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    selectedTags.includes(tag.id)
                      ? "bg-[var(--accent-fire)] text-white"
                      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  <tag.icon className="w-3.5 h-3.5" />
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={nextStep} className="btn-fire w-full">
            Continue <ChevronRight className="w-4 h-4 inline ml-1" />
          </button>
        </div>
      )}

      {/* Step 4: Context */}
      {step === "context" && (
        <div className="space-y-6 animate-slide-up">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            Your state today
          </h2>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-3">
              Mood {result !== "success" ? "before the slip" : "today"} (1 = terrible, 10 = great)
            </label>
            <div className="flex items-center gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setMoodBefore(n)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                    moodBefore === n
                      ? n <= 3 ? "bg-[var(--accent-danger)] text-white" : n <= 6 ? "bg-[var(--accent-warning)] text-black" : "bg-[var(--accent-success)] text-black"
                      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-3">
              Stress level (1 = chill, 10 = maximum)
            </label>
            <div className="flex items-center gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setStressLevel(n)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                    stressLevel === n
                      ? n <= 3 ? "bg-[var(--accent-success)] text-black" : n <= 6 ? "bg-[var(--accent-warning)] text-black" : "bg-[var(--accent-danger)] text-white"
                      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-3">
              Sleep quality last night
            </label>
            <div className="flex items-center gap-3">
              {[
                { value: 1, label: "😵 Terrible" },
                { value: 2, label: "😐 Poor" },
                { value: 3, label: "🙂 OK" },
                { value: 4, label: "😊 Good" },
                { value: 5, label: "😴 Great" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSleepQuality(opt.value)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    sleepQuality === opt.value
                      ? "bg-[var(--accent-fire)] text-white"
                      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-3">
              Time of day
            </label>
            <div className="flex items-center gap-3">
              {["morning", "afternoon", "evening", "night"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeOfDay(t)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    timeOfDay === t
                      ? "bg-[var(--accent-fire)] text-white"
                      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <button onClick={nextStep} className="btn-fire w-full">
            Continue <ChevronRight className="w-4 h-4 inline ml-1" />
          </button>
        </div>
      )}

      {/* Step 5: Notes + Mood After */}
      {step === "notes" && (
        <div className="space-y-6 animate-slide-up">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            How do you feel RIGHT NOW? (1-10)
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {result === "success"
              ? "After holding the line — what's your emotional state?"
              : "After the slip — be honest about how it made you feel."}
          </p>
          <div className="flex items-center gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setMoodAfter(n)}
                className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                  moodAfter === n
                    ? n <= 3 ? "bg-[var(--accent-danger)] text-white" : n <= 6 ? "bg-[var(--accent-warning)] text-black" : "bg-[var(--accent-success)] text-black"
                    : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
              Anything else? (optional but powerful for AI analysis)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-forge min-h-[100px] resize-none"
              placeholder="What was going through your head today? What thoughts led to the craving? What helped you resist? Write freely..."
            />
          </div>

          {submitError && (
            <div className="bg-[var(--accent-danger-subtle)] border border-[var(--accent-danger)] rounded-xl p-4 text-sm text-[var(--accent-danger)] font-medium">
              ⚠️ {submitError}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-fire w-full py-4 text-base flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving your data...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit Check-in
              </>
            )}
          </button>
        </div>
      )}

      {/* Step 6: Done */}
      {step === "done" && (
        <div className="text-center py-12 animate-slide-up space-y-8">
          <div className="relative inline-block">
            <div className="w-24 h-24 rounded-3xl mx-auto flex items-center justify-center animate-fire-glow relative z-10" style={{
              background: result === "success" ? "var(--gradient-victory)" : "var(--gradient-forge)",
            }}>
              {result === "success" ? (
                <CheckCircle2 className="w-12 h-12 text-black" />
              ) : (
                <Flame className="w-12 h-12 text-white" />
              )}
            </div>
            {result === "success" && (
              <div className="absolute -top-2 -right-2 bg-[var(--accent-fire)] text-white text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter animate-bounce">
                +1 Day
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-black text-[var(--text-primary)]">
              {result === "success"
                ? "Another Day Conquered. 💪"
                : "The Truth Sets You Free. 🔥"}
            </h2>
            <p className="text-[var(--text-secondary)] max-w-md mx-auto text-sm">
              {result === "success"
                ? "Every repetition is a vote for the person you are becoming."
                : "Pain is information. You reported the breach, now we rebuild the defenses."}
            </p>
          </div>

          {result === "success" && selectedHabitData && (
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              <div className="card py-4 bg-[var(--bg-secondary)] border-none">
                <div className="text-2xl font-black text-[var(--accent-success)] counter-display animate-pulse">
                  ${((selectedHabitData.current_streak_days + 1) * (selectedHabitData.cost_per_unit || 0)).toFixed(2)}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest mt-1">
                  Saved Total
                </div>
              </div>
              <div className="card py-4 bg-[var(--bg-secondary)] border-none">
                <div className="text-2xl font-black text-[var(--accent-info)] counter-display animate-pulse">
                  {Math.round(((selectedHabitData.current_streak_days + 1) * (selectedHabitData.time_per_unit_minutes || 0)) / 60)}h
                </div>
                <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest mt-1">
                  Time Reclaimed
                </div>
              </div>
            </div>
          )}

          <div className="card bg-[var(--accent-fire-subtle)] border border-[rgba(255,77,0,0.2)] p-6 max-w-md mx-auto animate-slide-up" style={{ animationDelay: '0.4s' }}>
             <h3 className="text-sm font-bold text-[var(--accent-fire)] uppercase tracking-[0.2em] mb-2 flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" /> Identity Proof Point
             </h3>
             <p className="text-[var(--text-primary)] font-medium leading-relaxed italic">
                "{result === "success" 
                  ? `You just proved you are no longer the person who gave in. You ARE ${selectedHabitData?.name.toLowerCase()} free.`
                  : "Acknowledging the slip is proof of your new integrity. A liar would have hidden this. A warrior owns it."
                }"
             </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button onClick={() => router.push("/dashboard")} className="btn-fire w-full sm:w-auto px-8">
              Back to War Room
            </button>
            <button onClick={() => router.push("/journal")} className="btn-ghost w-full sm:w-auto px-8">
              🎙️ Record Journal
            </button>
          </div>
        </div>
      )}

      {/* Back button */}
      {step !== "habit" && step !== "done" && (
        <button
          onClick={prevStep}
          className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      )}
    </div>
  );
}
