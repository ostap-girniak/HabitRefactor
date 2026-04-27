"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  Settings,
  CalendarCheck,
  TrendingUp,
  DollarSign,
  Clock,
  Target,
  AlertTriangle,
  Flame,
} from "lucide-react";
import { SobrietyCounter } from "@/components/dashboard/SobrietyCounter";
import { StreakCalendar } from "@/components/dashboard/StreakCalendar";
import { getCategoryEmoji, formatMoney } from "@/lib/utils";
import { useHabit, useCheckinCalendar } from "@/lib/hooks";

export default function HabitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const habitId = params.id as string;

  const { data: habit, isLoading: habitLoading } = useHabit(habitId);
  const { data: calendarData } = useCheckinCalendar(habitId);

  if (habitLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-[var(--accent-fire)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--text-secondary)] font-medium">Analyzing battle records...</p>
      </div>
    );
  }

  if (!habit) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <div className="text-5xl mb-4">🚫</div>
        <h2 className="text-2xl font-black text-[var(--text-primary)]">Battle Not Found</h2>
        <p className="text-[var(--text-secondary)] mt-2">This habit record does not exist in your archive.</p>
        <Link href="/habits" className="btn-fire mt-6 inline-block">Return to Arsenal</Link>
      </div>
    );
  }

  const moneySaved = (habit.current_streak_days || 0) * (habit.cost_per_unit || 0);
  const timeSavedHours = Math.round(((habit.current_streak_days || 0) * (habit.time_per_unit_minutes || 0)) / 60);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getCategoryEmoji(habit.category)}</span>
              <h1 className="text-2xl font-black text-[var(--text-primary)]">{habit.name}</h1>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">{habit.description}</p>
          </div>
        </div>
        <button className="btn-ghost text-sm flex items-center gap-1">
          <Settings className="w-4 h-4" /> Edit
        </button>
      </div>

      {/* Sobriety Counter */}
      <SobrietyCounter
        habitName={habit.name}
        category={habit.category}
        sobrietyStartDate={habit.sobriety_start_date}
        currentStreakDays={habit.current_streak_days || 0}
        bestStreakDays={habit.best_streak_days || 0}
        costPerUnit={habit.cost_per_unit || 0}
        timePerUnitMinutes={habit.time_per_unit_minutes || 0}
        caloriesPerUnit={habit.calories_per_unit || 0}
        unitName={habit.unit_name || "units"}
      />

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link href="/checkin" className="btn-success flex-1 text-center py-3 flex items-center justify-center gap-2">
          <CalendarCheck className="w-5 h-5" /> Check In
        </Link>
        <Link href="/journal" className="btn-ghost flex-1 text-center py-3">
          🎙️ Journal Entry
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card text-center py-4">
          <TrendingUp className="w-5 h-5 text-[var(--accent-success)] mx-auto mb-1" />
          <div className="text-xl font-black text-[var(--text-primary)]">{habit.current_streak_days || 0}</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Current</div>
        </div>
        <div className="card text-center py-4">
          <Target className="w-5 h-5 text-[var(--accent-ember)] mx-auto mb-1" />
          <div className="text-xl font-black text-[var(--text-primary)]">{habit.best_streak_days || 0}</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Best</div>
        </div>
        {(habit.cost_per_unit || 0) > 0 && (
          <div className="card text-center py-4">
            <DollarSign className="w-5 h-5 text-[var(--accent-success)] mx-auto mb-1" />
            <div className="text-xl font-black text-[var(--accent-success)]">{formatMoney(moneySaved)}</div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Saved</div>
          </div>
        )}
        <div className="card text-center py-4">
          <AlertTriangle className="w-5 h-5 text-[var(--accent-danger)] mx-auto mb-1" />
          <div className="text-xl font-black text-[var(--accent-danger)]">{habit.total_relapses || 0}</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase">Relapses</div>
        </div>
      </div>

      {/* Calendar */}
      <StreakCalendar data={(calendarData as any)?.calendar || []} months={3} />

      {/* Known Triggers */}
      {habit.initial_triggers && habit.initial_triggers.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Flame className="w-4 h-4 text-[var(--accent-fire)]" />
            Identified Triggers
          </h3>
          <div className="flex flex-wrap gap-2">
            {habit.initial_triggers.map((trigger: string, i: number) => (
              <div key={i} className="bg-[var(--bg-elevated)] rounded-lg px-4 py-2 text-sm text-[var(--text-primary)] border border-[var(--border-default)]">
                {trigger}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alternative Behavior */}
      {habit.alternative_behavior && (
        <div className="card bg-[var(--accent-success-subtle)] border-[rgba(0,230,118,0.2)]">
          <h3 className="font-bold text-[var(--accent-success)] mb-1 text-sm uppercase tracking-wide">
            ↪ Do This Instead
          </h3>
          <p className="text-[var(--text-primary)]">{habit.alternative_behavior}</p>
        </div>
      )}

      {/* Info */}
      <div className="card">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-[var(--text-muted)] text-xs uppercase mb-1">Approach</div>
            <div className="text-[var(--text-primary)] font-semibold capitalize">
              {habit.approach?.replace("_", " ") || "Not set"}
            </div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] text-xs uppercase mb-1">Target</div>
            <div className="text-[var(--text-primary)] font-semibold capitalize">{habit.target_frequency || "Daily"}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] text-xs uppercase mb-1">Tracking Unit</div>
            <div className="text-[var(--text-primary)] font-semibold">{habit.unit_name || "units"}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] text-xs uppercase mb-1">Cost per {habit.unit_name || "unit"}</div>
            <div className="text-[var(--text-primary)] font-semibold">{formatMoney(habit.cost_per_unit || 0)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
