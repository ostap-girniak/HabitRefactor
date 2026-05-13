"use client";

import { useState } from "react";
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Trophy,
  Search,
  ChevronRight,
  Sparkles,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Swords,
  Trash2,
} from "lucide-react";
import { useAIInsights, useGenerateDailyAnalysis, useGenerateWeeklyAnalysis, useDeleteAIInsight } from "@/lib/hooks";
import { useT } from "@/lib/i18n";

interface Insight {
  id: string;
  analysis_type: string;
  title: string;
  summary: string;
  created_at: string;
  severity_score: number;
  insights: { type: string; title: string; description: string; severity: number }[];
  recommendations: { type: string; title: string; description: string }[];
  trigger_patterns: { trigger: string; frequency: string; correlation: string }[];
  tomorrow_action: string;
  motivational_close: string;
}

const renderWithLinks = (text: string) => {
  if (!text) return null;
  // Regex to match [text](url)
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>);
    }
    parts.push(
      <a
        key={`link-${match.index}`}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--accent-fire)] underline hover:opacity-80 transition-opacity font-medium"
        onClick={(e) => e.stopPropagation()}
      >
        {match[1]}
      </a>
    );
    lastIndex = linkRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
  }

  return parts.length > 0 ? <>{parts}</> : <>{text}</>;
};

