"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Plus, Trash2 } from "lucide-react";
import { useHabits, useReminders, useCreateReminder, useDeleteReminder, useUpdateReminder } from "@/lib/hooks";
import { useUIStore } from "@/lib/store";
import { useT } from "@/lib/i18n";

type Reminder = {
  id: string;
  habit_id: string | null;
  reminder_type: string;
  is_smart: boolean;
  is_enabled: boolean;
  title: string;
  message: string;
  time_of_day: string | null;
  days_of_week: number[] | null;
  danger_threshold?: number | null;
  cooldown_minutes?: number | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  habits?: { name?: string } | null;
};

type HabitOption = {
  id: string;
  name: string;
};

type RemindersResponse = {
  reminders?: Reminder[];
};

type ReminderTypeValue =
  | "danger_zone"
  | "morning_checkin"
  | "evening_review"
  | "motivation"
  | "streak_celebration"
  | "custom";

const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun as Supabase int? we'll store 0-6 with 0 Sunday for simplicity

const REMINDER_DEFAULTS: Record<"en" | "uk", Record<ReminderTypeValue, { title: string; message: string }>> = {
  en: {
    danger_zone: {
      title: "🔥 Danger Zone",
      message: "High relapse risk detected. Open your War Room now.",
    },
    morning_checkin: {
      title: "☀️ Morning check-in",
      message: "Set your intent before the day starts moving without you.",
    },
    evening_review: {
      title: "🌙 Evening review",
      message: "Close the day honestly. Log what happened and protect tomorrow.",
    },
    motivation: {
      title: "💪 Power dose",
      message: "One clean choice now. No negotiation with the old pattern.",
    },
    streak_celebration: {
      title: "🏆 Streak milestone",
      message: "Another day on the board. Stack the evidence.",
    },
    custom: {
      title: "⏰ Reminder",
      message: "Time to act on the person you are becoming.",
    },
  },
  uk: {
    danger_zone: {
      title: "🔥 Небезпечна зона",
      message: "Виявлено високий ризик зриву. Відкрий Штаб і зроби захисну дію.",
    },
    morning_checkin: {
      title: "☀️ Ранковий чек-ін",
      message: "Постав намір на день до того, як день почне керувати тобою.",
    },
    evening_review: {
      title: "🌙 Вечірній огляд",
      message: "Закрий день чесно. Запиши, що сталося, і захисти завтра.",
    },
    motivation: {
      title: "💪 Доза сили",
      message: "Один чистий вибір зараз. Без переговорів зі старим патерном.",
    },
    streak_celebration: {
      title: "🏆 Віха серії",
      message: "Ще один день у скарбниці. Накопичуй докази нової ідентичності.",
    },
    custom: {
      title: "⏰ Нагадування",
      message: "Час діяти як людина, якою ти стаєш.",
    },
  },
};

function getReminderDefaults(language: "en" | "uk", type: string) {
  return REMINDER_DEFAULTS[language][type as ReminderTypeValue] || REMINDER_DEFAULTS[language].custom;
}

