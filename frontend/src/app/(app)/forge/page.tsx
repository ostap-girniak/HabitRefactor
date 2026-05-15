"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Scroll,
  BookOpen,
  Mic,
  Swords,
  ChevronRight,
  Zap,
  Crown,
  Copy,
  Check,
  Play,
  Square,
  Trash2,
  Siren,
  ShieldAlert,
} from "lucide-react";
import {
  useHeroChapters,
  useGenerateHeroChapter,
  useGenerateCatalystLetter,
  useHabits,
} from "@/lib/hooks";
import { useT } from "@/lib/i18n";

interface HeroChapter {
  id: string;
  chapter_number: number;
  title: string;
  narrative: string;
}

interface HabitOption {
  id: string;
  name: string;
}

interface VoiceManifestoEntry {
  id: string;
  title: string;
  promise: string;
  triggerPrompt: string;
  habitId: string | null;
  habitName: string | null;
  createdAt: string;
  durationSeconds: number;
  mimeType: string;
  legacyAudioDataUrl?: string;
}

const TOOL_TIMEOUT_MS = 25000;
const VOICE_MANIFESTO_STORAGE_KEY = "forge_voice_manifestos";
const VOICE_MANIFESTO_DB_NAME = "habitrefactor-voice-manifestos";
const VOICE_MANIFESTO_STORE_NAME = "recordings";

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function sanitizeManifestoMetadata(entries: VoiceManifestoEntry[]) {
  return entries.map(({ legacyAudioDataUrl: _legacyAudioDataUrl, ...entry }) => entry);
}

function openVoiceManifestoDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(VOICE_MANIFESTO_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VOICE_MANIFESTO_STORE_NAME)) {
        db.createObjectStore(VOICE_MANIFESTO_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveManifestoAudioBlob(id: string, blob: Blob) {
  const db = await openVoiceManifestoDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(VOICE_MANIFESTO_STORE_NAME, "readwrite");
    tx.objectStore(VOICE_MANIFESTO_STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}

async function loadManifestoAudioBlob(id: string) {
  const db = await openVoiceManifestoDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(VOICE_MANIFESTO_STORE_NAME, "readonly");
    const request = tx.objectStore(VOICE_MANIFESTO_STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return blob;
}

async function deleteManifestoAudioBlob(id: string) {
  const db = await openVoiceManifestoDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(VOICE_MANIFESTO_STORE_NAME, "readwrite");
    tx.objectStore(VOICE_MANIFESTO_STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}

export default function ForgePage() {
  const t = useT();

  const TOOLS = [
    {
      id: "letter",
      icon: Scroll,
      title: t.forge_tool_letter_title,
      description: t.forge_tool_letter_desc,
      color: "var(--accent-fire)",
    },
    {
      id: "manifesto",
      icon: Mic,
      title: t.forge_tool_manifesto_title,
      description: t.forge_tool_manifesto_desc,
      color: "var(--accent-ember)",
    },
    {
      id: "hero",
      icon: Swords,
      title: t.forge_tool_hero_title,
      description: t.forge_tool_hero_desc,
      color: "#7C4DFF",
    },
  ];

  const LETTER_TONES = [
    { value: "tough_love", label: t.forge_tone_tough, desc: t.forge_tone_tough_desc },
    { value: "compassionate", label: t.forge_tone_compassionate, desc: t.forge_tone_compassionate_desc },
    { value: "stoic", label: t.forge_tone_stoic, desc: t.forge_tone_stoic_desc },
    { value: "warrior", label: t.forge_tone_warrior, desc: t.forge_tone_warrior_desc },
  ];

  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [letterTone, setLetterTone] = useState("tough_love");
  const [selectedHabitId, setSelectedHabitId] = useState<string>("");
  const [generatedLetter, setGeneratedLetter] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [voiceTitle, setVoiceTitle] = useState("My line in the sand");
  const [voicePromise, setVoicePromise] = useState("");
  const [triggerPrompt, setTriggerPrompt] = useState(
    "Play this when I start negotiating with the old version of me."
  );
  const [savedManifestos, setSavedManifestos] = useState<VoiceManifestoEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingRecording, setIsProcessingRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [activeManifestoId, setActiveManifestoId] = useState<string | null>(null);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [manifestoView, setManifestoView] = useState<"record" | "history">("record");
  const [manifestoAudioUrls, setManifestoAudioUrls] = useState<Record<string, string>>({});

  const { data: habitsData } = useHabits();
  const { data: chapters } = useHeroChapters();
  const generateChapter = useGenerateHeroChapter();
  const generateLetter = useGenerateCatalystLetter();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const playbackUrlRef = useRef<string | null>(null);

  const habits = useMemo<HabitOption[]>(
    () => (Array.isArray(habitsData) ? (habitsData as HabitOption[]) : []),
    [habitsData]
  );

  const chapterList = useMemo<HeroChapter[]>(() => {
    if (Array.isArray(chapters)) return chapters as HeroChapter[];
    if (
      chapters &&
      typeof chapters === "object" &&
      Array.isArray((chapters as { chapters?: unknown[] }).chapters)
    ) {
      return (chapters as { chapters: HeroChapter[] }).chapters;
    }
    return [];
  }, [chapters]);

  const currentHabitId = selectedHabitId || habits[0]?.id || "";
  const activeManifesto = useMemo(
    () => savedManifestos.find((entry) => entry.id === activeManifestoId) || savedManifestos[0] || null,
    [activeManifestoId, savedManifestos]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(VOICE_MANIFESTO_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as VoiceManifestoEntry[];
      if (Array.isArray(parsed)) {
        setSavedManifestos(
          parsed.map((entry) => ({
            ...entry,
            mimeType: entry.mimeType || "audio/webm",
          }))
        );
        setActiveManifestoId(parsed[0]?.id || null);
      }
    } catch (error) {
      console.error("Failed to load voice manifestos:", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        VOICE_MANIFESTO_STORAGE_KEY,
        JSON.stringify(sanitizeManifestoMetadata(savedManifestos))
      );
    } catch (error) {
      console.error("Failed to persist voice manifesto metadata:", error);
      setActionError("The recording metadata could not be saved locally.");
    }
  }, [savedManifestos]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (playbackRef.current) {
        playbackRef.current.pause();
      }
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
      }
      Object.values(manifestoAudioUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [manifestoAudioUrls]);

  useEffect(() => {
    let cancelled = false;

    const hydrateAudioUrls = async () => {
      const idsToLoad = savedManifestos
        .map((entry) => entry.id)
        .filter((id) => !manifestoAudioUrls[id]);

      if (idsToLoad.length === 0) return;

      for (const id of idsToLoad) {
        try {
          const blob = await loadManifestoAudioBlob(id);
          if (!blob || cancelled) continue;
          const objectUrl = URL.createObjectURL(blob);
          setManifestoAudioUrls((prev) => {
            if (prev[id]) {
              URL.revokeObjectURL(objectUrl);
              return prev;
            }
            return { ...prev, [id]: objectUrl };
          });
        } catch (error) {
          console.error("Failed to hydrate manifesto audio URL:", error);
        }
      }
    };

    void hydrateAudioUrls();

    return () => {
      cancelled = true;
    };
  }, [savedManifestos, manifestoAudioUrls]);

  const handleGenerateLetter = async () => {
    setActionError(null);
    setActionInfo(null);
    try {
      const { data } = await Promise.race([
        generateLetter.mutateAsync({
          tone: letterTone,
          ...(currentHabitId ? { habit_id: currentHabitId } : {}),
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), TOOL_TIMEOUT_MS);
        }),
      ]);
      setGeneratedLetter(data.letter);
      if (data?.provider === "openai_compat") {
        setActionInfo("Gemini was unavailable, so the letter was generated via the fallback provider.");
      }
      if (data?.status === "fallback") {
        setActionInfo("AI was overloaded, so you are seeing the fallback version of the letter.");
      }
      const previous = JSON.parse(localStorage.getItem("forge_letters") || "[]") as string[];
      localStorage.setItem("forge_letters", JSON.stringify([data.letter, ...previous].slice(0, 5)));
    } catch (error) {
      const message =
        error instanceof Error && error.message === "REQUEST_TIMEOUT"
          ? "Refactor Letter took too long. Try again or switch the tone."
          : "Could not generate the letter. Check the API connection and try again.";
      setActionError(message);
      console.error("Failed to generate letter:", error);
    }
  };

  const handleGenerateChapter = async () => {
    setActionError(null);
    setActionInfo(null);
    try {
      const { data } = await Promise.race([
        generateChapter.mutateAsync(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), TOOL_TIMEOUT_MS);
        }),
      ]);
      if (typeof data?.message === "string" && data.message.toLowerCase().includes("fallback")) {
        setActionInfo("Hero Mode was generated in fallback mode because the AI provider was busy.");
      } else if (data?.provider === "openai_compat") {
        setActionInfo("Gemini was unavailable, so Hero Mode was generated via the fallback provider.");
      } else {
        setActionInfo("A new Hero Mode chapter was forged successfully.");
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message === "REQUEST_TIMEOUT"
          ? "Hero Mode took too long to respond. Try again in a moment."
          : "Could not generate the chapter. Try again in a few seconds.";
      setActionError(message);
      console.error("Failed to generate hero chapter:", error);
    }
  };

  const stopRecordingSession = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }
  };

  const handleStartVoiceManifesto = async () => {
    setActionError(null);
    setActionInfo(null);

    if (!voicePromise.trim()) {
      setActionError("Write the promise first. Then record it in your own voice.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      recordingChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      recordingStreamRef.current = stream;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          setIsRecording(false);
          setIsProcessingRecording(true);
          stopRecordingSession();

          const blob = new Blob(recordingChunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });

          const durationSeconds = recordingStartedAtRef.current
            ? Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000))
            : recordingSeconds;

          const habitName = habits.find((habit) => habit.id === currentHabitId)?.name || null;
          const entryId = crypto.randomUUID();
          const entry: VoiceManifestoEntry = {
            id: entryId,
            title: voiceTitle.trim() || "My line in the sand",
            promise: voicePromise.trim(),
            triggerPrompt: triggerPrompt.trim(),
            habitId: currentHabitId || null,
            habitName,
            createdAt: new Date().toISOString(),
            durationSeconds,
            mimeType: blob.type || "audio/webm",
          };

          await saveManifestoAudioBlob(entryId, blob);
          const objectUrl = URL.createObjectURL(blob);
          setManifestoAudioUrls((prev) => ({ ...prev, [entryId]: objectUrl }));
          setSavedManifestos((prev) => {
            const next = [entry, ...prev].slice(0, 10);
            const droppedEntries = prev.filter((oldEntry) => !next.some((nextEntry) => nextEntry.id === oldEntry.id));
            droppedEntries.forEach((droppedEntry) => {
              void deleteManifestoAudioBlob(droppedEntry.id).catch((error) => {
                console.error("Failed to trim old manifesto audio:", error);
              });
              setManifestoAudioUrls((current) => {
                const urlToDelete = current[droppedEntry.id];
                if (urlToDelete) {
                  URL.revokeObjectURL(urlToDelete);
                }
                const { [droppedEntry.id]: _removed, ...rest } = current;
                return rest;
              });
            });
            return next;
          });
          setActiveManifestoId(entry.id);
          setRecordingSeconds(0);
          setActionInfo("Voice manifesto saved. Now you can replay your own promise any time.");
        } catch (error) {
          setActionError("The recording was captured, but it could not be saved locally.");
          console.error("Failed to save voice manifesto:", error);
        } finally {
          setIsProcessingRecording(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingSeconds(0);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
      setActionInfo("Recording. Speak like you mean it. No bargaining with the old self.");
    } catch (error) {
      stopRecordingSession();
      setIsRecording(false);
      setIsProcessingRecording(false);
      setActionError("Could not access the microphone. Check browser permissions and try again.");
      console.error("Failed to start voice manifesto recording:", error);
    }
  };

  const handleStopVoiceManifesto = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      return;
    }
    mediaRecorderRef.current.stop();
  };

  const handlePlayManifesto = async (entry: VoiceManifestoEntry, activateEmergency = false) => {
    setActionError(null);
    setActiveManifestoId(entry.id);
    if (activateEmergency) {
      setEmergencyMode(true);
    }

    try {
      if (playbackRef.current) {
        playbackRef.current.pause();
      }
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
        playbackUrlRef.current = null;
      }

      let audioUrl: string | null = null;
      const storedBlob = await loadManifestoAudioBlob(entry.id);
      if (storedBlob) {
        audioUrl = URL.createObjectURL(storedBlob);
        playbackUrlRef.current = audioUrl;
      } else if (entry.legacyAudioDataUrl) {
        audioUrl = entry.legacyAudioDataUrl;
      }

      if (!audioUrl) {
        setActionError("This recording is missing from local storage. Record a new version.");
        return;
      }

      const audio = new Audio(audioUrl);
      playbackRef.current = audio;
      audio.onended = () => {
        if (playbackUrlRef.current) {
          URL.revokeObjectURL(playbackUrlRef.current);
          playbackUrlRef.current = null;
        }
      };
      await audio.play();
      setActionInfo(
        activateEmergency
          ? "Emergency mode active. Do not make any decisions until your recording finishes."
          : "Playing your voice manifesto."
      );
    } catch (error) {
      setActionError("Could not play the recording. Try again.");
      console.error("Failed to play voice manifesto:", error);
    }
  };

  const handleDeleteManifesto = (id: string) => {
    void deleteManifestoAudioBlob(id).catch((error) => {
      console.error("Failed to delete manifesto audio:", error);
    });
    setManifestoAudioUrls((prev) => {
      const urlToDelete = prev[id];
      if (urlToDelete) {
        URL.revokeObjectURL(urlToDelete);
      }
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
    setSavedManifestos((prev) => {
      const next = prev.filter((entry) => entry.id !== id);
      if (activeManifestoId === id) {
        setActiveManifestoId(next[0]?.id || null);
      }
      return next;
    });
    setActionInfo("Recording deleted.");
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setActionError("Could not copy automatically.");
    }
  };

  const handleCopyEmergencyScript = async () => {
    if (!activeManifesto) {
      setActionError("Create a recording first.");
      return;
    }

    const lines = [
      activeManifesto.title,
      `Promise: ${activeManifesto.promise}`,
      `Play this when: ${activeManifesto.triggerPrompt}`,
      "Emergency protocol:",
      "1. Press play.",
      "2. No decisions until the recording ends.",
      "3. Drink water and leave the trigger zone for 10 minutes.",
      "4. Read the promise out loud once more.",
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      setActionInfo("Emergency ritual copied.");
    } catch {
      setActionError("Could not copy the ritual.");
    }
  };

  const emergencySteps = useMemo(() => {
    if (!activeManifesto) return [];
    return [
      "Press play and listen to your full recording.",
      `Say out loud why this is dangerous: ${activeManifesto.triggerPrompt}`,
      "Leave the trigger zone right now.",
      "Give yourself 10 clean minutes before making any move.",
    ];
  }, [activeManifesto]);

  const generatingLetter = generateLetter.isPending;
  const generatingChapter = generateChapter.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-[var(--text-primary)]">HabitRefactor</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1 italic">
          {t.forge_subtitle}
        </p>
      </div>

      {actionError && (
        <div className="card border border-[var(--accent-danger)]/40 bg-[var(--accent-danger-subtle)]">
          <p className="text-sm text-[var(--text-primary)]">{actionError}</p>
        </div>
      )}

      {actionInfo && (
        <div className="card border border-[var(--accent-success)]/40 bg-[var(--accent-success-subtle)]">
          <p className="text-sm text-[var(--text-primary)]">{actionInfo}</p>
        </div>
      )}

      <div className="card space-y-2">
        <label className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
          {t.forge_focus_habit}
        </label>
        <select
          value={currentHabitId}
          onChange={(e) => setSelectedHabitId(e.target.value)}
          className="input-forge"
        >
          {habits.length === 0 && <option value="">{t.forge_no_habits}</option>}
          {habits.map((habit) => (
            <option key={habit.id} value={habit.id}>
              {habit.name}
            </option>
          ))}
        </select>
      </div>

      {!selectedTool && (
        <div className="space-y-4">
          {TOOLS.map((tool, index) => (
            <button
              key={tool.id}
              onClick={() => {
                setSelectedTool(tool.id);
                if (tool.id === "manifesto") {
                  setManifestoView("record");
                }
              }}
              className="card w-full text-left group cursor-pointer animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{ background: `${tool.color}15` }}
                >
                  <tool.icon className="w-7 h-7" style={{ color: tool.color }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-[var(--text-primary)] group-hover:text-[var(--accent-fire)] transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)]">{tool.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-fire)]" />
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedTool === "letter" && (
        <div className="space-y-4 animate-slide-up">
          <button
            onClick={() => {
              setSelectedTool(null);
              setGeneratedLetter(null);
            }}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            {t.forge_back_to_tools}
          </button>

          <div className="card-fire p-6">
            <div className="flex items-center gap-3 mb-4">
              <Scroll className="w-8 h-8 text-[var(--accent-fire)]" />
              <div>
                <h2 className="text-xl font-black text-[var(--text-primary)]">{t.forge_letter_title}</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t.forge_letter_subtitle}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
                {t.forge_letter_voice_label}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {LETTER_TONES.map((tone) => (
                  <button
                    key={tone.value}
                    onClick={() => setLetterTone(tone.value)}
                    className={`card text-left cursor-pointer ${
                      letterTone === tone.value
                        ? "border-[var(--accent-fire)] bg-[var(--accent-fire-subtle)]"
                        : ""
                    }`}
                  >
                    <div className="font-bold text-sm text-[var(--text-primary)]">{tone.label}</div>
                    <div className="text-xs text-[var(--text-muted)]">{tone.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {!generatedLetter ? (
              <button
                onClick={handleGenerateLetter}
                disabled={generatingLetter}
                className="btn-fire w-full py-4 text-base flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generatingLetter ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t.forge_letter_generating}
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    {t.forge_letter_generate}
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="bg-[var(--bg-elevated)] rounded-xl p-6 border border-[var(--border-default)]">
                  <p className="text-[var(--text-primary)] whitespace-pre-line leading-relaxed font-serif text-base">
                    {generatedLetter}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleCopy(generatedLetter)}
                    className="btn-fire flex-1 flex items-center justify-center gap-2"
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    {copied ? t.forge_copied : t.forge_copy_letter}
                  </button>
                  <button onClick={handleGenerateLetter} className="btn-ghost">
                    {t.forge_regenerate}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedTool === "hero" && (
        <div className="space-y-4 animate-slide-up">
          <button
            onClick={() => setSelectedTool(null)}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            {t.forge_back_to_tools}
          </button>

          <div className="card-fire p-6 text-center">
            <Crown className="w-12 h-12 text-[#7C4DFF] mx-auto mb-3" />
            <h2 className="text-xl font-black text-[var(--text-primary)] mb-2">{t.forge_hero_title}</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              {t.forge_hero_desc}
            </p>
            <button
              onClick={handleGenerateChapter}
              disabled={generatingChapter}
              className="btn-fire flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
            >
              {generatingChapter ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t.forge_hero_generating}
                </>
              ) : (
                <>
                  <BookOpen className="w-5 h-5" />
                  {t.forge_hero_generate}
                </>
              )}
            </button>
          </div>

          {chapterList.map((chapter) => (
            <div key={chapter.id} className="card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[rgba(124,77,255,0.12)] flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-[#7C4DFF]" />
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)]">{t.forge_hero_chapter} {chapter.chapter_number}</div>
                  <h3 className="font-bold text-[var(--text-primary)]">{chapter.title}</h3>
                </div>
              </div>
              <p className="text-sm text-[var(--text-secondary)] italic">&ldquo;{chapter.narrative}&rdquo;</p>
            </div>
          ))}

          {chapterList.length === 0 && (
            <div className="card bg-[var(--bg-secondary)] border-dashed border-2">
              <p className="text-sm text-[var(--text-muted)] text-center">
                {t.forge_hero_empty}
              </p>
            </div>
          )}
        </div>
      )}

      {selectedTool === "manifesto" && (
        <div className="space-y-4 animate-slide-up">
          <button
            onClick={() => {
              setSelectedTool(null);
              setEmergencyMode(false);
            }}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            {t.forge_back_to_tools}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setManifestoView("record")}
              className={`btn-ghost ${manifestoView === "record" ? "border-[var(--accent-fire)] text-[var(--accent-fire)]" : ""}`}
            >
              {t.forge_manifesto_record_tab}
            </button>
            <button
              onClick={() => setManifestoView("history")}
              className={`btn-ghost ${manifestoView === "history" ? "border-[var(--accent-fire)] text-[var(--accent-fire)]" : ""}`}
            >
              {t.forge_manifesto_history_tab}
            </button>
          </div>

          <div className="space-y-4">
            {manifestoView === "record" && (
            <>
            <div className="card-fire p-6 space-y-5">
              <div className="text-center">
                <Mic className="w-12 h-12 text-[var(--accent-ember)] mx-auto mb-3" />
                <h2 className="text-xl font-black text-[var(--text-primary)] mb-2">{t.forge_manifesto_section_title}</h2>
                <p className="text-[var(--text-secondary)]">
                  {t.forge_manifesto_subtitle}
                </p>
              </div>

              <div className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                    {t.forge_manifesto_title_label}
                  </label>
                  <input
                    value={voiceTitle}
                    onChange={(e) => setVoiceTitle(e.target.value)}
                    className="input-forge"
                    placeholder={t.forge_manifesto_title_placeholder}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                    {t.forge_manifesto_promise_label}
                  </label>
                  <textarea
                    value={voicePromise}
                    onChange={(e) => setVoicePromise(e.target.value)}
                    rows={4}
                    className="input-forge min-h-[120px]"
                    placeholder={t.forge_manifesto_promise_placeholder}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                    {t.forge_manifesto_trigger_label}
                  </label>
                  <input
                    value={triggerPrompt}
                    onChange={(e) => setTriggerPrompt(e.target.value)}
                    className="input-forge"
                    placeholder={t.forge_manifesto_trigger_placeholder}
                  />
                </div>

                <div className="card bg-[var(--bg-elevated)] border border-[var(--border-default)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
                        {t.forge_manifesto_state}
                      </div>
                      <div className="text-lg font-black text-[var(--text-primary)]">
                        {isRecording
                          ? t.forge_manifesto_recording.replace("{time}", formatDuration(recordingSeconds))
                          : isProcessingRecording
                            ? t.forge_manifesto_saving
                            : t.forge_manifesto_ready}
                      </div>
                    </div>
                    <div
                      className={`w-3 h-3 rounded-full ${
                        isRecording ? "bg-[var(--accent-danger)] animate-pulse" : "bg-[var(--text-muted)]/40"
                      }`}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {!isRecording ? (
                    <button
                      onClick={handleStartVoiceManifesto}
                      disabled={isProcessingRecording}
                      className="btn-fire flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Mic className="w-5 h-5" />
                      {savedManifestos.length === 0 ? t.forge_manifesto_record_btn : t.forge_manifesto_record_new}
                    </button>
                  ) : (
                    <button
                      onClick={handleStopVoiceManifesto}
                      className="btn-fire bg-[var(--accent-danger)] border-[var(--accent-danger)] flex items-center justify-center gap-2"
                    >
                      <Square className="w-5 h-5" />
                      {t.forge_manifesto_stop}
                    </button>
                  )}

                  <button
                    onClick={() => activeManifesto && handlePlayManifesto(activeManifesto, true)}
                    disabled={!activeManifesto}
                    className="btn-ghost flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Siren className="w-5 h-5" />
                    {t.forge_emergency_play}
                  </button>
                </div>
              </div>
            </div>

              <div
                className={`card ${
                  emergencyMode ? "border-[var(--accent-danger)] bg-[var(--accent-danger-subtle)]" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
                      {t.forge_emergency_title}
                    </div>
                    <h3 className="text-lg font-black text-[var(--text-primary)] mt-1">
                      {activeManifesto ? activeManifesto.title : t.forge_emergency_create_first}
                    </h3>
                    {activeManifesto && (
                      <p className="text-sm text-[var(--text-secondary)] mt-2">
                        {activeManifesto.triggerPrompt}
                      </p>
                    )}
                  </div>
                  <ShieldAlert
                    className={`w-6 h-6 ${
                      emergencyMode ? "text-[var(--accent-danger)]" : "text-[var(--accent-ember)]"
                    }`}
                  />
                </div>

                {activeManifesto ? (
                  <div className="space-y-4 mt-4">
                    <div className="card bg-[var(--bg-elevated)]">
                      <div className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                        {t.forge_emergency_your_words}
                      </div>
                      <p className="text-sm font-semibold text-[var(--text-primary)] whitespace-pre-line">
                        {activeManifesto.promise}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {emergencySteps.map((step, index) => (
                        <div key={step} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                          <div className="w-6 h-6 rounded-full bg-[var(--accent-fire-subtle)] text-[var(--accent-fire)] flex items-center justify-center text-xs font-black">
                            {index + 1}
                          </div>
                          <p className="pt-1">{step}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handlePlayManifesto(activeManifesto)}
                        className="btn-fire flex-1 flex items-center justify-center gap-2"
                      >
                        <Play className="w-5 h-5" />
                        {t.forge_play_recording}
                      </button>
                      <button
                        onClick={handleCopyEmergencyScript}
                        className="btn-ghost flex-1 flex items-center justify-center gap-2"
                      >
                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                        {copied ? t.forge_copied : t.forge_copy_ritual}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-muted)] mt-4">
                    {t.forge_emergency_no_ritual}
                  </p>
                )}
              </div>
            </>
            )}

            {manifestoView === "history" && (
              <div className="card space-y-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
                    {t.forge_history_saved}
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">{t.forge_history_last10}</div>
                </div>

                {savedManifestos.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">
                    {t.forge_history_empty}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {savedManifestos.map((entry) => (
                      <div
                        key={entry.id}
                        className={`card py-4 px-4 ${
                          activeManifesto?.id === entry.id
                            ? "border-[var(--accent-fire)] bg-[var(--accent-fire-subtle)]"
                            : ""
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <button onClick={() => setActiveManifestoId(entry.id)} className="text-left flex-1">
                              <div className="font-bold text-[var(--text-primary)]">{entry.title}</div>
                              <div className="text-xs text-[var(--text-muted)] mt-1">
                                {entry.habitName ? `${entry.habitName} • ` : ""}
                                {formatDuration(entry.durationSeconds)} •{" "}
                                {new Date(entry.createdAt).toLocaleDateString()}{" "}
                                {new Date(entry.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </button>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handlePlayManifesto(entry)} className="btn-ghost px-3 py-2">
                                <Play className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteManifesto(entry.id)} className="btn-ghost px-3 py-2">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="grid gap-3">
                            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-default)] p-3">
                              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                                {t.forge_history_promise}
                              </div>
                              <p className="text-sm text-[var(--text-primary)] whitespace-pre-line">{entry.promise}</p>
                            </div>

                            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-default)] p-3">
                              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                                {t.forge_history_trigger_prompt}
                              </div>
                              <p className="text-sm text-[var(--text-secondary)]">{entry.triggerPrompt}</p>
                            </div>

                            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-default)] p-3">
                              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                                {t.forge_history_audio}
                              </div>
                              {manifestoAudioUrls[entry.id] ? (
                                <audio
                                  controls
                                  preload="metadata"
                                  src={manifestoAudioUrls[entry.id]}
                                  className="w-full"
                                />
                              ) : (
                                <p className="text-sm text-[var(--text-muted)]">
                                  {t.forge_history_loading_audio}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