export default function InsightsPage() {
  const t = useT();
  const { data: insightsData, isLoading } = useAIInsights();
  const generateAnalysis = useGenerateDailyAnalysis();
  const generateWeekly = useGenerateWeeklyAnalysis();
  const deleteInsight = useDeleteAIInsight();

  const [selectedInsight, setSelectedInsight] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pattern" | "warning" | "victory">("all");

  const insights = (insightsData as any)?.insights || [];
  const selected = insights.find((i: any) => i.id === selectedInsight);

  const handleGenerateAnalysis = async () => {
    try {
      await generateAnalysis.mutateAsync({});
    } catch (error) {
      console.error("Failed to generate analysis:", error);
    }
  };

  const handleGenerateWeekly = async () => {
    try {
      await generateWeekly.mutateAsync({});
    } catch (error) {
      console.error("Failed to generate weekly review:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-[var(--accent-fire)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--text-secondary)] font-medium animate-pulse">
          {t.insights_loading}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-[var(--text-primary)]">AI Insights 🧠</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          {t.insights_subtitle}
        </p>
      </div>

      {/* Request Analysis */}
      <div className="flex gap-3">
        <button
          onClick={handleGenerateAnalysis}
          disabled={generateAnalysis.isPending}
          className="btn-fire flex items-center gap-2 flex-1 disabled:opacity-50"
        >
          {generateAnalysis.isPending ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {t.insights_analyzing}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" /> {t.insights_generate_daily}
            </>
          )}
        </button>
        <button 
          onClick={handleGenerateWeekly}
          disabled={generateWeekly.isPending}
          className="btn-ghost flex items-center gap-2 disabled:opacity-50"
        >
          {generateWeekly.isPending ? (
            <div className="w-5 h-5 border-2 border-[var(--accent-fire)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <Brain className="w-5 h-5" />
          )}
          {t.insights_weekly}
        </button>
      </div>

      {/* Empty state */}
      {insights.length === 0 && !selectedInsight && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-6 animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center mb-2">
            <Brain className="w-10 h-10 text-[var(--accent-fire)] opacity-60" />
          </div>
          <div className="max-w-md space-y-2">
            <h2 className="text-2xl font-black text-[var(--text-primary)]">{t.insights_empty_title}</h2>
            <p className="text-[var(--text-secondary)]">
              {t.insights_empty_desc}
            </p>
          </div>
          <div className="flex gap-3">
            <a href="/checkin" className="btn-fire px-6">{t.insights_do_checkin}</a>
            <a href="/journal" className="btn-ghost px-6">{t.insights_write_journal}</a>
          </div>
        </div>
      )}

      {/* Filters (only show if there are insights) */}
      {insights.length > 0 && !selectedInsight && (
        <div className="flex gap-2">
          {[
            { value: "all" as const, label: t.insights_filter_all },
            { value: "pattern" as const, label: t.insights_filter_patterns },
            { value: "warning" as const, label: t.insights_filter_warnings },
            { value: "victory" as const, label: t.insights_filter_victories },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === f.value
                  ? "bg-[var(--accent-fire)] text-white"
                  : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Insights List */}
      {insights.length > 0 && !selectedInsight && (
        <div className="space-y-3">
          {insights.map((insight: any, i: number) => (
            <div
              key={insight.id}
              onClick={() => setSelectedInsight(insight.id)}
              className="card w-full text-left group animate-slide-up cursor-pointer hover:border-[var(--accent-fire)] transition-all"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${(insight.severity_score || 0) >= 7 ? "bg-[var(--accent-danger-subtle)]" :
                    (insight.severity_score || 0) >= 4 ? "bg-[var(--accent-fire-subtle)]" :
                      "bg-[var(--accent-success-subtle)]"
                  }`}>
                  {(insight.severity_score || 0) >= 7 ? <AlertTriangle className="w-5 h-5 text-[var(--accent-danger)]" /> :
                    (insight.severity_score || 0) >= 4 ? <Search className="w-5 h-5 text-[var(--accent-fire)]" /> :
                      <Trophy className="w-5 h-5 text-[var(--accent-success)]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge text-[10px] ${(insight.analysis_type || insight.type) === "daily_review" ? "badge-fire" : "badge-success"
                      }`}>
                      {(insight.analysis_type || insight.type) === "daily_review" ? t.insights_badge_daily : (insight.analysis_type || insight.type) === "weekly_review" ? t.insights_badge_weekly : (insight.analysis_type || insight.type)}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      <Clock className="w-3 h-3 inline mr-0.5" />
                      {new Date(insight.created_at).toLocaleDateString("uk-UA", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <h3 className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-fire)] transition-colors mb-1">
                    {insight.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{insight.summary}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(t.insights_delete_confirm)) {
                        deleteInsight.mutate(insight.id);
                      }
                    }}
                    className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-500 transition-all"
                    title="Delete Insight"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-fire)]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail View */}
      {selected && (
        <div className="space-y-4 animate-slide-up">
          <button onClick={() => setSelectedInsight(null)} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1">
            ← {t.insights_back}
          </button>

          <div className="card-fire">
            <h2 className="text-xl font-black text-[var(--text-primary)] mb-2">{selected.title}</h2>
            <p className="text-[var(--text-secondary)] font-medium italic">{selected.summary}</p>
          </div>

          {/* Full Analysis - The Deep Dive */}
          {(selected as any).full_analysis && (
            <div className="card space-y-4">
              <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wide">{t.insights_deep_dive}</h3>
              <div className="text-sm text-[var(--text-secondary)] leading-relaxed space-y-4 whitespace-pre-wrap">
                {renderWithLinks((selected as any).full_analysis)}
              </div>
            </div>
          )}

          {/* Insights */}
          {selected.insights && selected.insights.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wide">{t.insights_key_insights}</h3>
              {selected.insights.map((ins: any, i: number) => (
                <div key={i} className={`card border-l-4 ${ins.type === "victory" ? "border-l-[var(--accent-success)]" :
                    ins.type === "warning" ? "border-l-[var(--accent-danger)]" :
                      ins.type === "pattern" ? "border-l-[var(--accent-fire)]" :
                        "border-l-[var(--accent-info)]"
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold uppercase ${ins.type === "victory" ? "text-[var(--accent-success)]" :
                        ins.type === "warning" ? "text-[var(--accent-danger)]" :
                          "text-[var(--accent-fire)]"
                      }`}>{ins.type}</span>
                    <span className="font-bold text-[var(--text-primary)] text-sm">{ins.title}</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{renderWithLinks(ins.description)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Trigger Patterns */}
          {selected.trigger_patterns && selected.trigger_patterns.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wide mb-3">{t.insights_trigger_patterns}</h3>
              {selected.trigger_patterns.map((tp: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-[var(--border-default)] last:border-0">
                  <AlertTriangle className="w-4 h-4 text-[var(--accent-warning)]" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{tp.trigger}</div>
                    <div className="text-xs text-[var(--text-muted)]">{tp.frequency} • {tp.correlation}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {selected.recommendations && selected.recommendations.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wide">{t.insights_recommendations}</h3>
              {selected.recommendations.map((rec: any, i: number) => (
                <div key={i} className="card bg-[var(--accent-fire-subtle)] border-[rgba(255,77,0,0.2)]">
                  <div className="font-bold text-sm text-[var(--accent-fire)] mb-1">{rec.title}</div>
                  <p className="text-sm text-[var(--text-secondary)]">{renderWithLinks(rec.description)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tomorrow Action */}
          {selected.tomorrow_action && (
            <div className="card bg-[var(--accent-success-subtle)] border-[rgba(0,230,118,0.2)]">
              <div className="text-xs text-[var(--accent-success)] uppercase font-bold mb-1">{t.insights_tomorrow}</div>
              <p className="text-sm text-[var(--text-primary)] font-semibold">{selected.tomorrow_action}</p>
            </div>
          )}

          {/* Motivational Close */}
          {selected.motivational_close && (
            <div className="card-fire p-6 text-center">
              <p className="text-lg font-bold text-[var(--text-primary)] italic">&ldquo;{selected.motivational_close}&rdquo;</p>
            </div>
          )}

          {/* Feedback */}
          <div className="flex items-center justify-center gap-4">
            <span className="text-xs text-[var(--text-muted)]">{t.insights_helpful}</span>
            <button className="btn-ghost text-xs flex items-center gap-1 py-1.5 px-3"><ThumbsUp className="w-3.5 h-3.5" /> {t.insights_yes}</button>
            <button className="btn-ghost text-xs flex items-center gap-1 py-1.5 px-3"><ThumbsDown className="w-3.5 h-3.5" /> {t.insights_no}</button>
          </div>
        </div>
      )}
    </div>
  );
}
