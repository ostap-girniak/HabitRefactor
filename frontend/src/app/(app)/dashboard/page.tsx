"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import {
  Plus,
  TrendingUp,
  Clock,
  DollarSign,
  Brain,
  ChevronRight,
  Zap,
  Swords,
} from "lucide-react";
import { getCategoryEmoji, formatMoney } from "@/lib/utils";
import { SobrietyCounter } from "@/components/dashboard/SobrietyCounter";
import { StreakCalendar } from "@/components/dashboard/StreakCalendar";
import { GithubHeatmap } from "@/components/dashboard/GithubHeatmap";
import { useHabits, useDashboardStats, useCheckinCalendar, useAIInsights, useOracle, useBattleHistory } from "@/lib/hooks";
import type { Habit } from "@/lib/store";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area 
} from "recharts";

export default function DashboardPage() {
  const t = useT();
  const [selectedHabitId, setSelectedHabitId] = useState<string | undefined>(undefined);
  
  const { data: habitsData, isLoading: habitsLoading } = useHabits();
  const habits = (habitsData as Habit[]) || [];
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: insights } = useAIInsights({ limit: 1 });
  const { data: oracleData } = useOracle(selectedHabitId);
  const { data: battlesData } = useBattleHistory(selectedHabitId);
  
  // Find the selected habit object
  const activeHabit = selectedHabitId 
    ? habits.find((h) => h.id === selectedHabitId) 
    : habits.sort((a, b) => (b.current_streak_days || 0) - (a.current_streak_days || 0))[0];

  const { data: calendarDataRaw } = useCheckinCalendar(activeHabit?.id || "");
  const calendarData = (calendarDataRaw as any)?.calendar || [];
  const battles = (battlesData as any)?.battles || [];

  const isLoading = habitsLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-[var(--accent-fire)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--text-secondary)] font-medium animate-pulse">
          {t.dashboard_loading}
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
          <h1 className="text-3xl font-black text-[var(--text-primary)]">{t.dashboard_empty_title}</h1>
          <p className="text-[var(--text-secondary)]">
            {t.dashboard_empty_desc}
          </p>
        </div>
        <Link href="/habits/new" className="btn-fire px-8 py-4 text-lg">
          {t.dashboard_empty_cta}
        </Link>
      </div>
    );
  }

  const bestHabit = [...habits].sort((a, b) => (b.current_streak_days || 0) - (a.current_streak_days || 0))[0];
  const latestInsight = (insights as any)?.insights?.[0] || (insights as any)?.[0];

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header Overview */}
      <div>
        <h1 className="text-[var(--text-primary)] text-2xl font-black flex items-center gap-2">
          {t.dashboard_title}
        </h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          {activeHabit ? `${t.dashboard_subtitle_focus} ${activeHabit.name}` : t.dashboard_subtitle_global}
        </p>
      </div>

      {/* Habit Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        <button
          onClick={() => setSelectedHabitId(undefined)}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
            selectedHabitId === undefined
              ? "bg-[var(--accent-fire)] text-white border-[var(--accent-fire)] shadow-lg shadow-[rgba(255,77,0,0.2)]"
              : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--text-muted)]"
          }`}
        >
          {t.dashboard_all_battles}
        </button>
        {habits.map((h: any) => (
          <button
            key={h.id}
            onClick={() => setSelectedHabitId(h.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-2 ${
              selectedHabitId === h.id
                ? "bg-[var(--bg-elevated)] text-[var(--accent-fire)] border-[var(--accent-fire)] shadow-sm"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--text-muted)]"
            }`}
          >
            <span>{getCategoryEmoji(h.category)}</span>
            {h.name}
          </button>
        ))}
      </div>

      {/* AI Motivation Snippet */}
      {insights && insights.length > 0 && (insights[0] as any).tomorrow_action && (
        <div className="card bg-[var(--accent-fire-subtle)] border border-[rgba(255,77,0,0.2)]">
          <div className="flex items-start gap-3">
            <Brain className="w-5 h-5 text-[var(--accent-fire)] flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-[var(--accent-fire)] uppercase tracking-wider mb-1">
                {t.dashboard_ai_directive}
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {(insights[0] as any).tomorrow_action}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-6 border-[rgba(0,230,118,0.15)] bg-gradient-to-br from-[rgba(0,230,118,0.03)] to-transparent">
          <DollarSign className="w-8 h-8 text-[var(--accent-success)] mx-auto mb-2" />
          <div className="text-3xl font-black text-[var(--accent-success)] counter-display mb-1">
            {formatMoney(stats?.total_money_saved || 0)}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.2em] font-bold">{t.dashboard_stat_savings}</div>
        </div>

        <div className="card text-center py-6 border-[rgba(68,138,255,0.15)] bg-gradient-to-br from-[rgba(68,138,255,0.03)] to-transparent">
          <Clock className="w-8 h-8 text-[var(--accent-info)] mx-auto mb-2" />
          <div className="text-3xl font-black text-[var(--text-primary)] counter-display mb-1">
            {Math.round((stats?.total_time_saved_minutes || 0) / 60)}h
          </div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.2em] font-bold">{t.dashboard_stat_time}</div>
        </div>

        <div className="card text-center py-6 border-[rgba(255,140,0,0.15)] bg-gradient-to-br from-[rgba(255,140,0,0.03)] to-transparent">
          <Zap className="w-8 h-8 text-[var(--accent-ember)] mx-auto mb-2" />
          <div className="text-3xl font-black text-[var(--text-primary)] counter-display mb-1">
            {habits.length}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.2em] font-bold">{t.dashboard_stat_battles}</div>
        </div>
      </div>

      {/* The Oracle: Deep Analytics & Heatmap */}
      <div className="space-y-6">
        {/* 365-Day Activity Heatmap */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Swords className="w-5 h-5 text-[var(--accent-fire)]" />
              {t.dashboard_battle_history_365}
            </h2>
            <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider bg-[var(--bg-secondary)] px-2 py-1 rounded">
              {t.dashboard_consistency_map}
            </div>
          </div>
          <GithubHeatmap data={oracleData?.heatmap || []} />
        </div>

        {/* High-Risk Days & Hours */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Clock className="w-5 h-5 text-[var(--accent-danger)]" />
                {t.dashboard_risk_by_day}
              </h2>
            </div>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={oracleData?.weekday_risk || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                  <XAxis 
                    dataKey="weekday" 
                    stroke="var(--text-muted)" 
                    fontSize={10} 
                    tickFormatter={(val) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][val]} 
                  />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)', fontSize: '12px', borderRadius: '12px' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Bar dataKey="relapse" fill="var(--accent-danger)" radius={[4, 4, 0, 0]} barSize={20} name="Relapses" />
                  <Bar dataKey="success" fill="var(--accent-success)" radius={[4, 4, 0, 0]} opacity={0.2} barSize={20} name="Successes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-[var(--text-secondary)] text-center">
              {t.dashboard_risk_by_day_desc}
            </p>
          </div>

          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Zap className="w-5 h-5 text-[var(--accent-fire)]" />
                {t.dashboard_hourly_danger}
              </h2>
            </div>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={oracleData?.hourly_risk || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                  <XAxis 
                    dataKey="hour" 
                    stroke="var(--text-muted)" 
                    fontSize={10} 
                    tickFormatter={(val) => `${val}h`} 
                  />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)', fontSize: '12px', borderRadius: '12px' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Bar dataKey="relapse" fill="var(--accent-danger)" radius={[4, 4, 0, 0]} barSize={12} name="Relapses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {/* Oracle Forecast Insert */}
            {oracleData?.forecast && (
              <div className="pt-3 border-t border-[var(--border-default)]">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                    {t.dashboard_forecast}
                  </div>
                  <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${
                    oracleData.forecast.danger_zone
                      ? "text-[var(--accent-danger)] border-[rgba(255,23,68,0.35)] bg-[rgba(255,23,68,0.08)]"
                      : "text-[var(--accent-success)] border-[rgba(0,230,118,0.35)] bg-[rgba(0,230,118,0.08)]"
                  }`}>
                    {`${t.dashboard_risk} ${Math.round(oracleData.forecast.risk_score)}%`}
                  </div>
                </div>
                {oracleData.forecast.warning_report && (
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {oracleData.forecast.warning_report}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Risk Factors / Triggers */}
        {oracleData?.top_triggers?.length > 0 && (
          <div className="card">
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">
              {t.dashboard_triggers}
            </div>
            <div className="flex flex-wrap gap-2">
              {oracleData.top_triggers.map((t: any, i: number) => (
                <div key={i} className="px-3 py-1.5 bg-[rgba(255,77,0,0.1)] text-[var(--accent-fire)] text-xs font-bold rounded-lg border border-[rgba(255,77,0,0.15)] flex items-center gap-2 shadow-sm">
                  <span>{t.name}</span>
                  <span className="bg-[var(--accent-fire)] text-white px-1.5 py-0.5 rounded text-[10px]">{t.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Psychological Trends */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[var(--accent-info)]" />
              {t.dashboard_emotional_trajectory}
            </h2>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={oracleData?.recent_trends || []}>
                <defs>
                  <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-info)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-info)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                <XAxis dataKey="date" hide />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)', fontSize: '12px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="mood_before" 
                  stroke="var(--accent-info)" 
                  fillOpacity={1} 
                  fill="url(#colorMood)" 
                  strokeWidth={3}
                />
                <Area 
                  type="monotone" 
                  dataKey="stress_level" 
                  stroke="var(--accent-danger)" 
                  fill="none" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-[10px] font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1 text-[var(--accent-info)]">
              <div className="w-2 h-2 rounded-full bg-[var(--accent-info)]" /> {t.dashboard_mood}
            </span>
            <span className="flex items-center gap-1 text-[var(--accent-danger)]">
              <div className="w-2 h-0.5 bg-[var(--accent-danger)]" /> {t.dashboard_stress}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Sobriety Counter (Reactive to selection) */}
      {activeHabit && (
        <SobrietyCounter
          habitName={activeHabit.name}
          category={activeHabit.category}
          sobrietyStartDate={activeHabit.sobriety_start_date}
          currentStreakDays={activeHabit.current_streak_days || 0}
          bestStreakDays={activeHabit.best_streak_days || 0}
          costPerUnit={activeHabit.cost_per_unit || 0}
          timePerUnitMinutes={activeHabit.time_per_unit_minutes || 0}
          caloriesPerUnit={activeHabit.calories_per_unit || 0}
          unitName={activeHabit.unit_name || "units"}
        />
      )}

      {/* Battle History (The Past Victories Ledger) */}
      {battles.length > 0 && (
        <div className="card space-y-4">
          <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Swords className="w-5 h-5 text-[var(--accent-fire)]" />
            {t.dashboard_battle_history}
          </h2>
          <div className="space-y-3">
            {battles.slice(0, 5).map((battle: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
                <div>
                  <div className="font-bold text-sm text-[var(--text-primary)]">
                    {`${battle.habit_name}: ${battle.duration_days} ${t.dashboard_day_streak}`}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-1 flex items-center gap-2">
                    <span>{`${t.dashboard_ended} ${new Date(battle.end_date).toLocaleDateString()}`}</span>
                    {battle.trigger && (
                      <span className="px-1.5 py-0.5 bg-[rgba(255,77,0,0.05)] text-[var(--accent-fire)] rounded border border-[rgba(255,77,0,0.1)] uppercase">
                        {`${t.dashboard_trigger} ${battle.trigger}`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[var(--accent-success)] font-black text-xs">
                  {t.dashboard_past_victory}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Check-in CTA */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Link href="/checkin" className="btn-success w-full sm:flex-1 text-center py-4 text-base flex items-center justify-center gap-2">
          ✓ {t.dashboard_daily_checkin}
        </Link>
        <Link href="/journal" className="btn-ghost w-full sm:flex-1 text-center py-4 text-base">
          🎙️ {t.dashboard_record_journal}
        </Link>
      </div>

      {/* Streak Calendar (Only if data exists) */}
      <StreakCalendar 
        data={calendarData} 
        months={3} 
      />

      {/* Habits List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{t.dashboard_your_battles}</h2>
          <Link href="/habits" className="text-sm text-[var(--accent-fire)] hover:underline flex items-center gap-1">
            {t.dashboard_view_all} <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="space-y-3">
          {habits.slice(0, 3).map((habit, i) => (
            <Link
              key={habit.id}
              href={`/habits/${habit.id}`}
              className="card flex items-center gap-4 group animate-slide-up"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="text-3xl">{getCategoryEmoji(habit.category)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-fire)] transition-colors truncate">
                  {habit.name}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                  {`${t.dashboard_best} ${habit.best_streak_days || 0}d • ${formatMoney((habit.current_streak_days || 0) * (habit.cost_per_unit || 0))} ${t.dashboard_saved}`}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-black text-[var(--accent-success)] counter-display">
                  {habit.current_streak_days || 0}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{t.days}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-fire)]" />
            </Link>
          ))}
        </div>
      </div>

      {/* Latest AI Insight */}
      {latestInsight ? (
        <Link href={`/insights/${latestInsight.id}`} className="card-fire group cursor-pointer block animate-slide-up">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C4DFF] to-[#448AFF] flex items-center justify-center flex-shrink-0">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="badge badge-fire">{t.dashboard_new_insight}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {new Date(latestInsight.created_at).toLocaleDateString()}
                </span>
              </div>
              <h3 className="font-bold text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent-fire)] transition-colors truncate">
                {latestInsight.title}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                {latestInsight.summary}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--text-muted)] mt-1 group-hover:text-[var(--accent-fire)]" />
          </div>
        </Link>
      ) : (
        <div className="card bg-[var(--bg-secondary)] border-dashed border-2 flex items-center justify-center py-10 opacity-60">
          <p className="text-[var(--text-muted)] text-sm">
            {t.dashboard_ai_analyzing}
          </p>
        </div>
      )}
    </div>
  );
}
