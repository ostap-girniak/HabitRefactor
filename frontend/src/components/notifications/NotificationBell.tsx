"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, X } from "lucide-react";
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotificationHistory,
  useUnreadCount,
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

type NotificationsResponse = {
  notifications?: Notification[];
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
    case "journal_analysis_warning":
      return "!";
    case "journal_analysis":
    case "motivation":
      return "+";
    case "streak_celebration":
      return "*";
    case "test":
      return "T";
    default:
      return "•";
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const t = useT();

  const { data: unreadData } = useUnreadCount();
  const { data: historyData, isLoading } = useNotificationHistory(12);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();

  const unread = unreadData?.unread || 0;
  const notifications =
    (historyData as NotificationsResponse | undefined)?.notifications || [];
  const previewNotifications = notifications.slice(0, 4);

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

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }
    setIsOpen(false);
    router.push(notification.url || "/journal/notifications");
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen((open) => !open)}
        className="relative p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
        aria-label={t.notifications_aria_label}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[var(--accent-danger)] text-white text-[10px] font-bold rounded-full px-1">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 md:right-auto md:left-0 md:top-auto md:bottom-full md:mb-2 w-80 md:w-96 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl shadow-2xl z-50 overflow-hidden animate-slide-up">
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

          <div className="max-h-[360px] overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-[var(--text-muted)]">
                {t.notifications_loading}
              </div>
            ) : previewNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
                <p className="text-sm text-[var(--text-muted)]">
                  {t.notifications_empty}
                </p>
              </div>
            ) : (
              previewNotifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--bg-elevated)] transition-colors flex gap-3 ${
                    !notification.is_read ? "bg-[rgba(255,77,0,0.04)]" : ""
                  }`}
                >
                  <div className="w-6 h-6 rounded-lg bg-[var(--bg-elevated)] text-[var(--accent-fire)] text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                    {typeIcon(notification.notification_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold truncate ${
                          !notification.is_read
                            ? "text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {notification.title}
                      </span>
                      {!notification.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[var(--accent-fire)] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
                      {timeAgo(notification.created_at, t)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-[var(--border-default)]">
              <Link
                href="/journal/notifications"
                onClick={() => setIsOpen(false)}
                className="btn-ghost w-full flex items-center justify-center text-sm py-2"
              >
                {t.notifications_open_history}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
