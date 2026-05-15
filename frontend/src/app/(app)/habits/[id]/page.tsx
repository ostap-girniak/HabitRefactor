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
import { useT } from "@/lib/i18n";

export default function HabitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useT();
  const habitId = params.id as string;

  const { data: habit, isLoading: habitLoading } = useHabit(habitId);
  const { data: calendarData } = useCheckinCalendar(habitId);

  if (habitLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-[var(--accent-fire)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--text-secondary)] font-medium">{t.habit_detail_loading}</p>
      </div>
    );
  }

  if (!habit) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <div className="text-5xl mb-4">🚫</div>
        <h2 className="text-2xl font-black text-[var(--text-primary)]">{t.habit_detail_not_found}</h2>
        <p className="text-[var(--text-secondary)] mt-2">{t.habit_detail_not_found_desc}</p>
        <Link href="/habits" className="btn-fire mt-6 inline-block">{t.habit_detail_return}</Link>
      </div>
    );
  }

  const moneySaved = (habit.current_streak_days || 0) * (habit.cost_per_unit || 0);

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
          <Settings className="w-4 h-4" /> {t.edit}
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
          <CalendarCheck className="w-5 h-5" /> {t.habit_detail_checkin}
        </Link>
        <Link href="/journal" className="btn-ghost flex-1 text-center py-3">
          {t.habit_detail_journal}
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card text-center py-4">
          <TrendingUp className="w-5 h-5 text-[var(--accent-success)] mx-auto mb-1" />
          <div className="text-xl font-black text-[var(--text-primary)]">{habit.current_streak_days || 0}</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase">{t.habit_detail_current}</div>
        </div>
        <div className="card text-center py-4">
          <Target className="w-5 h-5 text-[var(--accent-ember)] mx-auto mb-1" />
          <div className="text-xl font-black text-[var(--text-primary)]">{habit.best_streak_days || 0}</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase">{t.habit_detail_best}</div>
        </div>
        {(habit.cost_per_unit || 0) > 0 && (
          <div className="card text-center py-4">
            <DollarSign className="w-5 h-5 text-[var(--accent-success)] mx-auto mb-1" />
            <div className="text-xl font-black text-[var(--accent-success)]">{formatMoney(moneySaved)}</div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase">{t.habit_detail_saved}</div>
          </div>
        )}
        <div className="card text-center py-4">
          <AlertTriangle className="w-5 h-5 text-[var(--accent-danger)] mx-auto mb-1" />
          <div className="text-xl font-black text-[var(--accent-danger)]">{habit.total_relapses || 0}</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase">{t.habit_detail_relapses}</div>
        </div>
      </div>

      {/* Calendar */}
      <StreakCalendar data={(calendarData as any)?.calendar || []} months={3} />

      {/* Known Triggers */}
      {habit.initial_triggers && habit.initial_triggers.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Flame className="w-4 h-4 text-[var(--accent-fire)]" />
            {t.habit_detail_triggers}
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
            {t.habit_detail_instead}
          </h3>
          <p className="text-[var(--text-primary)]">{habit.alternative_behavior}</p>
        </div>
      )}

      {/* Info */}
      <div className="card">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-[var(--text-muted)] text-xs uppercase mb-1">{t.habit_detail_approach}</div>
            <div className="text-[var(--text-primary)] font-semibold capitalize">
              {habit.approach?.replace("_", " ") || t.habit_detail_not_set}
            </div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] text-xs uppercase mb-1">{t.habit_detail_target}</div>
            <div className="text-[var(--text-primary)] font-semibold capitalize">{habit.target_frequency || "Daily"}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] text-xs uppercase mb-1">{t.habit_detail_tracking_unit}</div>
            <div className="text-[var(--text-primary)] font-semibold">{habit.unit_name || "units"}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] text-xs uppercase mb-1">{t.habit_detail_cost_per.replace("{unit}", habit.unit_name || "unit")}</div>
            <div className="text-[var(--text-primary)] font-semibold">{formatMoney(habit.cost_per_unit || 0)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
