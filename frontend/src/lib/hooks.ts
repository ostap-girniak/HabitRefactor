"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  habitsApi,
  checkinsApi,
  statsApi,
  aiApi,
  journalApi,
  identityApi,
  authApi,
  notificationsApi,
} from "./api";
import { useUserStore, useHabitStore } from "./store";
import type { Habit, UserProfile } from "./store";

type HabitsResponse = {
  habits?: Habit[];
};

type OracleSessionsResponse = {
  sessions?: unknown[];
};

type OracleHistoryResponse = {
  history?: unknown[];
};

// ============================================
// Auth Hooks
// ============================================

export function useProfile() {
  const setUser = useUserStore((s) => s.setUser);

  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await authApi.getProfile();
      setUser(data as UserProfile);
      return data as UserProfile;
    },
    retry: 1,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => authApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

// ============================================
// Habit Hooks
// ============================================

export function useHabits() {
  const setHabits = useHabitStore((s) => s.setHabits);

  return useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      const { data } = await habitsApi.list();
      const habits = (data as HabitsResponse).habits || [];
      setHabits(habits);
      return habits;
    },
  });
}

export function useHabit(id: string) {
  return useQuery({
    queryKey: ["habits", id],
    queryFn: async () => {
      const { data } = await habitsApi.get(id);
      return data as Habit;
    },
    enabled: !!id,
  });
}

export function useCreateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => habitsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      habitsApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["habits", id] });
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => habitsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useResetStreak() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => habitsApi.resetStreak(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["habits", id] });
    },
  });
}

export function useHabitStats(id: string) {
  return useQuery({
    queryKey: ["habits", id, "stats"],
    queryFn: async () => {
      const { data } = await habitsApi.getStats(id);
      return data;
    },
    enabled: !!id,
  });
}

export function useHabitSavings(id: string) {
  return useQuery({
    queryKey: ["habits", id, "savings"],
    queryFn: async () => {
      const { data } = await habitsApi.getSavings(id);
      return data;
    },
    enabled: !!id,
  });
}

// ============================================
// Check-in Hooks
// ============================================

export function useTodayCheckins() {
  return useQuery({
    queryKey: ["checkins", "today"],
    queryFn: async () => {
      const { data } = await checkinsApi.getToday();
      return data;
    },
  });
}

export function useCreateCheckin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => checkinsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkins"] });
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useCheckinHistory(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ["checkins", "history", params],
    queryFn: async () => {
      const { data } = await checkinsApi.getHistory(params);
      return data;
    },
  });
}

export function useCheckinCalendar(habitId: string) {
  return useQuery({
    queryKey: ["checkins", "calendar", habitId],
    queryFn: async () => {
      const { data } = await checkinsApi.getCalendar(habitId);
      return data;
    },
    enabled: !!habitId,
  });
}

// ============================================
// Journal Hooks
// ============================================

export function useJournalEntries(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ["journal", params],
    queryFn: async () => {
      const { data } = await journalApi.list(params);
      return data;
    },
  });
}

export function useJournalEntry(id: string) {
  return useQuery({
    queryKey: ["journal", id],
    queryFn: async () => {
      const { data } = await journalApi.get(id);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => journalApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "history"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}

export function useUploadJournalMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => journalApi.upload(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal"] });
    },
  });
}

export function useTranscribeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => journalApi.transcribe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal"] });
    },
  });
}

// ============================================
// AI Hooks
// ============================================

export function useAIInsights(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ["ai", "insights", params],
    queryFn: async () => {
      const { data } = await aiApi.getInsights(params);
      return data;
    },
  });
}

export function useDeleteAIInsight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => aiApi.deleteInsight(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "insights"] });
    },
  });
}

export function useAIInsight(id: string) {
  return useQuery({
    queryKey: ["ai", "insights", id],
    queryFn: async () => {
      const { data } = await aiApi.getInsight(id);
      return data;
    },
    enabled: !!id,
  });
}

export function useGenerateDailyAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data?: Record<string, unknown>) => aiApi.analyzeDaily(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "insights"] });
    },
  });
}

export function useGenerateManifesto() {
  return useMutation({
    mutationFn: () => aiApi.generateManifesto(),
  });
}

export function useOracleSessions() {
  return useQuery({
    queryKey: ["ai", "oracle", "sessions"],
    queryFn: async () => {
      const { data } = await aiApi.getOracleSessions();
      return (data as OracleSessionsResponse).sessions || [];
    },
  });
}

