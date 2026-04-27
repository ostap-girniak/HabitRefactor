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
} from "lucide-react";

export default function LandingPage() {
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
            <Link
              href="/login"
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors text-sm"
            >
              Sign In
            </Link>
            <Link href="/register" className="btn-fire text-sm">
              Start Your Forge
            </Link>
          </div>
        </nav>

        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-20 pb-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-fire-subtle)] text-[var(--accent-fire)] text-sm font-semibold mb-8 animate-fade-in">
            <Flame className="w-4 h-4" />
            <em>you vs you.</em> No excuses.
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-[var(--text-primary)] leading-[1.1] mb-6 animate-slide-up">
            Forge Yourself
            <br />
            <span className="bg-gradient-to-r from-[var(--accent-fire)] to-[var(--accent-ember)] bg-clip-text text-transparent">
              Through Fire
            </span>
          </h1>

          <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed animate-slide-up" style={{ animationDelay: "0.1s" }}>
            Not another habit tracker. A{" "}
            <span className="text-[var(--text-primary)] font-semibold">
              powerful personal portal
            </span>{" "}
            for overcoming harmful habits through AI-driven analysis, trigger
            identification, and identity transformation.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <Link href="/register" className="btn-fire text-base px-8 py-4 flex items-center gap-2">
              Enter The Refactor
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="#features" className="btn-ghost text-base px-8 py-4">
              See How It Works
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-md mx-auto mt-16 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <div>
              <div className="text-2xl font-black text-[var(--accent-fire)]">AI</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">Powered Analysis</div>
            </div>
            <div>
              <div className="text-2xl font-black text-[var(--accent-success)]">RAG</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">Personalized Insights</div>
            </div>
            <div>
              <div className="text-2xl font-black text-[var(--accent-ember)]">24/7</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">Your Data, Your Truth</div>
            </div>
          </div>
        </div>
      </header>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] mb-4">
              Your Arsenal Against Weakness
            </h2>
            <p className="text-[var(--text-secondary)] text-lg max-w-xl mx-auto">
              Every tool designed to make you face the truth a and transform it
              into power.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Target,
                title: "Sobriety Counter",
                description:
                  "A massive, motivating timer showing your streak. Money saved. Time reclaimed. Health restored.",
                color: "var(--accent-success)",
              },
              {
                icon: Brain,
                title: "AI Analyzer",
                description:
                  "Sniper-precise insights based on YOUR data. Not generic advice — surgical analysis of your patterns.",
                color: "var(--accent-fire)",
              },
              {
                icon: Mic,
                title: "Video/Voice Journal",
                description:
                  "Record raw emotion in the moment. AI transcribes and analyzes your emotional state automatically.",
                color: "var(--accent-info)",
              },
              {
                icon: Shield,
                title: "Identity Shift Lab",
                description:
                  'Transform from "I\'m trying to quit" to "I AM a person in full control." With proof from your real data.',
                color: "var(--accent-ember)",
              },
              {
                icon: Swords,
                title: "Hero Mode",
                description:
                  "Your struggle becomes an epic story. Weekly chapters of your transformation journey. You are the hero.",
                color: "#7C4DFF",
              },
              {
                icon: BarChart3,
                title: "Pain Accumulator",
                description:
                  "See the brutal truth: what continuing costs you in money, health, and years of your life.",
                color: "var(--accent-danger)",
              },
            ].map((feature, i) => (
              <div
                key={feature.title}
                className="card group cursor-default animate-slide-up"
                style={{ animationDelay: `${i * 0.1}s` }}
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
                  {feature.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {feature.description}
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
              The forge is hot.
              <br />
              Are you ready to step in?
            </h2>
            <p className="text-[var(--text-secondary)] mb-8 text-lg">
              Stop lying to yourself. Stop making excuses. The only person who
              can change you is YOU.
            </p>
            <Link href="/register" className="btn-fire text-lg px-10 py-4 inline-flex items-center gap-2">
              I&apos;m Ready
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
            Built with fire. No excuses. No mediators.
          </div>
        </div>
      </footer>
    </div>
  );
}
