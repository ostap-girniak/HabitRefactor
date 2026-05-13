import axios from "axios";
import { createClient } from "./supabase";

// Proxy all API requests through Next.js to avoid browser CORS / network-policy issues.
const API_BASE_URL = "/api/backend";

/**
 * Axios instance configured with auth token from Supabase.
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor: attach Supabase auth token to every request
api.interceptors.request.use(async (config) => {
  console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (error) {
    console.error("Failed to get auth token:", error);
  }
  return config;
}, (error) => {
  console.error("[API REQUEST ERROR]", error);
  return Promise.reject(error);
});

// Response interceptor: handle 401s
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired — try to refresh
      const supabase = createClient();
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        // Redirect to login
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ---- API Functions ----

// Auth
export const authApi = {
  getProfile: () => api.get("/auth/me"),
  updateProfile: (data: Record<string, unknown>) => api.put("/auth/me", data),
  completeOnboarding: (data: Record<string, unknown>) =>
    api.post("/auth/onboarding", data),
};

// Habits
export const habitsApi = {
  list: () => api.get("/habits/"),
  create: (data: Record<string, unknown>) => api.post("/habits/", data),
  get: (id: string) => api.get(`/habits/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/habits/${id}`, data),
  delete: (id: string) => api.delete(`/habits/${id}`),
  resetStreak: (id: string) => api.post(`/habits/${id}/reset-streak`),
  getStats: (id: string) => api.get(`/habits/${id}/stats`),
  getSavings: (id: string) => api.get(`/habits/${id}/savings`),
};

// Checkins
export const checkinsApi = {
  getToday: () => api.get("/checkins/today"),
  create: (data: Record<string, unknown>) => api.post("/checkins/", data),
  getHistory: (params?: Record<string, unknown>) =>
    api.get("/checkins/history", { params }),
  getCalendar: (habitId: string) => api.get(`/checkins/calendar/${habitId}`),
};

// Journal
export const journalApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/journal/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  create: (data: Record<string, unknown>) => api.post("/journal/", data),
  list: (params?: Record<string, unknown>) =>
    api.get("/journal/", { params }),
  get: (id: string) => api.get(`/journal/${id}`),
  delete: (id: string) => api.delete(`/journal/${id}`),
  transcribe: (id: string) => api.post(`/journal/${id}/transcribe`),
};

// AI
export const aiApi = {
  analyzeDaily: (data?: Record<string, unknown>) =>
    api.post("/ai/analyze/daily", data || {}),
  analyzeWeekly: (data?: Record<string, unknown>) =>
    api.post("/ai/analyze/weekly", data || {}),
  getInsights: (params?: Record<string, unknown>) =>
    api.get("/ai/insights", { params }),
  getInsight: (id: string) => api.get(`/ai/insights/${id}`),
  submitFeedback: (id: string, data: Record<string, unknown>) =>
    api.post(`/ai/insights/${id}/feedback`, data),
  getHeroChapters: () => api.get("/ai/hero/chapters"),
  generateHeroChapter: () => api.post("/ai/hero/generate"),
  generateLetter: (data: Record<string, unknown>) =>
    api.post("/ai/catalyst/letter", data),
  generateManifesto: () => api.post("/ai/catalyst/manifesto"),
  getPainProjection: (habitId: string) =>
    api.get(`/ai/pain-projection/${habitId}`),
  deleteInsight: (id: string) => api.delete(`/ai/insights/${id}`),
};

// Identity
export const identityApi = {
  getStatements: () => api.get("/identity/statements/"),
  create: (data: Record<string, unknown>) =>
    api.post("/identity/statements/", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/identity/statements/${id}`, data),
  affirm: (id: string) => api.post(`/identity/statements/${id}/affirm`),
  generateAffirmation: (statementId?: string) =>
    api.post("/identity/generate-affirmation", statementId ? { statement_id: statementId } : {}),
};

// Stats
export const statsApi = {
  getDashboard: () => api.get("/stats/dashboard"),
  getStreaks: () => api.get("/stats/streaks"),
  getSavings: (habitId: string) => api.get(`/stats/savings/${habitId}`),
  getTrends: (habitId: string, period?: string) =>
    api.get(`/stats/trends/${habitId}`, { params: { period } }),
  getOracle: (habitId?: string) =>
    api.get(`/stats/oracle${habitId ? `?habit_id=${habitId}` : ""}`).then((res) => res.data),
  getBattles: (habitId?: string) =>
    api.get(`/stats/battles${habitId ? `?habit_id=${habitId}` : ""}`).then((res) => res.data),
};

// Notifications
export const notificationsApi = {
  subscribe: (data: Record<string, unknown>) =>
    api.post("/notifications/subscribe", data),
  unsubscribe: (endpoint: string) =>
    api.delete("/notifications/subscribe", { params: { endpoint } }),
  testPush: () => api.post("/notifications/test-push"),
  dangerCheck: (params?: { habitId?: string; forceSend?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.habitId) qs.set("habit_id", params.habitId);
    if (params?.forceSend) qs.set("force_send", "true");
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return api.post(`/notifications/danger-check${suffix}`);
  },
  getReminders: () => api.get("/notifications/reminders"),
  createReminder: (data: Record<string, unknown>) =>
    api.post("/notifications/reminders", data),
  updateReminder: (id: string, data: Record<string, unknown>) =>
    api.put(`/notifications/reminders/${id}`, data),
  deleteReminder: (id: string) =>
    api.delete(`/notifications/reminders/${id}`),
  // Notification history
  getHistory: (limit?: number) =>
    api.get("/notifications/history", { params: { limit: limit || 30 } }),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markRead: (id: string) => api.post(`/notifications/history/${id}/read`),
  markAllRead: () => api.post("/notifications/read-all"),
  journalAlert: () => api.post("/notifications/journal-alert"),
};
