"use client";

import Link from "next/link";
import { Plus, ChevronRight, TrendingUp, AlertTriangle, Swords } from "lucide-react";
import { getCategoryEmoji, formatMoney, getStreakMessage } from "@/lib/utils";
import { useHabits } from "@/lib/hooks";
import type { Habit } from "@/lib/store";
import { useT } from "@/lib/i18n";

export default function HabitsPage() {
  const t = useT();
  const { data: habitsData, isLoading } = useHabits();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-[var(--accent-fire)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--text-secondary)] font-medium animate-pulse">
          {t.habits_loading}
        </p>
      </div>
    );
  }

  const habits = (habitsData as Habit[]) || [];

  if (!habits || habits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-6 animate-fade-in">
        <div className="w-20 h-20 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center mb-2">
          <Swords className="w-10 h-10 text-[var(--accent-fire)]" />
        </div>
        <div className="max-w-md space-y-2">
          <h1 className="text-3xl font-black text-[var(--text-primary)]">{t.habits_empty_title}</h1>
          <p className="text-[var(--text-secondary)]">
            {t.habits_empty_desc}
          </p>
        </div>
        <Link href="/habits/new" className="btn-fire px-8 py-4 text-lg flex items-center gap-2">
          <Plus className="w-5 h-5" /> {t.habits_start_battle}
        </Link>
      </div>
    );
  }

  const totalCleanDays = habits.reduce((sum: number, h) => sum + (h.current_streak_days || 0), 0);
  const totalRelapses = habits.reduce((sum: number, h) => sum + (h.total_relapses || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)]">
            {t.habits_title} ⚔️
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            {t.habits_subtitle}
          </p>
        </div>
        <Link href="/habits/new" className="btn-fire flex items-center gap-2 text-sm text-center">
          <Plus className="w-4 h-4" />
          {t.habits_new_battle}
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-black text-[var(--accent-success)]">{habits.length}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1 uppercase tracking-tight">{t.habits_active}</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-black text-[var(--accent-fire)]">
            {totalCleanDays}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1 uppercase tracking-tight">{t.habits_clean_days}</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-black text-[var(--accent-danger)]">
            {totalRelapses}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1 uppercase tracking-tight">{t.habits_relapses}</div>
        </div>
      </div>

      {/* Habits list */}
      <div className="space-y-4">
        {habits.map((habit, i) => {
          const moneySaved = (habit.current_streak_days || 0) * (habit.cost_per_unit || 0);
          const totalDays = (habit.current_streak_days || 0) + (habit.total_relapses || 0);
          const successRate = totalDays > 0
            ? Math.round(((habit.current_streak_days || 0) / totalDays) * 100)
            : 100;

          return (
            <Link
              key={habit.id}
              href={`/habits/${habit.id}`}
              className="card group cursor-pointer animate-slide-up block"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl flex-shrink-0">{getCategoryEmoji(habit.category)}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg text-[var(--text-primary)] group-hover:text-[var(--accent-fire)] transition-colors truncate">
                      {habit.name}
                    </h3>
                    {(habit.current_streak_days || 0) >= (habit.best_streak_days || 0) && (habit.best_streak_days || 0) > 0 && (
                      <span className="badge badge-success text-[10px] flex-shrink-0">🏆 RECORD</span>
                    )}
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">
                    {habit.description}
                  </p>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="bg-[var(--bg-elevated)] rounded-lg px-3 py-2">
                      <div className="text-[10px] text-[var(--text-muted)] uppercase">{t.habits_streak}</div>
                      <div className="text-sm font-bold text-[var(--accent-success)]">
                        {habit.current_streak_days || 0}d
                      </div>
                    </div>
                    <div className="bg-[var(--bg-elevated)] rounded-lg px-3 py-2">
                      <div className="text-[10px] text-[var(--text-muted)] uppercase">{t.habits_best}</div>
                      <div className="text-sm font-bold text-[var(--text-primary)]">
                        {habit.best_streak_days || 0}d
                      </div>
                    </div>
                    <div className="bg-[var(--bg-elevated)] rounded-lg px-3 py-2">
                      <div className="text-[10px] text-[var(--text-muted)] uppercase">{t.habits_saved}</div>
                      <div className="text-sm font-bold text-[var(--accent-success)]">
                        {formatMoney(moneySaved)}
                      </div>
                    </div>
                    <div className="bg-[var(--bg-elevated)] rounded-lg px-3 py-2">
                      <div className="text-[10px] text-[var(--text-muted)] uppercase">{t.habits_win_rate}</div>
                      <div className={`text-sm font-bold ${successRate >= 70 ? "text-[var(--accent-success)]" : successRate >= 40 ? "text-[var(--accent-warning)]" : "text-[var(--accent-danger)]"}`}>
                        {successRate}%
                      </div>
                    </div>
                  </div>

                  {/* Alternative behavior */}
                  {habit.alternative_behavior && (
                    <div className="mt-3 text-xs text-[var(--text-muted)] flex items-center gap-1.5 p-2 bg-[var(--bg-primary)] rounded-lg italic">
                      <span className="text-[var(--accent-info)] not-italic">↪</span> {t.habits_instead}: {habit.alternative_behavior}
                    </div>
                  )}
                </div>

                <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-fire)] mt-2 flex-shrink-0" />
              </div>

              {/* Motivational message */}
              <div className="mt-3 pt-3 border-t border-[var(--border-default)] text-xs text-[var(--text-muted)] italic">
                {getStreakMessage(habit.current_streak_days || 0)}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
