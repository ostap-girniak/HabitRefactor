"use client";

import { useEffect, useState } from "react";
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
import {
  getCurrentPushSubscription,
  isPushSupported,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

export default function SettingsPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);
  const [pushSupported, setPushSupported] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isTogglingPush, setIsTogglingPush] = useState(false);
  const [darkMode] = useState(true);
  const [language, setLanguage] = useState("uk");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const supported = isPushSupported();
    setPushSupported(supported);
    if (!supported) return;
    getCurrentPushSubscription()
      .then((sub) => setNotificationsEnabled(!!sub))
      .catch(() => setNotificationsEnabled(false));
  }, []);

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
        <h1 className="text-2xl font-black text-[var(--text-primary)]">Settings ⚙️</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Configure your forge. Your data, your rules.
        </p>
      </div>

      {/* Profile */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-[var(--accent-fire)]" />
          <h2 className="font-bold text-[var(--text-primary)]">Profile</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase mb-1">Display Name</label>
            <input
              type="text"
              defaultValue={user?.display_name || "Warrior"}
              className="input-forge"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase mb-1">Email</label>
            <input
              type="email"
              defaultValue={user?.email || ""}
              className="input-forge opacity-60"
              disabled
            />
          </div>
          <button className="btn-fire text-sm">Save Changes</button>
        </div>
      </div>

      {/* Notifications */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-[var(--accent-ember)]" />
          <h2 className="font-bold text-[var(--text-primary)]">Notifications</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">Push Notifications</div>
              <div className="text-xs text-[var(--text-muted)]">
                Daily reminders and danger-zone interventions
                {!pushSupported ? " (unsupported on this browser)" : ""}
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
          {pushSupported && notificationsEnabled && (
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
              Send test push
            </button>
          )}
        </div>
      </div>

      {/* Appearance */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Moon className="w-5 h-5 text-[var(--accent-info)]" />
          <h2 className="font-bold text-[var(--text-primary)]">Appearance</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">Dark Mode</div>
            <div className="text-xs text-[var(--text-muted)]">The forge only burns in the dark</div>
          </div>
          <div className="bg-[var(--accent-fire-subtle)] text-[var(--accent-fire)] text-xs font-bold px-3 py-1 rounded-lg">
            Always On
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-[var(--accent-success)]" />
          <h2 className="font-bold text-[var(--text-primary)]">Language</h2>
        </div>
        <div className="flex gap-2">
          {[
            { value: "uk", label: "🇺🇦 Українська" },
            { value: "en", label: "🇬🇧 English" },
          ].map((lang) => (
            <button
              key={lang.value}
              onClick={() => setLanguage(lang.value)}
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
          <h2 className="font-bold text-[var(--text-primary)]">Data & Privacy</h2>
        </div>
        <div className="space-y-2">
          <button onClick={handleExportData} className="btn-ghost w-full text-left flex items-center gap-3 py-3">
            <Download className="w-4 h-4" />
            <div>
              <div className="text-sm font-semibold">Export My Data</div>
              <div className="text-xs text-[var(--text-muted)]">Download all your data as JSON</div>
            </div>
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card border-[var(--accent-danger)] border-opacity-30">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="w-5 h-5 text-[var(--accent-danger)]" />
          <h2 className="font-bold text-[var(--accent-danger)]">Danger Zone</h2>
        </div>

        {!showDeleteConfirm ? (
          <div className="space-y-2">
            <button
              onClick={handleLogout}
              className="btn-ghost w-full text-left flex items-center gap-3 py-3"
            >
              <LogOut className="w-4 h-4" />
              <div>
                <div className="text-sm font-semibold">Sign Out</div>
                <div className="text-xs text-[var(--text-muted)]">You can always come back</div>
              </div>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-ghost w-full text-left flex items-center gap-3 py-3 text-[var(--accent-danger)]"
            >
              <Trash2 className="w-4 h-4" />
              <div>
                <div className="text-sm font-semibold">Delete Account</div>
                <div className="text-xs opacity-70">Permanently delete all your data</div>
              </div>
            </button>
          </div>
        ) : (
          <div className="bg-[var(--accent-danger-subtle)] rounded-xl p-4 space-y-3">
            <p className="text-sm text-[var(--text-primary)]">
              Are you sure? This will permanently delete ALL your data — habits, check-ins, journal entries, and AI insights. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={handleDeleteAccount}
                className="bg-[var(--accent-danger)] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-600 transition-colors"
              >
                Yes, Delete Everything
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-ghost text-sm"
              >
                Cancel
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
        <div className="text-xs text-[var(--text-muted)]">Built with fire. No excuses.</div>
      </div>
    </div>
  );
}
