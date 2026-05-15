"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import {
  useUnreadCount,
  useNotificationHistory,
  useMarkNotificationRead,
  useMarkAllRead,
} from "@/lib/hooks";
import { useT } from "@/lib/i18n";

type Notification = {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  url: string;
  is_read: boolean;
  created_at: string;
};

function timeAgo(dateStr: string, t: ReturnType<typeof useT>): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t.notifications_just_now;
  if (mins < 60) return t.notifications_min_ago.replace("{n}", String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t.notifications_hour_ago.replace("{n}", String(hours));
  const days = Math.floor(hours / 24);
  return t.notifications_day_ago.replace("{n}", String(days));
}

function typeIcon(type: string): string {
  switch (type) {
    case "danger_zone":
      return "🔥";
    case "test":
      return "🧪";
    case "morning_checkin":
      return "☀️";
    case "evening_review":
      return "🌙";
    case "motivation":
      return "💪";
    case "streak_celebration":
      return "🏆";
    default:
      return "🔔";
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const t = useT();

  const { data: unreadData } = useUnreadCount();
  const { data: historyData, isLoading } = useNotificationHistory(30);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();

  const unread = unreadData?.unread || 0;
  const notifications: Notification[] =
    (historyData as any)?.notifications || [];

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const handleNotificationClick = (n: Notification) => {
    if (!n.is_read) {
      markRead.mutate(n.id);
    }
    setIsOpen(false);
    window.location.href = n.url || "/dashboard";
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
        aria-label={t.notifications_aria_label}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[var(--accent-danger)] text-white text-[10px] font-bold rounded-full px-1 animate-pulse">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 md:right-auto md:left-0 md:top-auto md:bottom-full md:mb-2 w-80 md:w-96 max-h-[70vh] bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl shadow-2xl z-50 overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {t.notifications_title}
            </h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-[10px] font-semibold text-[var(--accent-fire)] hover:text-[var(--accent-ember)] transition-colors flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  {t.notifications_read_all}
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto max-h-[calc(70vh-52px)]">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-[var(--text-muted)]">
                {t.notifications_loading}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
                <p className="text-sm text-[var(--text-muted)]">
                  {t.notifications_empty}
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-colors flex gap-3 ${
                    !n.is_read ? "bg-[rgba(255,77,0,0.04)]" : ""
                  }`}
                >
                  {/* Type icon */}
                  <div className="text-lg shrink-0 mt-0.5">
                    {typeIcon(n.notification_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold truncate ${
                          !n.is_read
                            ? "text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {n.title}
                      </span>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[var(--accent-fire)] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                    <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
                      {timeAgo(n.created_at, t)}
                    </span>
                  </div>

                  {/* Read indicator */}
                  {!n.is_read && (
                    <div
                      className="shrink-0 mt-1 p-1 rounded hover:bg-[var(--accent-fire-subtle)] transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        markRead.mutate(n.id);
                      }}
                      title={t.notifications_mark_read}
                    >
                      <Check className="w-3 h-3 text-[var(--text-muted)]" />
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
