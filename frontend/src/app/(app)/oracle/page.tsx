"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Bot,
  User,
  ShieldAlert,
  MessageCircle,
  Plus,
  ChevronLeft,
  History,
  BookOpen,
  PlayCircle,
  FileText,
  UserCheck,
  ExternalLink,
} from "lucide-react";
import { useOracleChat, useOracleHistory, useOracleSessions } from "@/lib/hooks";
import { useT } from "@/lib/i18n";

interface OracleResource {
  type: "book" | "video" | "article" | "specialist";
  title: string;
  author?: string;
  url?: string | null;
  reason: string;
}

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  metadata?: {
    suggested_actions?: { title: string; action: string }[];
    mood_detected?: string;
    threat_level?: number;
    resources?: OracleResource[];
    suggest_professional_help?: boolean;
  };
  isOptimistic?: boolean;
}

interface OracleSession {
  session_id: string;
  title: string;
  created_at: string;
}

const renderWithLinks = (text: string) => {
  if (!text) return null;
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const parts: JSX.Element[] = [];
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

function formatSessionDate(isoDate: string, today: string, yesterday: string, lang: string) {
  const d = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return today;
  if (diffDays === 1) return yesterday;
  if (diffDays < 7) return d.toLocaleDateString(lang, { weekday: "long" });
  return d.toLocaleDateString(lang, { month: "short", day: "numeric" });
}

const RESOURCE_ICONS: Record<string, React.ReactElement> = {
  book: <BookOpen className="w-3.5 h-3.5" />,
  video: <PlayCircle className="w-3.5 h-3.5" />,
  article: <FileText className="w-3.5 h-3.5" />,
  specialist: <UserCheck className="w-3.5 h-3.5" />,
};

const RESOURCE_COLORS: Record<string, string> = {
  book: "text-[var(--accent-info)] border-[var(--accent-info)]",
  video: "text-red-400 border-red-400",
  article: "text-[var(--accent-success)] border-[var(--accent-success)]",
  specialist: "text-[var(--accent-ember)] border-[var(--accent-ember)]",
};

function ResourceCards({ resources }: { resources: OracleResource[] }) {
  if (!resources || resources.length === 0) return null;
  return (
    <div className="mt-2 px-1 space-y-1.5">
      {resources.map((res, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 p-2.5 rounded-xl bg-[var(--bg-secondary)] border ${RESOURCE_COLORS[res.type] || "text-[var(--text-secondary)] border-[var(--border-default)]"} border-opacity-40`}
        >
          <span className={`mt-0.5 shrink-0 opacity-80 ${RESOURCE_COLORS[res.type]}`}>
            {RESOURCE_ICONS[res.type] || <FileText className="w-3.5 h-3.5" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-[var(--text-primary)] leading-snug">{res.title}</span>
              {res.author && (
                <span className="text-[10px] text-[var(--text-muted)]">— {res.author}</span>
              )}
              {res.url && (
                <a
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="ml-auto shrink-0 text-[var(--accent-fire)] hover:opacity-80 transition-opacity"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 leading-snug">{res.reason}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OraclePage() {
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const t = useT();
  const { data: sessions = [], isLoading: loadingSessions } = useOracleSessions();
  const { data: serverHistory, isLoading: loadingHistory } = useOracleHistory(sessionId);
  const chatMutation = useOracleChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  const history: ChatMessage[] = [
    ...(serverHistory || []),
    ...optimisticMessages,
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history.length, chatMutation.isPending]);

  useEffect(() => {
    if (serverHistory && optimisticMessages.length > 0) {
      setOptimisticMessages([]);
    }
  }, [serverHistory]);

  const startNewChat = () => {
    setSessionId(null);
    setOptimisticMessages([]);
    setInput("");
    setSidebarOpen(false);
  };

  const openSession = (id: string) => {
    setSessionId(id);
    setOptimisticMessages([]);
    setInput("");
    setSidebarOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    const message = input.trim();
    const currentSessionId = sessionId ?? crypto.randomUUID();

    // Lock in the session on first message
    if (!sessionId) {
      setSessionId(currentSessionId);
    }

    setInput("");
    setOptimisticMessages([{ role: "user", content: message, isOptimistic: true }]);

    try {
      await chatMutation.mutateAsync({ message, session_id: currentSessionId });
    } catch (err) {
      console.error("Oracle is silent:", err);
      setOptimisticMessages([]);
    }
  };

  const handleSuggestedAction = (action: string) => {
    setInput(action);
  };

  const isNewChat = !sessionId;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-40px)] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] hover:border-[var(--accent-fire)] transition-all"
            title={t.oracle_history_title}
          >
            <History className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-[var(--accent-fire)]" />
              {t.oracle_title}
            </h1>
            <p className="text-[var(--text-secondary)] text-sm mt-0.5">
              {isNewChat
                ? t.oracle_new_conversation
                : sessions.find((s: OracleSession) => s.session_id === sessionId)?.title?.slice(0, 60) || t.oracle_new_conversation}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-fire)] text-white rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.oracle_new_chat}
          </button>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-full">
            <ShieldAlert className="w-4 h-4 text-[var(--accent-fire)]" />
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">RAG-Powered</span>
          </div>
        </div>
      </div>

      {/* Body: sidebar + chat */}
      <div className="flex-1 overflow-hidden flex gap-3 relative">

        {/* Sessions Sidebar */}
        {sidebarOpen && (
          <div className="w-64 shrink-0 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl flex flex-col overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between p-3 border-b border-[var(--border-default)]">
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{t.oracle_history_title}</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1 hover:text-[var(--accent-fire)] transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loadingSessions ? (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 border-2 border-[var(--accent-fire)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-6">{t.oracle_no_history}</p>
              ) : (
                sessions.map((s: OracleSession) => (
                  <button
                    key={s.session_id}
                    onClick={() => openSession(s.session_id)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all group ${
                      sessionId === s.session_id
                        ? "bg-[var(--accent-fire-subtle)] border border-[var(--accent-fire)]"
                        : "hover:bg-[var(--bg-elevated)] border border-transparent"
                    }`}
                  >
                    <p className="text-xs text-[var(--text-primary)] font-medium line-clamp-2 leading-snug">
                      {s.title}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      {formatSessionDate(s.created_at, t.oracle_today, t.oracle_yesterday, t.oracle_locale)}
                    </p>
                  </button>
                ))
              )}
            </div>
            <div className="p-2 border-t border-[var(--border-default)]">
              <button
                onClick={startNewChat}
                className="w-full flex items-center justify-center gap-2 p-2 bg-[var(--accent-fire)] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.oracle_new_chat}
              </button>
            </div>
          </div>
        )}

        {/* Chat Container */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-default)] shadow-2xl">

          {/* Messages area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5"
          >
            {isNewChat && optimisticMessages.length === 0 && !chatMutation.isPending ? (
              /* Empty / new chat state */
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6 max-w-sm mx-auto opacity-70">
                <div className="w-20 h-20 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center animate-pulse">
                  <Bot className="w-10 h-10 text-[var(--accent-fire)]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">{t.oracle_awaits}</h3>
                  <p className="text-sm text-[var(--text-secondary)]">{t.oracle_awaits_quote}</p>
                </div>
                <div className="grid grid-cols-1 gap-2 w-full">
                  {[
                    t.oracle_suggested_1,
                    t.oracle_suggested_2,
                    t.oracle_suggested_3,
                    t.oracle_suggested_4,
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => handleSuggestedAction(q)}
                      className="text-xs p-3 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] rounded-xl text-[var(--text-secondary)] text-left transition-all border border-transparent hover:border-[var(--accent-fire)]"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : loadingHistory ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-[var(--accent-fire)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {history.map((msg, i) => (
                  <div
                    key={msg.id || `msg-${i}`}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-slide-up`}
                  >
                    <div className="max-w-[85%] md:max-w-[75%] space-y-1">
                      {/* Label */}
                      <div className={`flex items-center gap-1.5 px-1 ${msg.role === "user" ? "justify-end" : ""}`}>
                        {msg.role === "user" ? (
                          <>
                            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t.oracle_you}</span>
                            <User className="w-3 h-3 text-[var(--text-muted)]" />
                          </>
                        ) : (
                          <>
                            <Bot className="w-3 h-3 text-[var(--accent-fire)]" />
                            <span className="text-[10px] font-bold text-[var(--accent-fire)] uppercase tracking-wider">Oracle</span>
                          </>
                        )}
                      </div>

                      {/* Bubble */}
                      <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[var(--accent-fire)] text-white shadow-lg"
                          : "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-default)]"
                      } ${msg.isOptimistic ? "opacity-70" : ""}`}>
                        <div className="whitespace-pre-wrap">{renderWithLinks(msg.content)}</div>
                      </div>

                      {/* Resources */}
                      {msg.role === "assistant" && msg.metadata?.resources && msg.metadata.resources.length > 0 && (
                        <ResourceCards resources={msg.metadata.resources} />
                      )}

                      {/* Suggested actions */}
                      {msg.role === "assistant" && msg.metadata?.suggested_actions && msg.metadata.suggested_actions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2 px-1">
                          {msg.metadata.suggested_actions.map((act, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSuggestedAction(act.action || act.title)}
                              className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--accent-fire-subtle)] text-[var(--accent-fire)] rounded-lg hover:bg-[var(--accent-fire)] hover:text-white transition-all"
                            >
                              {act.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {chatMutation.isPending && (
                  <div className="flex justify-start animate-slide-up">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 px-1">
                        <Bot className="w-3 h-3 text-[var(--accent-fire)]" />
                        <span className="text-[10px] font-bold text-[var(--accent-fire)] uppercase tracking-wider">{t.oracle_thinking}</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] flex gap-1.5">
                        <div className="w-2 h-2 bg-[var(--accent-fire)] rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-[var(--accent-fire)] rounded-full animate-bounce [animation-delay:0.15s]" />
                        <div className="w-2 h-2 bg-[var(--accent-fire)] rounded-full animate-bounce [animation-delay:0.3s]" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Input area */}
          <div className="p-3 md:p-4 border-t border-[var(--border-default)] bg-[var(--bg-elevated)]/50">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.oracle_input_placeholder}
                className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent-fire)] transition-all"
                disabled={chatMutation.isPending}
              />
              <button
                type="submit"
                disabled={!input.trim() || chatMutation.isPending}
                className="p-3 bg-[var(--accent-fire)] text-white rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 shadow-lg flex items-center justify-center"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
            <p className="mt-1.5 text-center text-[10px] text-[var(--text-muted)] tracking-tight">
              {t.oracle_footer}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
