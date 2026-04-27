import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  current_identity_statement: string | null;
  onboarding_completed: boolean;
  preferred_language: string;
  timezone: string;
  created_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  category: string;
  description: string;
  unit_name: string;
  cost_per_unit: number;
  time_per_unit_minutes: number;
  calories_per_unit: number;
  frequency: string;
  reduction_mode: string;
  approach: string | null;
  target_frequency: string | null;
  initial_triggers: string[];
  is_active: boolean;
  current_streak_days: number;
  best_streak_days: number;
  total_relapses: number;
  sobriety_start_date: string;
  alternative_behavior: string | null;
  created_at: string;
}

interface UserState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

interface HabitState {
  habits: Habit[];
  selectedHabitId: string | null;
  setHabits: (habits: Habit[]) => void;
  addHabit: (habit: Habit) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  removeHabit: (id: string) => void;
  selectHabit: (id: string | null) => void;
  getSelectedHabit: () => Habit | undefined;
}

interface UIState {
  sidebarOpen: boolean;
  activeModal: string | null;
  toasts: { id: string; type: "success" | "error" | "info"; message: string }[];
  toggleSidebar: () => void;
  openModal: (modal: string) => void;
  closeModal: () => void;
  addToast: (type: "success" | "error" | "info", message: string) => void;
  removeToast: (id: string) => void;
}

// ---- User Store ----
export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      setUser: (user) =>
        set({ user, isAuthenticated: !!user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () =>
        set({ user: null, isAuthenticated: false, isLoading: false }),
    }),
    {
      name: "catalyst-user",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// ---- Habit Store ----
export const useHabitStore = create<HabitState>()((set, get) => ({
  habits: [],
  selectedHabitId: null,
  setHabits: (habits) => set({ habits }),
  addHabit: (habit) =>
    set((state) => ({ habits: [...state.habits, habit] })),
  updateHabit: (id, updates) =>
    set((state) => ({
      habits: state.habits.map((h) =>
        h.id === id ? { ...h, ...updates } : h
      ),
    })),
  removeHabit: (id) =>
    set((state) => ({
      habits: state.habits.filter((h) => h.id !== id),
    })),
  selectHabit: (id) => set({ selectedHabitId: id }),
  getSelectedHabit: () => {
    const state = get();
    return state.habits.find((h) => h.id === state.selectedHabitId);
  },
}));

// ---- UI Store ----
export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: true,
  activeModal: null,
  toasts: [],
  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
  addToast: (type, message) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id: Date.now().toString(), type, message },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
