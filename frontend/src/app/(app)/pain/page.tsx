"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  Clock,
  Heart,
  TrendingDown,
  AlertTriangle,
  Flame,
  Skull,
  ChevronDown,
  Swords,
} from "lucide-react";
import { formatMoney, getCategoryEmoji } from "@/lib/utils";
import { useHabits, usePainProjection } from "@/lib/hooks";
import type { Habit } from "@/lib/store";
import { useT } from "@/lib/i18n";

// Generate projections based on real habit data
function generateProjections(costPerUnit: number, timePerUnitMinutes: number, caloriesPerUnit: number, unitName: string) {
  const dailyCost = costPerUnit;
  const dailyTimeMinutes = timePerUnitMinutes;
  const dailyCalories = caloriesPerUnit;

  return [
    {
      months: 1,
      days: 30,
      money_lost: Math.round(dailyCost * 30),
      time_lost_hours: Math.round((dailyTimeMinutes * 30) / 60),
      calories: Math.round(dailyCalories * 30),
      life_years: 0.02,
      money_alt: dailyCost * 30 > 5000 ? "A weekend getaway trip" : dailyCost * 30 > 1000 ? "A premium pair of running shoes" : "A nice dinner out",
      time_alt: "Complete an online course",
    },
    {
      months: 3,
      days: 90,
      money_lost: Math.round(dailyCost * 90),
      time_lost_hours: Math.round((dailyTimeMinutes * 90) / 60),
      calories: Math.round(dailyCalories * 90),
      life_years: 0.06,
      money_alt: dailyCost * 90 > 10000 ? "A vacation abroad" : dailyCost * 90 > 3000 ? "New tech gadget" : "A gym membership for a year",
      time_alt: "Read 15 books cover to cover",
    },
    {
      months: 6,
      days: 180,
      money_lost: Math.round(dailyCost * 180),
      time_lost_hours: Math.round((dailyTimeMinutes * 180) / 60),
      calories: Math.round(dailyCalories * 180),
      life_years: 0.12,
      money_alt: dailyCost * 180 > 20000 ? "A used car" : dailyCost * 180 > 5000 ? "New laptop or gaming setup" : "A weekend trip",
      time_alt: "Learn a musical instrument to intermediate level",
    },
    {
      months: 12,
      days: 365,
      money_lost: Math.round(dailyCost * 365),
      time_lost_hours: Math.round((dailyTimeMinutes * 365) / 60),
      calories: Math.round(dailyCalories * 365),
      life_years: 0.25,
      money_alt: dailyCost * 365 > 50000 ? "A down payment on an apartment" : dailyCost * 365 > 10000 ? "Vacation abroad with your partner" : "A life-changing experience",
      time_alt: `${Math.round((dailyTimeMinutes * 365) / 60 / 24)} full days of pure living — gone forever`,
    },
  ];
}

// Category-specific health impact descriptions
function getHealthImpact(category: string, months: number): string {
  const impacts: Record<string, Record<number, string>> = {
    smoking: {
      1: "Early-stage tar buildup in lungs. Carbon monoxide levels consistently elevated. Reduced blood oxygen.",
      3: "Chronic bronchitis symptoms. Skin aging accelerates. Cardiovascular stress markers elevated by 15%.",
      6: "Significant lung capacity reduction (-20%). Pre-cancerous cell changes possible. Immune system weakened.",
      12: "COPD risk increases 3x. Heart disease risk up 40%. Average life expectancy reduced by 7-10 years.",
    },
    alcohol: {
      1: "Liver stress increases. Sleep quality degrades significantly. Mood swings and anxiety intensify.",
      3: "Early fatty liver disease. Cognitive decline measurable. Relationships under heavy strain.",
      6: "Liver damage accelerating. Depression risk doubles. Weight gain and metabolic syndrome risk.",
      12: "Liver disease risk 4x higher. Brain shrinkage measurable. Relationship and career damage compounding.",
    },
    social_media: {
      1: "Attention span declining. Comparison anxiety increasing. Sleep disruption from blue light.",
      3: "Dopamine receptors desensitizing. Real-world social skills atrophying. Productivity declining.",
      6: "Clinical anxiety symptoms possible. Deep work capability significantly reduced. Self-esteem eroding.",
      12: "Depression risk elevated. Multiple hours daily of unrealized potential. Identity shaped by algorithm.",
    },
    default: {
      1: "The neural pathways of this habit are strengthening. Breaking free gets harder every day.",
      3: "Your brain is now wired to seek this habit automatically. Willpower alone can't fight neurology.",
      6: "This habit has become deeply embedded in your identity. Major health and lifestyle costs accumulating.",
      12: "A full year of compounding damage. The cost is no longer just today — it's your future self paying the price.",
    },
  };

  const categoryImpacts = impacts[category] || impacts.default;
  return categoryImpacts[months] || categoryImpacts[12] || impacts.default[months];
}

