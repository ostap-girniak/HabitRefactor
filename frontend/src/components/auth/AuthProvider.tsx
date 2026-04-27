"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useUserStore } from "@/lib/store";
import type { Session, User } from "@supabase/supabase-js";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isLoading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

const PUBLIC_ROUTES = ["/", "/login", "/register", "/callback"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const setStoreUser = useUserStore((s) => s.setUser);
  const logout = useUserStore((s) => s.logout);

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user || null);
      setIsLoading(false);

      if (session?.user) {
        setStoreUser({
          id: session.user.id,
          email: session.user.email || "",
          display_name: session.user.user_metadata?.display_name || "Warrior",
          avatar_url: session.user.user_metadata?.avatar_url || null,
          current_identity_statement: null,
          onboarding_completed: false,
          preferred_language: "uk",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          created_at: session.user.created_at,
        });
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user || null);

      if (session?.user) {
        setStoreUser({
          id: session.user.id,
          email: session.user.email || "",
          display_name: session.user.user_metadata?.display_name || "Warrior",
          avatar_url: session.user.user_metadata?.avatar_url || null,
          current_identity_statement: null,
          onboarding_completed: false,
          preferred_language: "uk",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          created_at: session.user.created_at,
        });
      } else {
        logout();
      }
    });

    return () => subscription.unsubscribe();
  }, [setStoreUser, logout]);

  // Redirect logic
  useEffect(() => {
    if (isLoading) return;

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

    if (!session && !isPublicRoute) {
      router.push("/login");
    }
  }, [session, isLoading, pathname, router]);

  return (
    <AuthContext.Provider value={{ session, user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
