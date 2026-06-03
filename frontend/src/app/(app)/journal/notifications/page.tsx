"use client";

import Link from "next/link";
import { Bell, CheckCheck, ChevronLeft, ExternalLink } from "lucide-react";
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotificationHistory,
} from "@/lib/hooks";
import { useT } from "@/lib/i18n";

type NotificationMetadata = {
  journal_entry_id?: string;
  key_themes?: string[];
  summary?: string;
  emotional_intensity?: number;
  detected_emotions?: Record<string, number>;
  is_danger?: boolean;
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  url?: string;
  is_read: boolean;
  created_at: string;
  metadata?: NotificationMetadata;
};

type NotificationsResponse = {
  notifications?: NotificationItem[];
};

function formatDate(date: string, locale: string) {
  return new Date(date).toLocaleString(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function typeLabel(type: string, isUk: boolean) {
  if (type.includes("journal")) return isUk ? "Журнал" : "Journal";
  if (type.includes("danger")) return isUk ? "Ризик" : "Risk";
  if (type.includes("streak")) return isUk ? "Серія" : "Streak";
  return isUk ? "Система" : "System";
}

export default function JournalNotificationsPage() {
  const t = useT();
  const isUk = t.oracle_locale === "uk";
  const locale = isUk ? "uk-UA" : "en-US";
  const { data, isLoading } = useNotificationHistory(100);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();

  const notifications =
    (data as NotificationsResponse | undefined)?.notifications || [];
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link
            href="/journal"
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {t.notifications_back_to_journal}
          </Link>
          <h1 className="text-2xl font-black text-[var(--text-primary)]">
            {t.notifications_history_title}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t.notifications_history_subtitle}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <CheckCheck className="w-4 h-4" />
            {t.notifications_read_all}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="card text-center text-sm text-[var(--text-muted)]">
          {t.notifications_loading}
        </div>
      ) : notifications.length === 0 ? (
        <div className="card text-center py-12">
          <Bell className="w-10 h-10 mx-auto text-[var(--text-muted)] opacity-50 mb-3" />
          <p className="text-sm text-[var(--text-muted)]">{t.notifications_empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const metadata = notification.metadata || {};
            const journalEntryId = metadata.journal_entry_id;
            const themes = metadata.key_themes || [];
            const emotions = metadata.detected_emotions || {};
            return (
              <div
                key={notification.id}
                className={`card p-4 ${
                  !notification.is_read
                    ? "border-[var(--accent-fire)]/40 bg-[var(--accent-fire-subtle)]"
                    : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4 text-[var(--accent-fire)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="badge badge-fire text-[10px]">
                        {typeLabel(notification.notification_type, isUk)}
                      </span>
                      {!notification.is_read && (
                        <span className="badge badge-success text-[10px]">
                          {isUk ? "Нове" : "New"}
                        </span>
                      )}
                      <span className="text-xs text-[var(--text-muted)]">
                        {formatDate(notification.created_at, locale)}
                      </span>
                    </div>

                    <h2 className="text-base font-bold text-[var(--text-primary)]">
                      {notification.title}
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      {notification.message}
                    </p>

                    {metadata.summary && (
                      <p className="text-sm text-[var(--text-secondary)] mt-3 border-l-2 border-[var(--accent-fire)]/60 pl-3">
                        {metadata.summary}
                      </p>
                    )}

                    {themes.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {themes.map((theme) => (
                          <span
                            key={theme}
                            className="text-xs px-2 py-1 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    )}

                    {Object.keys(emotions).length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
                        {Object.entries(emotions).map(([emotion, score]) => (
                          <div
                            key={emotion}
                            className="rounded-lg bg-[var(--bg-elevated)] px-2 py-1.5"
                          >
                            <div className="text-[10px] uppercase text-[var(--text-muted)]">
                              {emotion}
                            </div>
                            <div className="text-sm font-bold text-[var(--text-primary)]">
                              {Math.round(score * 100)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mt-4">
                      {!notification.is_read && (
                        <button
                          onClick={() => markRead.mutate(notification.id)}
                          className="btn-ghost text-xs py-2"
                        >
                          {t.notifications_mark_read}
                        </button>
                      )}
                      {journalEntryId && (
                        <Link
                          href={`/journal/${journalEntryId}`}
                          className="btn-ghost text-xs py-2 inline-flex items-center gap-2"
                        >
                          {t.notifications_open_journal_entry}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
