"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Flame } from "lucide-react";

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Handle the OAuth callback
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Auth callback error:", error);
        router.push("/login?error=auth_failed");
        return;
      }

      if (data.session) {
        // Check if user needs onboarding
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", data.session.user.id)
          .single();

        if (profile && !profile.onboarding_completed) {
          router.push("/onboarding");
        } else {
          router.push("/dashboard");
        }
      } else {
        router.push("/login");
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent-fire)] to-[var(--accent-ember)] flex items-center justify-center animate-fire-glow">
        <Flame className="w-8 h-8 text-white animate-pulse" />
      </div>
      <p className="text-[var(--text-secondary)] animate-pulse">Forging your session...</p>
    </div>
  );
}