export function useOracleHistory(sessionId?: string | null, limit?: number) {
  return useQuery({
    queryKey: ["ai", "oracle", "history", sessionId, limit],
    queryFn: async () => {
      const { data } = await aiApi.getOracleHistory(limit, sessionId ?? undefined);
      return (data as OracleHistoryResponse).history || [];
    },
    enabled: !!sessionId,
  });
}

export function useOracleChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { message: string; include_history?: boolean; session_id?: string }) =>
      aiApi.oracleChat(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "oracle", "history"] });
      queryClient.invalidateQueries({ queryKey: ["ai", "oracle", "sessions"] });
    },
  });
}


export function useGenerateWeeklyAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data?: Record<string, unknown>) => aiApi.analyzeWeekly(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "insights"] });
    },
  });
}

export function useGenerateHeroChapter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => aiApi.generateHeroChapter(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "hero"] });
    },
  });
}

export function useHeroChapters() {
  return useQuery({
    queryKey: ["ai", "hero"],
    queryFn: async () => {
      const { data } = await aiApi.getHeroChapters();
      return data;
    },
  });
}

export function useGenerateCatalystLetter() {
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => aiApi.generateLetter(data),
  });
}

export function usePainProjection(habitId: string) {
  return useQuery({
    queryKey: ["ai", "pain", habitId],
    queryFn: async () => {
      const { data } = await aiApi.getPainProjection(habitId);
      return data;
    },
    enabled: !!habitId,
  });
}

// ============================================
// Identity Hooks
// ============================================

export function useIdentityStatements() {
  return useQuery({
    queryKey: ["identity"],
    queryFn: async () => {
      const { data } = await identityApi.getStatements();
      return data;
    },
  });
}

export function useCreateIdentityStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => identityApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity"] });
    },
  });
}

export function useAffirmIdentity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => identityApi.affirm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity"] });
    },
  });
}

export function useUpdateIdentityStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      identityApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity"] });
    },
  });
}

export function useGenerateAffirmation() {
  return useMutation({
    mutationFn: (statementId?: string) => identityApi.generateAffirmation(statementId),
  });
}

// ============================================
// Stats / Dashboard Hooks
// ============================================

export function useDashboardStats() {
  return useQuery({
    queryKey: ["stats", "dashboard"],
    queryFn: async () => {
      const { data } = await statsApi.getDashboard();
      return data;
    },
  });
}

export function useStreakStats() {
  return useQuery({
    queryKey: ["stats", "streaks"],
    queryFn: async () => {
      const { data } = await statsApi.getStreaks();
      return data;
    },
  });
}

export function useTrends(habitId: string, period?: string) {
  return useQuery({
    queryKey: ["stats", "trends", habitId, period],
    queryFn: async () => {
      const { data } = await statsApi.getTrends(habitId, period);
      return data;
    },
    enabled: !!habitId,
  });
}

export function useOracle(habitId?: string) {
  return useQuery({
    queryKey: ["stats", "oracle", habitId],
    queryFn: async () => {
      return await statsApi.getOracle(habitId);
    },
  });
}

export function useBattleHistory(habitId?: string) {
  return useQuery({
    queryKey: ["stats", "battles", habitId],
    queryFn: async () => {
      return await statsApi.getBattles(habitId);
    },
  });
}

// ============================================
// Notifications / Reminders Hooks
// ============================================

export function useReminders() {
  return useQuery({
    queryKey: ["notifications", "reminders"],
    queryFn: async () => {
      const { data } = await notificationsApi.getReminders();
      return data;
    },
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => notificationsApi.createReminder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "reminders"] });
    },
  });
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      notificationsApi.updateReminder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "reminders"] });
    },
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.deleteReminder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "reminders"] });
    },
  });
}

// ============================================
// Notification History Hooks
// ============================================

export function useNotificationHistory(limit?: number) {
  return useQuery({
    queryKey: ["notifications", "history", limit],
    queryFn: async () => {
      const { data } = await notificationsApi.getHistory(limit);
      return data;
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const { data } = await notificationsApi.getUnreadCount();
      return data as { unread: number };
    },
    refetchInterval: 30_000, // Poll every 30 seconds
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "history"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "history"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}
