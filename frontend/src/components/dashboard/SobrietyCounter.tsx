"use client";

import { useEffect, useState, useCallback } from "react";
import { Flame, TrendingUp, Trophy } from "lucide-react";
import { formatMoney, getStreakMessage, getCategoryEmoji } from "@/lib/utils";

interface SobrietyCounterProps {
  habitName: string;
  category: string;
  sobrietyStartDate: string; // ISO date string
  currentStreakDays: number;
  bestStreakDays: number;
  costPerUnit: number;
  timePerUnitMinutes: number;
  caloriesPerUnit: number;
  unitName: string;
}

export function SobrietyCounter({
  habitName,
  category,
  sobrietyStartDate,
  currentStreakDays,
  bestStreakDays,
  costPerUnit,
  timePerUnitMinutes,
  caloriesPerUnit,
  unitName,
}: SobrietyCounterProps) {
  const [elapsed, setElapsed] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isNewRecord, setIsNewRecord] = useState(false);

  const calculateElapsed = useCallback(() => {
    const start = new Date(sobrietyStartDate);
    const now = new Date();
    const diff = now.getTime() - start.getTime();

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    setElapsed({ days, hours, minutes, seconds });
    setIsNewRecord(days >= bestStreakDays && bestStreakDays > 0);
  }, [sobrietyStartDate, bestStreakDays]);

  useEffect(() => {
    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);
    return () => clearInterval(interval);
  }, [calculateElapsed]);

  const moneySaved = elapsed.days * costPerUnit;
  const timeSavedHours = Math.round((elapsed.days * timePerUnitMinutes) / 60);
  const caloriesAvoided = elapsed.days * caloriesPerUnit;

  return (
    <div className="card-fire p-6 md:p-10 text-center relative overflow-hidden">
      {/* Background subtle glow effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(255,77,0,0.06)] to-transparent pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[radial-gradient(ellipse_at_center,rgba(255,77,0,0.08)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative z-10">
        {/* Habit label */}
        <div className="inline-flex items-center gap-2 text-sm text-[var(--accent-fire)] font-bold uppercase tracking-[0.15em] mb-4">
          <span className="text-xl">{getCategoryEmoji(category)}</span>
          {habitName} — Sobriety Counter
        </div>

        {/* New record badge */}
        {isNewRecord && (
          <div className="flex items-center justify-center gap-2 mb-3 animate-slide-up">
            <span className="badge badge-success flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              NEW PERSONAL RECORD!
            </span>
          </div>
        )}

        {/* Main counter */}
        <div className="my-6">
          <div
            className={`text-8xl md:text-[10rem] font-black text-[var(--text-primary)] counter-display leading-none tracking-tight ${
              isNewRecord ? "animate-fire-glow rounded-2xl" : ""
            }`}
          >
            {elapsed.days}
          </div>
          <div className="text-lg md:text-xl text-[var(--text-secondary)] font-semibold mt-2 uppercase tracking-[0.2em]">
            Days Clean
          </div>
        </div>

        {/* Sub-counter HH:MM:SS */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {[
            { value: elapsed.hours, label: "h" },
            { value: elapsed.minutes, label: "m" },
            { value: elapsed.seconds, label: "s" },
          ].map((unit, i) => (
            <div key={unit.label} className="flex items-center">
              {i > 0 && <span className="text-[var(--text-muted)] text-2xl font-light mx-1">:</span>}
              <div className="bg-[var(--bg-elevated)] rounded-lg px-3 py-2 min-w-[56px]">
                <div className="text-2xl md:text-3xl font-bold counter-display text-[var(--text-primary)]">
                  {String(unit.value).padStart(2, "0")}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                  {unit.label === "h" ? "hours" : unit.label === "m" ? "min" : "sec"}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Savings row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          {costPerUnit > 0 && (
            <div className="bg-[var(--bg-elevated)] rounded-xl p-3">
              <div className="text-xs text-[var(--text-muted)] mb-1">💰 Money Saved</div>
              <div className="text-lg font-bold text-[var(--accent-success)]">
                {formatMoney(moneySaved)}
              </div>
            </div>
          )}
          {timePerUnitMinutes > 0 && (
            <div className="bg-[var(--bg-elevated)] rounded-xl p-3">
              <div className="text-xs text-[var(--text-muted)] mb-1">⏰ Time Reclaimed</div>
              <div className="text-lg font-bold text-[var(--accent-info)]">
                {timeSavedHours}h
              </div>
            </div>
          )}
          {caloriesPerUnit > 0 && (
            <div className="bg-[var(--bg-elevated)] rounded-xl p-3">
              <div className="text-xs text-[var(--text-muted)] mb-1">🔥 Calories Avoided</div>
              <div className="text-lg font-bold text-[var(--accent-ember)]">
                {caloriesAvoided.toLocaleString()}
              </div>
            </div>
          )}
          <div className="bg-[var(--bg-elevated)] rounded-xl p-3">
            <div className="text-xs text-[var(--text-muted)] mb-1">🏆 Best Streak</div>
            <div className={`text-lg font-bold ${isNewRecord ? "text-[var(--accent-success)]" : "text-[var(--text-primary)]"}`}>
              {Math.max(bestStreakDays, elapsed.days)} days
            </div>
          </div>
        </div>

        {/* Motivational message */}
        <div className="text-sm text-[var(--text-secondary)] italic flex items-center justify-center gap-2">
          <Flame className="w-4 h-4 text-[var(--accent-fire)]" />
          {getStreakMessage(elapsed.days)}
        </div>
      </div>
    </div>
  );
}