export default function RemindersPage() {
  const t = useT();
  const addToast = useUIStore((s) => s.addToast);
  const language = useUIStore((s) => s.language);
  const { data: habitsData } = useHabits();
  const habits = (habitsData as HabitOption[]) || [];

  const { data, isLoading } = useReminders();
  const reminders = useMemo(
    () => (data as RemindersResponse | undefined)?.reminders || [],
    [data]
  );

  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(() => {
    const defaults = getReminderDefaults(language, "danger_zone");
    return {
      reminder_type: "danger_zone",
      habit_id: "",
      is_smart: true,
      is_enabled: true,
      title: defaults.title,
      message: defaults.message,
      time_of_day: "09:00",
      days_of_week: DEFAULT_DAYS,
      danger_threshold: 70,
      cooldown_minutes: 180,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
    };
  });

  const sorted = useMemo(() => {
    return [...reminders].sort((a, b) => (a.reminder_type || "").localeCompare(b.reminder_type || ""));
  }, [reminders]);

  const submit = async () => {
    try {
      const smartEnabled = form.reminder_type === "danger_zone" && form.is_smart;
      const payload: Record<string, unknown> = {
        reminder_type: form.reminder_type,
        habit_id: form.habit_id || null,
        is_smart: smartEnabled,
        title: form.title,
        message: form.message,
      };

      if (!smartEnabled) {
        payload.time_of_day = form.time_of_day;
        payload.days_of_week = form.days_of_week;
      } else {
        payload.danger_threshold = form.danger_threshold;
        payload.cooldown_minutes = form.cooldown_minutes;
        payload.quiet_hours_start = form.quiet_hours_start;
        payload.quiet_hours_end = form.quiet_hours_end;
      }

      await createReminder.mutateAsync(payload);
      addToast("success", "Reminder created.");
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      addToast("error", "Failed to create reminder.");
    }
  };

  const toggleEnabled = async (r: Reminder) => {
    try {
      await updateReminder.mutateAsync({
        id: r.id,
        data: { is_enabled: !r.is_enabled },
      });
    } catch (e) {
      console.error(e);
      addToast("error", "Failed to update reminder.");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteReminder.mutateAsync(id);
      addToast("info", "Reminder deleted.");
    } catch (e) {
      console.error(e);
      addToast("error", "Failed to delete reminder.");
    }
  };

  const smartAvailable = form.reminder_type === "danger_zone";

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
            <Bell className="w-5 h-5 text-[var(--accent-ember)]" />
            {t.reminders_title}
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            {t.reminders_subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings" className="btn-ghost text-sm">
            {t.reminders_back}
          </Link>
          <button onClick={() => setIsModalOpen(true)} className="btn-fire text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> {t.reminders_new}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-6 text-[var(--text-secondary)]">{t.reminders_loading}</div>
      ) : sorted.length === 0 ? (
        <div className="card p-6 text-[var(--text-secondary)]">
          {t.reminders_empty}
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((r) => (
            <div key={r.id} className="card flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="badge badge-fire">{r.reminder_type}</span>
                  {r.is_smart ? <span className="badge">{t.reminders_smart}</span> : <span className="badge">{t.reminders_scheduled}</span>}
                  {r.habits?.name ? (
                    <span className="text-xs text-[var(--text-muted)] truncate">{t.reminders_habit} {r.habits.name}</span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">{t.reminders_all_habits}</span>
                  )}
                </div>
                <div className="font-bold text-[var(--text-primary)] mt-1 truncate">{r.title}</div>
                <div className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">{r.message}</div>
                {r.reminder_type === "danger_zone" && r.is_smart && (
                  <div className="text-xs text-[var(--text-muted)] mt-2">
                    {t.reminders_threshold} {r.danger_threshold ?? t.reminders_default} • {t.reminders_cooldown} {r.cooldown_minutes ?? t.reminders_default} {t.reminders_min} • {t.reminders_quiet} {r.quiet_hours_start ?? "—"}–{r.quiet_hours_end ?? "—"}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() => toggleEnabled(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    r.is_enabled
                      ? "bg-[rgba(0,230,118,0.12)] border-[rgba(0,230,118,0.3)] text-[var(--accent-success)]"
                      : "bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-muted)]"
                  }`}
                >
                  {r.is_enabled ? t.reminders_enabled : t.reminders_disabled}
                </button>
                <button onClick={() => remove(r.id)} className="btn-ghost text-sm flex items-center gap-2 text-[var(--accent-danger)]">
                  <Trash2 className="w-4 h-4" /> {t.delete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="card w-full max-w-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-black text-[var(--text-primary)]">{t.reminders_modal_title}</div>
              <button onClick={() => setIsModalOpen(false)} className="btn-ghost text-sm">
                {t.reminders_close}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] uppercase mb-1">{t.reminders_type}</label>
                <select
                  className="input-forge"
                  value={form.reminder_type}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    const defaults = getReminderDefaults(language, nextType);
                    setForm((s) => ({
                      ...s,
                      reminder_type: nextType,
                      is_smart: nextType === "danger_zone" ? s.is_smart : false,
                      title: defaults.title,
                      message: defaults.message,
                    }));
                  }}
                >
                  <option value="danger_zone">{t.reminder_type_danger_zone}</option>
                  <option value="morning_checkin">{t.reminder_type_morning_checkin}</option>
                  <option value="evening_review">{t.reminder_type_evening_review}</option>
                  <option value="motivation">{t.reminder_type_motivation}</option>
                  <option value="streak_celebration">{t.reminder_type_streak_celebration}</option>
                  <option value="custom">{t.reminder_type_custom}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] uppercase mb-1">{t.reminders_habit_optional}</label>
                <select
                  className="input-forge"
                  value={form.habit_id}
                  onChange={(e) => setForm((s) => ({ ...s, habit_id: e.target.value }))}
                >
                  <option value="">{t.reminders_all_habits}</option>
                  {habits.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{t.reminders_smart_label}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {t.reminders_smart_desc}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!smartAvailable) return;
                    setForm((s) => ({ ...s, is_smart: !s.is_smart }));
                  }}
                  disabled={!smartAvailable}
                  className={`w-12 h-6 rounded-full transition-all relative ${
                    form.is_smart && smartAvailable ? "bg-[var(--accent-success)]" : "bg-[var(--bg-elevated)]"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${
                      form.is_smart && smartAvailable ? "left-6" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] uppercase mb-1">{t.reminders_title_label}</label>
                <input
                  className="input-forge"
                  value={form.title}
                  onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] uppercase mb-1">{t.reminders_message_label}</label>
                <textarea
                  className="input-forge min-h-[90px]"
                  value={form.message}
                  onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))}
                />
              </div>

              {form.is_smart && form.reminder_type === "danger_zone" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] uppercase mb-1">{t.reminders_threshold_label}</label>
                    <input
                      type="number"
                      className="input-forge"
                      min={0}
                      max={100}
                      value={form.danger_threshold}
                      onChange={(e) => setForm((s) => ({ ...s, danger_threshold: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] uppercase mb-1">{t.reminders_cooldown_label}</label>
                    <input
                      type="number"
                      className="input-forge"
                      min={0}
                      value={form.cooldown_minutes}
                      onChange={(e) => setForm((s) => ({ ...s, cooldown_minutes: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] uppercase mb-1">{t.reminders_quiet_start}</label>
                    <input
                      type="time"
                      className="input-forge"
                      value={form.quiet_hours_start}
                      onChange={(e) => setForm((s) => ({ ...s, quiet_hours_start: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] uppercase mb-1">{t.reminders_quiet_end}</label>
                    <input
                      type="time"
                      className="input-forge"
                      value={form.quiet_hours_end}
                      onChange={(e) => setForm((s) => ({ ...s, quiet_hours_end: e.target.value }))}
                    />
                  </div>
                </div>
              ) : !form.is_smart ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] uppercase mb-1">{t.reminders_time}</label>
                    <input
                      type="time"
                      className="input-forge"
                      value={form.time_of_day}
                      onChange={(e) => setForm((s) => ({ ...s, time_of_day: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] uppercase mb-1">{t.reminders_days}</label>
                    <input
                      className="input-forge"
                      value={form.days_of_week.join(",")}
                      onChange={(e) =>
                        setForm((s) => ({
                          ...s,
                          days_of_week: e.target.value
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean)
                            .map((x) => Number(x))
                            .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6),
                        }))
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setIsModalOpen(false)} className="btn-ghost text-sm">
                {t.cancel}
              </button>
              <button
                onClick={submit}
                disabled={createReminder.isPending}
                className="btn-fire text-sm"
              >
                {createReminder.isPending ? t.reminders_creating : t.reminders_create}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
