"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, Eye, EyeOff, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { useUIStore } from "@/lib/store";

export default function RegisterPage() {
  const router = useRouter();
  const t = useT();
  const { language, setLanguage } = useUIStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.length < 8) {
      setError(t.register_password_error);
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: name,
          },
        },
      });

      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError(t.register_error_generic);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(255,77,0,0.1)_0%,transparent_70%)] pointer-events-none" />

      {/* Language switcher - top right */}
      <button
        onClick={() => setLanguage(language === "en" ? "uk" : "en")}
        className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] hover:border-[var(--accent-fire)] transition-colors text-sm font-medium text-[var(--text-secondary)] z-10"
      >
        <Globe className="w-4 h-4" />
        {language === "en" ? "UK 🇺🇦" : "EN 🇬🇧"}
      </button>

      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(255,77,0,0.4)] animate-fire-glow">
              <img 
                src="/logo.png" 
                alt="HabitRefactor" 
                className="w-full h-full object-cover"
              />
            </div>
          </Link>
          <h1 className="text-2xl font-black text-[var(--text-primary)]">
            {t.register_title}
          </h1>
          <p className="text-[var(--text-secondary)] mt-2 text-sm">
            {t.register_subtitle}
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleRegister} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-[var(--accent-danger-subtle)] text-[var(--accent-danger)] text-sm font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
                {t.register_name}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                <input
                  id="register-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-forge"
                  style={{ paddingLeft: "2.75rem" }}
                  placeholder={t.register_name_placeholder}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
                {t.register_email}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-forge"
                  style={{ paddingLeft: "2.75rem" }}
                  placeholder="warrior@forge.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
                {t.register_password}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-forge"
                  style={{ paddingLeft: "2.75rem", paddingRight: "3.5rem" }}
                  placeholder={t.register_password_placeholder}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="btn-fire w-full py-3 text-base disabled:opacity-50"
            >
              {loading ? t.register_loading : t.register_submit}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-[var(--text-secondary)]">
          {t.register_has_account}{" "}
          <Link href="/login" className="text-[var(--accent-fire)] font-semibold hover:underline">
            {t.register_login_link}
          </Link>
        </p>
      </div>
    </div>
  );
}
