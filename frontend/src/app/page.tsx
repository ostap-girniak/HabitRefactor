"use client";

import Link from "next/link";
import {
  Flame,
  Shield,
  Brain,
  Target,
  Mic,
  BarChart3,
  Swords,
  ArrowRight,
  Bell,
  Globe,
  MessageCircle,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useUIStore } from "@/lib/store";

export default function LandingPage() {
  const t = useT();
  const { language, setLanguage } = useUIStore();

  const features = [
    {
      icon: Target,
      titleKey: "landing_feat_counter" as const,
      descKey: "landing_feat_counter_desc" as const,
      color: "var(--accent-success)",
    },
    {
      icon: Brain,
      titleKey: "landing_feat_ai" as const,
      descKey: "landing_feat_ai_desc" as const,
      color: "var(--accent-fire)",
    },
    {
      icon: Mic,
      titleKey: "landing_feat_journal" as const,
      descKey: "landing_feat_journal_desc" as const,
      color: "var(--accent-info)",
    },
    {
      icon: Shield,
      titleKey: "landing_feat_identity" as const,
      descKey: "landing_feat_identity_desc" as const,
      color: "var(--accent-ember)",
    },
    {
      icon: MessageCircle,
      titleKey: "landing_feat_oracle" as const,
      descKey: "landing_feat_oracle_desc" as const,
      color: "#7C4DFF",
    },
    {
      icon: BarChart3,
      titleKey: "landing_feat_pain" as const,
      descKey: "landing_feat_pain_desc" as const,
      color: "var(--accent-danger)",
    },
    {
      icon: Swords,
      titleKey: "landing_feat_hero" as const,
      descKey: "landing_feat_hero_desc" as const,
      color: "#00BCD4",
    },
    {
      icon: Bell,
      titleKey: "landing_feat_push" as const,
      descKey: "landing_feat_push_desc" as const,
      color: "#FF9800",
    },
    {
      icon: Globe,
      titleKey: "landing_feat_i18n" as const,
      descKey: "landing_feat_i18n_desc" as const,
      color: "#4CAF50",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(255,77,0,0.08)] to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(255,77,0,0.12)_0%,transparent_70%)] pointer-events-none" />

        <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(255,77,0,0.4)]">
              <img 
                src="/logo.png" 
                alt="HabitRefactor" 
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
              HabitRefactor
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* Language switcher */}
            <button
              onClick={() => setLanguage(language === "en" ? "uk" : "en")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] hover:border-[var(--accent-fire)] transition-colors text-sm font-medium text-[var(--text-secondary)]"
            >
              <Globe className="w-4 h-4" />
              {language === "en" ? "UK 🇺🇦" : "EN 🇬🇧"}
            </button>
            <Link
              href="/login"
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors text-sm"
            >
              {t.landing_sign_in}
            </Link>
            <Link href="/register" className="btn-fire text-sm">
              {t.landing_start}
            </Link>
          </div>
        </nav>

        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-20 pb-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-fire-subtle)] text-[var(--accent-fire)] text-sm font-semibold mb-8 animate-fade-in">
            <Flame className="w-4 h-4" />
            <em>{t.landing_tagline}</em>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-[var(--text-primary)] leading-[1.1] mb-6 animate-slide-up">
            {t.landing_hero_title_1}
            <br />
            <span className="bg-gradient-to-r from-[var(--accent-fire)] to-[var(--accent-ember)] bg-clip-text text-transparent">
              {t.landing_hero_title_2}
            </span>
          </h1>

          <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed animate-slide-up" style={{ animationDelay: "0.1s" }}>
            {t.landing_hero_desc}{" "}
            <span className="text-[var(--text-primary)] font-semibold">
              {t.landing_hero_desc_bold}
            </span>{" "}
            {t.landing_hero_desc_2}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <Link href="/register" className="btn-fire text-base px-8 py-4 flex items-center gap-2">
              {t.landing_cta_primary}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="#features" className="btn-ghost text-base px-8 py-4">
              {t.landing_cta_secondary}
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-md mx-auto mt-16 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <div>
              <div className="text-2xl font-black text-[var(--accent-fire)]">{t.landing_stat_ai}</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">{t.landing_stat_ai_desc}</div>
            </div>
            <div>
              <div className="text-2xl font-black text-[var(--accent-success)]">{t.landing_stat_rag}</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">{t.landing_stat_rag_desc}</div>
            </div>
            <div>
              <div className="text-2xl font-black text-[var(--accent-ember)]">{t.landing_stat_247}</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">{t.landing_stat_247_desc}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] mb-4">
              {t.landing_features_title}
            </h2>
            <p className="text-[var(--text-secondary)] text-lg max-w-xl mx-auto">
              {t.landing_features_desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={feature.titleKey}
                className="card group cursor-default animate-slide-up"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ background: `${feature.color}15` }}
                >
                  <feature.icon
                    className="w-6 h-6"
                    style={{ color: feature.color }}
                  />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                  {t[feature.titleKey]}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {t[feature.descKey]}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="card-fire p-12">
            <Flame className="w-16 h-16 text-[var(--accent-fire)] mx-auto mb-6 animate-float" />
            <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] mb-4">
              {t.landing_cta2_title}
              <br />
              {t.landing_cta2_title2}
            </h2>
            <p className="text-[var(--text-secondary)] mb-8 text-lg">
              {t.landing_cta2_desc}
            </p>
            <Link href="/register" className="btn-fire text-lg px-10 py-4 inline-flex items-center gap-2">
              {t.landing_cta2_btn}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border-default)] py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
            <Flame className="w-4 h-4 text-[var(--accent-fire)]" />
            HabitRefactor © {new Date().getFullYear()}
          </div>
          <div className="text-[var(--text-muted)] text-sm">
            {t.landing_footer}
          </div>
        </div>
      </footer>
    </div>
  );
}
