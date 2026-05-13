"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Send, 
  Bot, 
  User, 
  ShieldAlert,
  Flame,
  MessageCircle,
} from "lucide-react";
import { useOracleChat, useOracleHistory } from "@/lib/hooks";

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  metadata?: {
    suggested_actions?: { title: string; action: string }[];
    mood_detected?: string;
    threat_level?: number;
  };
  isOptimistic?: boolean;
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

export default function OraclePage() {
  const [input, setInput] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const { data: serverHistory, isLoading: loadingHistory } = useOracleHistory();
  const chatMutation = useOracleChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Merge server history with optimistic messages
  const history: ChatMessage[] = [
    ...(serverHistory || []),
    ...optimisticMessages,
  ];

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history.length, chatMutation.isPending]);

  // Clear optimistic messages when server history updates
  useEffect(() => {
    if (serverHistory && optimisticMessages.length > 0) {
      setOptimisticMessages([]);
    }
  }, [serverHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    const message = input.trim();
    setInput("");
    
    // Add optimistic user message immediately
    setOptimisticMessages([{ role: "user", content: message, isOptimistic: true }]);

    try {
      await chatMutation.mutateAsync({ message });
      // Server history will be refetched via query invalidation,
      // and the useEffect above will clear optimistic messages
    } catch (err) {
      console.error("Oracle is silent:", err);
      setOptimisticMessages([]);
    }
  };

  const handleSuggestedAction = (action: string) => {
    setInput(action);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-40px)] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-[var(--accent-fire)]" />
            Ask the Oracle
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            The Oracle knows your journey. Ask about your patterns, triggers, or the science of recovery.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-full">
          <ShieldAlert className="w-4 h-4 text-[var(--accent-fire)]" />
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">RAG-Powered</span>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 overflow-hidden flex flex-col bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-default)] shadow-2xl relative">
        
        {/* Messages area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5"
        >
          {loadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-4 border-[var(--accent-fire)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 && !chatMutation.isPending ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 max-w-sm mx-auto opacity-70">
              <div className="w-20 h-20 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center animate-pulse">
                <Bot className="w-10 h-10 text-[var(--accent-fire)]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">The Oracle Awaits</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  &ldquo;Truth is not found in comfort. Ask your question, and let the data reveal your path.&rdquo;
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full">
                {[
                  "Проаналізуй мій стан за останній тиждень.",
                  "Чому я зриваюся, коли втомлююсь?",
                  "Які наукові методи допоможуть мені?",
                  "Скільки грошей я зекономлю за рік?"
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
          ) : (
            <>
              {history.map((msg, i) => (
                <div 
                  key={msg.id || `msg-${i}`}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
                >
                  <div className={`max-w-[85%] md:max-w-[75%] space-y-1`}>
                    {/* Label */}
                    <div className={`flex items-center gap-1.5 px-1 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.role === 'user' ? (
                        <>
                          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">You</span>
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
                      msg.role === 'user' 
                        ? 'bg-[var(--accent-fire)] text-white shadow-lg' 
                        : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-default)]'
                    } ${msg.isOptimistic ? 'opacity-70' : ''}`}>
                      <div className="whitespace-pre-wrap">{renderWithLinks(msg.content)}</div>
                    </div>

                    {/* Suggested actions */}
                    {msg.role === 'assistant' && msg.metadata?.suggested_actions && msg.metadata.suggested_actions.length > 0 && (
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
                      <span className="text-[10px] font-bold text-[var(--accent-fire)] uppercase tracking-wider">Oracle is thinking...</span>
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
              placeholder="Ask the Oracle about your battle..."
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
            AI coach powered by your data + recovery science. Not medical advice. Stay Hard. 🔥
          </p>
        </div>
      </div>
    </div>
  );
}