export default function PainPage() {
  const t = useT();
  const { data: habitsData, isLoading } = useHabits();
  const [expandedMonth, setExpandedMonth] = useState<number | null>(12);
  const [selectedHabitIndex, setSelectedHabitIndex] = useState(0);

  const habits = (habitsData as Habit[]) || [];
  const safeSelectedHabitIndex = Math.min(
    Math.max(selectedHabitIndex, 0),
    Math.max(habits.length - 1, 0)
  );
  const selectedHabit = habits[safeSelectedHabitIndex];
  
  const { data: aiProjections, isLoading: loadingProjections } = usePainProjection(selectedHabit?.id);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-[var(--accent-fire)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--text-secondary)] font-medium animate-pulse">
          {t.pain_loading}
        </p>
      </div>
    );
  }

  if (!habits || habits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-6 animate-fade-in">
        <div className="w-20 h-20 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center mb-2">
          <Swords className="w-10 h-10 text-[var(--accent-fire)]" />
        </div>
        <div className="max-w-md space-y-2">
          <h1 className="text-3xl font-black text-[var(--text-primary)]">{t.pain_no_data_title}</h1>
          <p className="text-[var(--text-secondary)]">{t.pain_no_data_desc}</p>
        </div>
        <Link href="/habits/new" className="btn-fire px-8 py-4 text-lg">{t.pain_no_data_cta}</Link>
      </div>
    );
  }

  // Use AI projections if available, otherwise fallback to local calculation
  const projections = (aiProjections as any)?.projections || generateProjections(
    selectedHabit.cost_per_unit || 0,
    selectedHabit.time_per_unit_minutes || 0,
    selectedHabit.calories_per_unit || 0,
    selectedHabit.unit_name || "units"
  );

  const hasFinancialData = (selectedHabit.cost_per_unit || 0) > 0;
  const hasTimeData = (selectedHabit.time_per_unit_minutes || 0) > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-[var(--text-primary)]">
          {t.pain_title}
        </h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          {t.pain_subtitle}
        </p>
      </div>

      {/* Habit selector */}
      {habits.length > 1 ? (
        <div className="card-fire p-4">
          <div className="text-sm text-[var(--text-muted)] mb-2">{t.pain_select_battle}</div>
          <div className="flex flex-wrap gap-2">
            {habits.map((habit, i) => (
              <button
                key={habit.id}
                onClick={() => { setSelectedHabitIndex(i); setExpandedMonth(12); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  i === safeSelectedHabitIndex
                    ? "bg-[var(--accent-fire)] text-white"
                    : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <span>{getCategoryEmoji(habit.category)}</span>
                {habit.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="card-fire p-4 flex items-center gap-3">
          <span className="text-2xl">{getCategoryEmoji(selectedHabit.category)}</span>
          <div className="flex-1">
            <div className="text-sm text-[var(--text-muted)]">{t.pain_showing_for}</div>
            <div className="font-bold text-[var(--text-primary)]">{selectedHabit.name}</div>
          </div>
          {hasFinancialData && (
            <span className="badge badge-danger">{formatMoney(selectedHabit.cost_per_unit)}/{selectedHabit.unit_name || "unit"} × daily</span>
          )}
        </div>
      )}

      {/* Warning banner */}
      <div className="bg-[var(--accent-danger-subtle)] border border-[rgba(255,23,68,0.3)] rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[var(--accent-danger)] flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-[var(--accent-danger)] text-sm">{t.pain_warning_title}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-1">
            {t.pain_warning_desc} <strong>{selectedHabit.name}</strong> {t.pain_warning_desc2}
          </div>
        </div>
      </div>

      {/* No data warning */}
      {!hasFinancialData && !hasTimeData && (
        <div className="card bg-[var(--bg-secondary)] border-dashed border-2 text-center py-6">
          <p className="text-[var(--text-muted)] text-sm">
            💡 {t.pain_add_cost_hint}
          </p>
          <Link href={`/habits/${selectedHabit.id}`} className="text-[var(--accent-fire)] text-sm hover:underline mt-2 inline-block">
            {t.pain_edit_habit}
          </Link>
        </div>
      )}

      {/* Timeline projections */}
      <div className="space-y-4">
        {projections.map((proj: any) => {
          const isExpanded = expandedMonth === proj.months;
          const healthImpact = getHealthImpact(selectedHabit.category, proj.months);

          return (
            <div key={proj.months} className="card overflow-hidden animate-slide-up">
              <button
                onClick={() => setExpandedMonth(isExpanded ? null : proj.months)}
                className="w-full flex items-center gap-4 text-left"
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  proj.months <= 3 ? "bg-[rgba(255,214,0,0.1)]" :
                  proj.months <= 6 ? "bg-[rgba(255,109,0,0.1)]" :
                  "bg-[var(--accent-danger-subtle)]"
                }`}>
                  <div className={`text-xl font-black ${
                    proj.months <= 3 ? "text-[var(--accent-warning)]" :
                    proj.months <= 6 ? "text-[var(--accent-ember)]" :
                    "text-[var(--accent-danger)]"
                  }`}>
                    {proj.months}m
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[var(--text-primary)]">
                    {proj.months === 1 ? t.pain_in_month.replace("{n}", "1") : t.pain_in_months.replace("{n}", String(proj.months))}
                  </div>
                  <div className="text-sm text-[var(--text-secondary)] flex items-center gap-3">
                    {hasFinancialData && (
                      <span className="text-[var(--accent-danger)] font-semibold">
                        -{formatMoney(proj.money_lost)}
                      </span>
                    )}
                    {hasFinancialData && hasTimeData && <span className="text-[var(--text-muted)]">•</span>}
                    {hasTimeData && (
                      <span className="text-[var(--accent-warning)]">
                        -{proj.time_lost_hours}h
                      </span>
                    )}
                  </div>
                </div>

                <ChevronDown className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-[var(--border-default)] space-y-4 animate-slide-up">
                  <div className="grid grid-cols-2 gap-3">
                    {hasFinancialData && (
                      <div className="bg-[var(--bg-elevated)] rounded-xl p-3">
                        <DollarSign className="w-4 h-4 text-[var(--accent-danger)] mb-1" />
                        <div className="text-lg font-black text-[var(--accent-danger)]">
                          {formatMoney(proj.money_lost)}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] uppercase">{t.pain_money_burned}</div>
                      </div>
                    )}
                    {hasTimeData && (
                      <div className="bg-[var(--bg-elevated)] rounded-xl p-3">
                        <Clock className="w-4 h-4 text-[var(--accent-warning)] mb-1" />
                        <div className="text-lg font-black text-[var(--accent-warning)]">
                          {proj.time_lost_hours}h
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] uppercase">{t.pain_time_wasted}</div>
                      </div>
                    )}
                    {(selectedHabit.calories_per_unit || 0) > 0 && (
                      <div className="bg-[var(--bg-elevated)] rounded-xl p-3">
                        <Flame className="w-4 h-4 text-[var(--accent-ember)] mb-1" />
                        <div className="text-lg font-black text-[var(--accent-ember)]">
                          {proj.calories.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] uppercase">{t.pain_calories}</div>
                      </div>
                    )}
                    <div className="bg-[var(--bg-elevated)] rounded-xl p-3">
                      <Skull className="w-4 h-4 text-[var(--accent-danger)] mb-1" />
                      <div className="text-lg font-black text-[var(--accent-danger)]">
                        {proj.life_years} yrs
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] uppercase">{t.pain_life_lost}</div>
                    </div>
                  </div>

                  {/* Health impact */}
                  <div className="bg-[var(--accent-danger-subtle)] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="w-4 h-4 text-[var(--accent-danger)]" />
                      <span className="text-sm font-bold text-[var(--accent-danger)]">{t.pain_health_impact}</span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">{healthImpact}</p>
                  </div>

                  {/* What you could have instead */}
                  {(hasFinancialData || hasTimeData) && (
                    <div className="bg-[var(--accent-success-subtle)] rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="w-4 h-4 text-[var(--accent-success)]" />
                        <span className="text-sm font-bold text-[var(--accent-success)]">{t.pain_could_have}</span>
                      </div>
                      <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                        {hasFinancialData && <p>💰 <strong>{formatMoney(proj.money_lost)}</strong> → {proj.money_alt}</p>}
                        {hasTimeData && <p>⏰ <strong>{proj.time_lost_hours} hours</strong> → {proj.time_alt}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom CTA */}
      <div className="card-fire p-6 text-center">
        <p className="text-lg font-bold text-[var(--text-primary)] mb-2">
          {t.pain_cta_title}
        </p>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          {t.pain_cta_desc} {selectedHabit.name} {t.pain_cta_desc2}
        </p>
        <Link href="/checkin" className="btn-fire text-base inline-block">
          {t.pain_cta_btn}
        </Link>
      </div>
    </div>
  );
}
