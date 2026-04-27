"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Calendar,
  Clock,
  Mic,
  Video,
  FileText,
  Activity,
  Tag,
  Quote,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { useJournalEntry } from "@/lib/hooks";
import { journalApi } from "@/lib/api";
import { useState, useMemo } from "react";
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer,
  Tooltip
} from "recharts";

export default function JournalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: entry, isLoading, refetch } = useJournalEntry(id);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handleRetranscribe = async () => {
    try {
      setIsTranscribing(true);
      await journalApi.transcribe(id);
      setTimeout(() => {
        refetch();
        setIsTranscribing(false);
      }, 5000); // Give it time to start
    } catch (error) {
      console.error("Transcription trigger failed:", error);
      setIsTranscribing(false);
    }
  };

  const handleDelete = async () => {
    console.log("Delete button clicked in Detail view for id:", id);
    if (!confirm("Are you sure you want to delete this entry? It cannot be undone.")) return;
    try {
      console.log("Calling journalApi.delete...");
      await journalApi.delete(id);
      console.log("Delete call successful.");
      alert("Entry deleted successfully.");
      router.push("/journal");
    } catch (error: any) {
      console.error("Delete failed in Detail view:", error);
      alert(`Delete failed: ${error.response?.data?.detail || error.message}`);
    }
  };

  const chartData = useMemo(() => {
    if (!entry?.detected_emotions) return [];
    
    // Fixed order for reliable visualization
    const emotions = [
      { key: 'joy', label: 'Joy' },
      { key: 'anger', label: 'Anger' },
      { key: 'sadness', label: 'Sadness' },
      { key: 'shame', label: 'Shame' },
      { key: 'relief', label: 'Relief' }
    ];

    return emotions.map(e => {
      const val = entry.detected_emotions[e.key] || 0;
      return {
        emotion: e.label,
        value: val > 1 ? val / 10 : val, // Normalize to 0-1
        fullMark: 1
      };
    });
  }, [entry?.detected_emotions]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-[var(--accent-fire)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Entry not found</h2>
        <Link href="/journal" className="btn-ghost mt-4 inline-block">Back to Journal</Link>
      </div>
    );
  }

  const date = new Date(entry.created_at);
  const formattedDate = date.toLocaleDateString("uk-UA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const formatTimeS = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex items-center justify-between">
        <Link href="/journal" className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--accent-fire)] transition-colors group">
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to History</span>
        </Link>
        <div className="flex gap-2">
          <button 
            onClick={handleRetranscribe}
            disabled={isTranscribing || entry.transcription_status === "processing"}
            className="btn-ghost p-2 rounded-xl text-[var(--text-secondary)] hover:bg-white/5 disabled:opacity-50"
            title="Re-run AI Analysis"
          >
            <RefreshCcw className={`w-5 h-5 ${isTranscribing ? "animate-spin" : ""}`} />
          </button>
          <button 
            onClick={handleDelete}
            className="btn-ghost p-2 rounded-xl text-[var(--accent-danger)] hover:bg-[var(--accent-danger-subtle)]"
            title="Delete Entry"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            entry.entry_type === "audio" ? "bg-[var(--accent-fire-subtle)]" :
            entry.entry_type === "video" ? "bg-[rgba(68,138,255,0.12)]" :
            "bg-[rgba(255,140,0,0.12)]"
          }`}>
            {entry.entry_type === "audio" ? <Mic className="w-6 h-6 text-[var(--accent-fire)]" /> :
             entry.entry_type === "video" ? <Video className="w-6 h-6 text-[var(--accent-info)]" /> :
             <FileText className="w-6 h-6 text-[var(--accent-ember)]" />}
          </div>
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)]">
              {entry.title || `${entry.entry_type} Entry`}
            </h1>
            <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
              <span className="flex items-center gap-1"><Calendar size={14} /> {formattedDate}</span>
              <span className="flex items-center gap-1"><Clock size={14} /> {formattedTime}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Media Section */}
          {entry.media_url && (
            <div className="rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl">
              {entry.entry_type === "video" ? (
                <video src={entry.media_url} controls className="w-full aspect-video" />
              ) : (
                <div className="p-8 flex flex-col items-center gap-4 bg-gradient-to-b from-white/5 to-transparent">
                  <div className="w-full h-24 bg-white/5 rounded-2xl flex items-center justify-center relative overflow-hidden">
                     <div className="flex gap-1 items-end h-12">
                        {[4,7,2,8,5,9,3,6,4,8,5,3,7,4,9].map((h, i) => (
                           <div key={i} className="w-1 bg-[var(--accent-fire)] rounded-full animate-pulse" style={{ height: `${h * 10}%`, animationDelay: `${i * 0.1}s` }} />
                        ))}
                     </div>
                  </div>
                  <audio src={entry.media_url} controls className="w-full" />
                </div>
              )}
            </div>
          )}

          {/* Transcript Section */}
          <div className="card-fire p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                <FileText className="text-[var(--accent-fire)]" />
                Transcript
              </h3>
              <span className={`badge ${entry.transcription_status === 'completed' ? 'badge-success' : entry.transcription_status === 'pending' ? 'badge-warning' : 'badge-danger'} uppercase text-[10px]`}>
                {entry.transcription_status}
              </span>
            </div>
            <div className="prose prose-invert max-w-none text-lg leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
              {entry.transcript || entry.raw_text || (
                <p className="text-[var(--text-muted)] italic">
                  Transcription is being processed by AI. Check back in a few moments...
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Emotion Analysis */}
          <div className="card p-6 border-white/5">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2">
              <Activity className="text-[var(--accent-info)]" />
              Emotion Insights
            </h3>
            
            {entry.detected_emotions && Object.keys(entry.detected_emotions).length > 0 ? (
              <div className="space-y-6">
                {/* Radar Chart Visual */}
                <div className="h-[250px] w-full mt-2">
                   <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                         <PolarGrid stroke="rgba(255,255,255,0.1)" />
                         <PolarAngleAxis 
                            dataKey="emotion" 
                            tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 'bold' }} 
                         />
                         <PolarRadiusAxis 
                            angle={30} 
                            domain={[0, 1]} 
                            tick={false} 
                            axisLine={false} 
                         />
                         <Radar
                            name="Emotions"
                            dataKey="value"
                            stroke="var(--accent-fire)"
                            fill="var(--accent-fire)"
                            fillOpacity={0.5}
                         />
                          <Tooltip 
                             contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                             itemStyle={{ color: 'var(--accent-fire)' }}
                             formatter={(value) => {
                                const n = typeof value === "number" ? value : Number(value);
                                const safe = Number.isFinite(n) ? n : 0;
                                return [`${Math.round(safe * 100)}%`, "Intensity"];
                             }}
                          />
                      </RadarChart>
                   </ResponsiveContainer>
                </div>

                <div className="space-y-4">
                  {chartData.map((data) => (
                    <div key={data.emotion} className="space-y-1">
                      <div className="flex justify-between text-xs uppercase tracking-wider font-bold">
                        <span className="text-[var(--text-secondary)]">{data.emotion}</span>
                        <span className="text-[var(--text-primary)]">{Math.round(data.value * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[var(--accent-info)] to-[var(--accent-fire)] transition-all duration-1000"
                          style={{ width: `${Math.min(data.value * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  
                  <div className="mt-4 pt-6 border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-[var(--text-secondary)]">Intensity Score</span>
                      <div className="flex flex-col items-end">
                        <span className="text-2xl font-black text-[var(--accent-fire)]">
                          {entry.emotional_intensity || 5}/10
                        </span>
                        <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden mt-1">
                           <div 
                              className="h-full bg-[var(--accent-fire)]" 
                              style={{ width: `${(entry.emotional_intensity || 5) * 10}%` }} 
                           />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)] italic text-center py-4">
                AI extraction pending. Click re-analyze if this persists.
              </p>
            )}
          </div>

          {/* Key Themes */}
          {entry.key_themes && entry.key_themes.length > 0 && (
            <div className="card p-6 border-white/5">
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <Tag className="text-[var(--accent-ember)]" />
                Key Themes
              </h3>
              <div className="flex flex-wrap gap-2">
                {entry.key_themes.map((theme: string) => (
                  <span key={theme} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-[var(--text-secondary)] capitalize">
                    # {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Hero Context Toggle Placeholder */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-[var(--accent-fire-subtle)] to-transparent border border-[var(--accent-fire)]/20">
            <h4 className="font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">
              <Quote size={16} className="text-[var(--accent-fire)]" />
              Warrior Tip
            </h4>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Recording your raw emotions helps the AI build a more accurate map of your triggers. Face the fire, don't hide from it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
