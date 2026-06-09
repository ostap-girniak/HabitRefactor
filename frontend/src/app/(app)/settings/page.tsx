"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Trash2,
  LogOut,
  Moon,
  Globe,
  Download,
  Flame,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useUIStore, useUserStore } from "@/lib/store";
import { useUpdateProfile } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import {
  getCurrentPushSubscription,
  isPushSupported,
  sendTestPush,
  runDangerCheck,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import { notificationsApi } from "@/lib/api";
import type { UserProfile } from "@/lib/store";

type DangerCheckResponse = {
  sent?: number;
  oracle?: {
    forecast?: {
      risk_score?: number;
      danger_zone?: boolean;
    };
  };
};

type JournalAlertResponse = {
  is_danger?: boolean;
  found_keywords?: string[];
};

type ApiError = {
  response?: {
    data?: {
      detail?: string;
    };
  };
};

export default function SettingsPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const addToast = useUIStore((s) => s.addToast);
  const language = useUIStore((s) => s.language);
  const setLanguage = useUIStore((s) => s.setLanguage);
  const t = useT();
  const updateProfile = useUpdateProfile();
  const [displayName, setDisplayName] = useState(user?.display_name || "");

  const handleSaveProfile = async () => {
    if (!displayName.trim()) return;
    try {
      const { data } = await updateProfile.mutateAsync({ display_name: displayName.trim() });
      setUser(data as UserProfile);
      addToast("success", language === "uk" ? "Профіль збережено." : "Profile saved.");
    } catch {
      addToast("error", language === "uk" ? "Не вдалося зберегти." : "Failed to save profile.");
    }
  };
  const [pushSupported] = useState(() => isPushSupported());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isTogglingPush, setIsTogglingPush] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNotificationDiagnostics, setShowNotificationDiagnostics] = useState(false);

  useEffect(() => {
    if (!pushSupported) return;
    getCurrentPushSubscription()
      .then((sub) => setNotificationsEnabled(!!sub))
      .catch(() => setNotificationsEnabled(false));
  }, [pushSupported]);

  const handleTogglePush = async () => {
    if (!pushSupported) {
      addToast("info", "Push notifications are not supported in this browser.");
      return;
    }

    setIsTogglingPush(true);
    try {
      if (!notificationsEnabled) {
        await subscribeToPush();
        setNotificationsEnabled(true);
        addToast("success", "Push notifications enabled.");
      } else {
        await unsubscribeFromPush();
        setNotificationsEnabled(false);
        addToast("info", "Push notifications disabled.");
      }
    } catch (err) {
      console.error("Push toggle failed:", err);
      const msg =
        err instanceof Error ? err.message : "Failed to update push notifications.";
      addToast("error", msg);
    } finally {
      setIsTogglingPush(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleExportData = async () => {
    try {
      const supabase = createClient();
      const { data: habits } = await supabase.from("habits").select("*");
      const { data: checkins } = await supabase.from("checkins").select("*");
      const { data: journals } = await supabase.from("journal_entries").select("*");
      const { data: identity } = await supabase.from("identity_statements").select("*");
      const { data: insights } = await supabase.from("ai_analyses").select("*");

      const exportData = {
        profile: user,
        habits,
        checkins,
        journals,
        identity,
        insights,
        exported_at: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `habitrefactor-data-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Stay hard and try again.");
    }
  };

  const handleDeleteAccount = async () => {
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_user_data"); // We use a stored procedure for cascading delete
    if (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete data. Contact support or try again.");
    } else {
      await supabase.auth.signOut();
      router.push("/register");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-[var(--text-primary)]">{t.settings_title}</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">{t.settings_subtitle}</p>
      </div>

      {/* Profile */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-[var(--accent-fire)]" />
          <h2 className="font-bold text-[var(--text-primary)]">{t.settings_profile}</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase mb-1">{t.settings_display_name}</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-forge"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase mb-1">{t.settings_email}</label>
            <input type="email" defaultValue={user?.email || ""} className="input-forge opacity-60" disabled />
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={updateProfile.isPending || !displayName.trim()}
            className="btn-fire text-sm disabled:opacity-50"
          >
            {updateProfile.isPending ? "..." : t.settings_save_changes}
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-[var(--accent-ember)]" />
          <h2 className="font-bold text-[var(--text-primary)]">{t.settings_notifications}</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">{t.settings_push}</div>
              <div className="text-xs text-[var(--text-muted)]">
                {t.settings_push_desc}
                {!pushSupported ? ` ${t.settings_push_unsupported}` : ""}
              </div>
            </div>
            <button
              onClick={handleTogglePush}
              disabled={!pushSupported || isTogglingPush}
              className={`w-12 h-6 rounded-full transition-all relative ${
                notificationsEnabled ? "bg-[var(--accent-success)]" : "bg-[var(--bg-elevated)]"
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${
                notificationsEnabled ? "left-6" : "left-0.5"
              }`} />
            </button>
          </div>

          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/50 p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)]">
                  {t.settings_notification_plan_title}
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {t.settings_notification_plan_desc}
                </p>
              </div>
              <span
                className={`badge text-[10px] ${
                  notificationsEnabled ? "badge-success" : ""
                }`}
              >
                {notificationsEnabled
                  ? t.settings_notifications_status_on
                  : t.settings_notifications_status_off}
              </span>
            </div>

            <div className="grid gap-2">
              {[
                {
                  icon: <Bell className="w-4 h-4 text-[var(--accent-info)]" />,
                  title: t.settings_notification_plan_journal_title,
                  desc: t.settings_notification_plan_journal_desc,
                },
                {
                  icon: <Flame className="w-4 h-4 text-[var(--accent-danger)]" />,
                  title: t.settings_notification_plan_danger_title,
                  desc: t.settings_notification_plan_danger_desc,
                },
                {
                  icon: <SettingsIcon className="w-4 h-4 text-[var(--accent-ember)]" />,
                  title: t.settings_notification_plan_schedule_title,
                  desc: t.settings_notification_plan_schedule_desc,
                },
                {
                  icon: <Shield className="w-4 h-4 text-[var(--accent-success)]" />,
                  title: t.settings_notification_plan_streak_title,
                  desc: t.settings_notification_plan_streak_desc,
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 rounded-lg bg-[var(--bg-primary)] px-3 py-2"
                >
                  <div className="mt-0.5">{item.icon}</div>
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {item.title}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      {item.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/reminders" className="btn-fire text-sm">
                {t.settings_notification_plan_configure}
              </Link>
              <Link href="/journal/notifications" className="btn-ghost text-sm">
                {t.settings_notification_plan_history}
              </Link>
            </div>
          </div>

          {pushSupported && notificationsEnabled && (
            <div className="border-t border-[var(--border-default)] pt-3">
              <button
                onClick={() => setShowNotificationDiagnostics((value) => !value)}
                className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {showNotificationDiagnostics
                  ? t.settings_notifications_hide_diagnostics
                  : t.settings_notifications_show_diagnostics}
              </button>

              {showNotificationDiagnostics && (
                <div className="mt-3 rounded-xl bg-[var(--bg-elevated)]/50 p-3">
                  <p className="text-xs text-[var(--text-muted)] mb-3">
                    {t.settings_notifications_diagnostics_desc}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={async () => {
                        try {
                          await sendTestPush();
                          addToast("success", "Test push sent.");
                        } catch (err) {
                          console.error("Test push failed:", err);
                          addToast("error", "Failed to send test push.");
                        }
                      }}
                      className="btn-ghost text-sm"
                    >
                      {t.settings_test_push}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const data = (await runDangerCheck()) as DangerCheckResponse;
                          const risk = data?.oracle?.forecast?.risk_score;
                          const danger = data?.oracle?.forecast?.danger_zone;
                          addToast("info", `Danger check: risk ${risk ?? "?"}/100${danger ? " (DANGER)" : ""}`);
                        } catch (err) {
                          console.error("Danger check failed:", err);
                          addToast("error", "Failed to run danger check.");
                        }
                      }}
                      className="btn-ghost text-sm"
                    >
                      {t.settings_danger_check}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const data = (await runDangerCheck({ forceSend: true })) as DangerCheckResponse;
                          addToast("success", `Force push sent (${data?.sent ?? 0}).`);
                        } catch (err) {
                          console.error("Force push failed:", err);
                          addToast("error", "Failed to force danger push.");
                        }
                      }}
                      className="btn-ghost text-sm"
                    >
                      {t.settings_force_push}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const { data } = await notificationsApi.journalAlert();
                          const payload = data as JournalAlertResponse;
                          if (payload.is_danger) {
                            addToast("success", `Danger push sent! Keywords: ${(payload.found_keywords || []).join(", ")}`);
                          } else {
                            addToast("success", "Motivation push sent! No danger detected.");
                          }
                        } catch (err: unknown) {
                          console.error("Journal alert failed:", err);
                          const apiErr = err as ApiError;
                          const msg = apiErr.response?.data?.detail || "Failed to trigger journal alert.";
                          addToast("error", msg);
                        }
                      }}
                      className="btn-ghost text-sm text-[var(--accent-info)] border-[var(--accent-info)]"
                    >
                      {t.settings_journal_alert}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Appearance */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Moon className="w-5 h-5 text-[var(--accent-info)]" />
          <h2 className="font-bold text-[var(--text-primary)]">{t.settings_appearance}</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{t.settings_dark_mode}</div>
            <div className="text-xs text-[var(--text-muted)]">{t.settings_dark_mode_desc}</div>
          </div>
          <div className="bg-[var(--accent-fire-subtle)] text-[var(--accent-fire)] text-xs font-bold px-3 py-1 rounded-lg">
            {t.settings_always_on}
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-[var(--accent-success)]" />
          <h2 className="font-bold text-[var(--text-primary)]">{t.settings_language}</h2>
        </div>
        <div className="flex gap-2">
          {[
            { value: "uk", label: "🇺🇦 Українська" },
            { value: "en", label: "🇬🇧 English" },
          ].map((lang) => (
            <button
              key={lang.value}
              onClick={() => setLanguage(lang.value as "en" | "uk")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                language === lang.value
                  ? "bg-[var(--accent-fire)] text-white"
                  : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Data */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-[#7C4DFF]" />
          <h2 className="font-bold text-[var(--text-primary)]">{t.settings_data}</h2>
        </div>
        <div className="space-y-2">
          <button onClick={handleExportData} className="btn-ghost w-full text-left flex items-center gap-3 py-3">
            <Download className="w-4 h-4" />
            <div>
              <div className="text-sm font-semibold">{t.settings_export}</div>
              <div className="text-xs text-[var(--text-muted)]">{t.settings_export_desc}</div>
            </div>
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card border-[var(--accent-danger)] border-opacity-30">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="w-5 h-5 text-[var(--accent-danger)]" />
          <h2 className="font-bold text-[var(--accent-danger)]">{t.settings_danger_zone}</h2>
        </div>

        {!showDeleteConfirm ? (
          <div className="space-y-2">
            <button onClick={handleLogout} className="btn-ghost w-full text-left flex items-center gap-3 py-3">
              <LogOut className="w-4 h-4" />
              <div>
                <div className="text-sm font-semibold">{t.settings_sign_out}</div>
                <div className="text-xs text-[var(--text-muted)]">{t.settings_sign_out_desc}</div>
              </div>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-ghost w-full text-left flex items-center gap-3 py-3 text-[var(--accent-danger)]"
            >
              <Trash2 className="w-4 h-4" />
              <div>
                <div className="text-sm font-semibold">{t.settings_delete_account}</div>
                <div className="text-xs opacity-70">{t.settings_delete_desc}</div>
              </div>
            </button>
          </div>
        ) : (
          <div className="bg-[var(--accent-danger-subtle)] rounded-xl p-4 space-y-3">
            <p className="text-sm text-[var(--text-primary)]">{t.settings_delete_confirm}</p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                className="bg-[var(--accent-danger)] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-600 transition-colors"
              >
                {t.settings_delete_yes}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-ghost text-sm">
                {t.cancel}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* App info */}
      <div className="p-4 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)] flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Flame className="w-4 h-4 text-[var(--accent-fire)]" />
          HabitRefactor v0.1.0
        </div>
        <div className="text-xs text-[var(--text-muted)]">{t.settings_footer}</div>
      </div>
    </div>
  );
}
