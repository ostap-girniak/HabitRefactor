"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Square,
  Send,
  Clock,
  Trash2,
  FileText,
  ChevronRight,
  Filter,
  SortDesc,
  SortAsc,
} from "lucide-react";
import { useJournalEntries, useCreateJournalEntry, useUploadJournalMedia, useHabits } from "@/lib/hooks";
import { journalApi } from "@/lib/api";

type RecordingMode = "audio" | "video" | "text";

export default function JournalPage() {
  const [filterHabitId, setFilterHabitId] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data: entriesData, isLoading } = useJournalEntries({ 
    habit_id: filterHabitId === "all" ? undefined : filterHabitId,
    sort: sortOrder 
  });
  const { data: habits = [] } = useHabits();
  const createEntry = useCreateJournalEntry();
  const uploadMedia = useUploadJournalMedia();

  const entries = (entriesData as any)?.entries || [];

  const [mode, setMode] = useState<RecordingMode | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [textEntry, setTextEntry] = useState("");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [selectedHabitId, setSelectedHabitId] = useState<string>("none");

  // Sync selected habit with filter if filter is active
  useEffect(() => {
    if (filterHabitId !== "all") {
      setSelectedHabitId(filterHabitId);
    }
  }, [filterHabitId]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopAllMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopAllMedia();
  }, [stopAllMedia]);

  const startRecording = async (type: "audio" | "video") => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === "video" ? { facingMode: "user", width: 640, height: 480 } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (type === "video" && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }

      let mimeType = "video/webm";
      if (type === "video") {
        mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      } else {
        mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: type === "video" ? "video/webm" : "audio/webm" });
        setRecordedBlob(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // 1s chunks

      setMode(type);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording:", err);
      alert("Could not access microphone/camera. Please allow permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    stopAllMedia();
    setIsRecording(false);
  };

  const discardRecording = () => {
    setRecordedBlob(null);
    setRecordingTime(0);
    setMode(null);
    stopAllMedia();
  };

  const submitEntry = async () => {
    try {
      if (mode === "text") {
        await createEntry.mutateAsync({
          entry_type: "text",
          raw_text: textEntry,
          habit_id: selectedHabitId === "none" ? undefined : selectedHabitId,
        });
      } else if (recordedBlob && mode) {
        // Create file object
        const fileName = `journal_${mode}_${new Date().getTime()}.webm`;
        const file = new File([recordedBlob], fileName, { type: recordedBlob.type });

        // Upload media first
        const uploadRes = await uploadMedia.mutateAsync(file);

        // Then create entry referencing media
        await createEntry.mutateAsync({
          entry_type: mode,
          media_url: (uploadRes as any)?.data?.media_url || (uploadRes as any)?.media_url || "",
          media_duration_seconds: recordingTime,
          media_size_bytes: file.size,
          habit_id: selectedHabitId === "none" ? undefined : selectedHabitId,
        });
      }
      discardRecording();
      setTextEntry("");
      setMode(null);
    } catch (error: any) {
      console.error("Failed to save journal:", error);
      alert(`Error saving journal entry: ${error.response?.data?.detail || error.message}`);
    }
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-[var(--accent-fire)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--text-secondary)] font-medium animate-pulse">
          Loading your journal...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-[var(--text-primary)]">Journal 🎙️</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Record your raw emotions. Video, voice, or text. The AI analyzes everything.
        </p>
      </div>

      {/* Habit Selection (Target) */}
      {!isRecording && !recordedBlob && (
        <div className="card bg-white/5 border-white/10 p-4 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-fire-subtle)] flex items-center justify-center">
              <Filter className="w-4 h-4 text-[var(--accent-fire)]" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)] block mb-1">
                Target Habit (Optional)
              </label>
              <select
                value={selectedHabitId}
                onChange={(e) => setSelectedHabitId(e.target.value)}
                className="w-full bg-transparent border-none text-sm font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer"
              >
                <option value="none" className="bg-[#121212]">General Entry (No Habit)</option>
                {(habits as any[]).map((h: any) => (
                  <option key={h.id} value={h.id} className="bg-[#121212]">
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Recording Controls */}
      {!mode && !recordedBlob && (
        <div className="grid grid-cols-3 gap-4 animate-slide-up">
          <button
            onClick={() => startRecording("audio")}
            className="card-fire text-center py-8 cursor-pointer group hover:border-[var(--accent-fire)]"
          >
            <Mic className="w-10 h-10 text-[var(--accent-fire)] mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-[var(--text-primary)]">Voice</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Speak freely</div>
          </button>

          <button
            onClick={() => startRecording("video")}
            className="card text-center py-8 cursor-pointer group hover:border-[var(--accent-info)]"
          >
            <Video className="w-10 h-10 text-[var(--accent-info)] mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-[var(--text-primary)]">Video</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Face the camera</div>
          </button>

          <button
            onClick={() => setMode("text")}
            className="card text-center py-8 cursor-pointer group hover:border-[var(--accent-ember)]"
          >
            <FileText className="w-10 h-10 text-[var(--accent-ember)] mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-[var(--text-primary)]">Text</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Write it down</div>
          </button>
        </div>
      )}

      {/* Recording Active */}
      {isRecording && (
        <div className="card-fire p-8 text-center animate-slide-up">
          {mode === "video" && (
            <video
              ref={videoPreviewRef}
              className="w-full max-w-md mx-auto rounded-xl mb-4 bg-black"
              autoPlay
              muted
              playsInline
            />
          )}

          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-[var(--accent-danger)] animate-pulse" />
            <span className="text-sm font-semibold text-[var(--accent-danger)] uppercase tracking-wider">
              Recording
            </span>
          </div>

          <div className="text-5xl font-black counter-display text-[var(--text-primary)] mb-6">
            {formatTime(recordingTime)}
          </div>

          <button
            onClick={stopRecording}
            className="w-16 h-16 rounded-full bg-[var(--accent-danger)] flex items-center justify-center mx-auto hover:scale-110 transition-transform"
          >
            <Square className="w-6 h-6 text-white" fill="white" />
          </button>

          <p className="text-xs text-[var(--text-muted)] mt-4">
            Speak your truth. The AI will transcribe and analyze your emotions.
          </p>
        </div>
      )}

      {/* Recorded — Review */}
      {recordedBlob && !isRecording && (
        <div className="card-fire p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {mode === "video" ? <Video className="w-5 h-5 text-[var(--accent-info)]" /> : <Mic className="w-5 h-5 text-[var(--accent-fire)]" />}
              <span className="font-bold text-[var(--text-primary)]">Recording Complete</span>
            </div>
            <span className="text-sm text-[var(--text-muted)]">
              <Clock className="w-4 h-4 inline mr-1" />
              {formatTime(recordingTime)}
            </span>
          </div>

          <div className="flex gap-3">
            <button onClick={submitEntry} className="btn-fire flex-1 flex items-center justify-center gap-2">
              <Send className="w-5 h-5" /> Submit & Analyze
            </button>
            <button onClick={discardRecording} className="btn-ghost text-[var(--accent-danger)]">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Text Entry */}
      {mode === "text" && (
        <div className="space-y-4 animate-slide-up">
          <textarea
            value={textEntry}
            onChange={(e) => setTextEntry(e.target.value)}
            className="input-forge min-h-[200px] resize-none text-base"
            placeholder="Write freely. What are you feeling right now? What happened today? What thoughts are racing through your head? Be raw. Be honest. The AI will analyze everything..."
            autoFocus
          />
          <div className="flex gap-3">
            <button
              onClick={submitEntry}
              disabled={!textEntry.trim()}
              className="btn-fire flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-5 h-5" /> Submit Entry
            </button>
            <button onClick={() => { setMode(null); setTextEntry(""); }} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md animate-slide-up">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Filter size={18} />
            <span className="text-sm font-medium">Habit:</span>
          </div>
          <select
            value={filterHabitId}
            onChange={(e) => setFilterHabitId(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[var(--accent-fire)] transition-colors min-w-[160px] cursor-pointer"
          >
            <option value="all">All Habits</option>
            {(habits as any[]).map((h: any) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            {sortOrder === "desc" ? <SortDesc size={18} /> : <SortAsc size={18} />}
            <span className="text-sm font-medium">Order:</span>
          </div>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
            className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[var(--accent-fire)] transition-colors cursor-pointer"
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Previous Entries */}
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Previous Entries</h2>
        <div className="space-y-3">
          {entries.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)] border-2 border-dashed border-[var(--border-default)] rounded-xl">
              No journal entries yet. Speak your mind.
            </div>
          ) : (
            (entries as any[]).map((entry: any, i: number) => (
              <div
                key={entry.id}
                className="relative group animate-slide-up"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <Link
                  href={`/journal/${entry.id}`}
                  className="card group-hover:border-[var(--accent-fire)]/30 block pr-20"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${entry.entry_type === "audio" ? "bg-[var(--accent-fire-subtle)]" :
                        entry.entry_type === "video" ? "bg-[rgba(68,138,255,0.12)]" :
                          "bg-[rgba(255,140,0,0.12)]"
                      }`}>
                      {entry.entry_type === "audio" ? <Mic className="w-5 h-5 text-[var(--accent-fire)]" /> :
                        entry.entry_type === "video" ? <Video className="w-5 h-5 text-[var(--accent-info)]" /> :
                          <FileText className="w-5 h-5 text-[var(--accent-ember)]" />}
                    </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-[var(--text-muted)]">
                            {new Date(entry.created_at).toLocaleDateString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {(entry.media_duration_seconds || 0) > 0 && (
                            <span className="text-xs text-[var(--text-muted)]">
                              • {formatTime(entry.media_duration_seconds)}
                            </span>
                          )}
                          <span className="badge badge-success text-[10px]">
                            {entry.transcription_status}
                          </span>
                        </div>

                        {entry.title && (
                          <h3 className="text-base font-bold text-[var(--text-primary)] mb-1 line-clamp-1">
                            {entry.title}
                          </h3>
                        )}

                        <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-2">
                          {entry.transcript || entry.raw_text}
                        </p>

                      {/* Detected emotions */}
                      <div className="flex flex-wrap gap-2">
                        {entry.detected_emotions && Object.entries(entry.detected_emotions).map(([emotion, score]) => (
                          <span key={emotion} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] capitalize">
                            {emotion}: {Math.round((score as number) * 100)}%
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-fire)] transition-colors absolute right-4 top-1/2 -translate-y-1/2" />
                </Link>

                <button
                  onClick={async (e) => {
                    console.log("Delete button clicked for entry:", entry.id);
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm("Delete this entry?")) {
                       try {
                          console.log("Attempting API delete call...");
                          await journalApi.delete(entry.id);
                          console.log("Delete successful, refreshing...");
                          window.location.reload();
                       } catch (err) {
                          console.error("Delete call failed:", err);
                          alert("Failed to delete entry. Check console.");
                       }
                    }
                  }}
                  className="absolute right-12 top-1/2 -translate-y-1/2 p-3 rounded-xl text-[var(--accent-danger)] bg-white/5 hover:bg-[var(--accent-danger-subtle)] transition-all z-50 opacity-60 group-hover:opacity-100"
                  title="Quick Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
