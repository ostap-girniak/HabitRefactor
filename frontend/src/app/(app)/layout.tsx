"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Swords,
  CalendarCheck,
  Mic,
  Brain,
  Shield,
  Flame,
  BarChart3,
  Settings,
  LogOut,
  MessageCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useT } from "@/lib/i18n";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: t.nav_war_room },
    { href: "/habits", icon: Swords, label: t.nav_habits },
    { href: "/checkin", icon: CalendarCheck, label: t.nav_checkin },
    { href: "/journal", icon: Mic, label: t.nav_journal },
    { href: "/insights", icon: Brain, label: t.nav_insights },
    { href: "/oracle", icon: MessageCircle, label: t.nav_oracle },
    { href: "/identity", icon: Shield, label: t.nav_identity },
    { href: "/forge", icon: Flame, label: t.nav_forge },
    { href: "/pain", icon: BarChart3, label: t.nav_pain },
  ];

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[var(--bg-secondary)] border-r border-[var(--border-default)] p-4 fixed h-full z-30">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 mb-6">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(255,77,0,0.3)]">
            <img 
              src="/logo.png" 
              alt="HabitRefactor" 
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <span className="text-sm font-bold text-[var(--text-primary)] block leading-tight">
              HabitRefactor
            </span>
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest italic">
              you vs you
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? "active" : ""}`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="space-y-1 pt-4 border-t border-[var(--border-default)]">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{t.nav_alerts}</span>
            <NotificationBell />
          </div>
          <Link href="/settings" className="sidebar-link">
            <Settings className="w-5 h-5" />
            <span>{t.nav_settings}</span>
          </Link>
          <button onClick={handleLogout} className="sidebar-link w-full text-left hover:text-[var(--accent-danger)]">
            <LogOut className="w-5 h-5" />
            <span>{t.nav_logout}</span>
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-secondary)] border-t border-[var(--border-default)] z-30 glass" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center overflow-x-auto scrollbar-hide px-1 py-1" style={{ WebkitOverflowScrolling: "touch" }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 min-w-[64px] px-2 py-2 rounded-lg text-[10px] font-medium transition-colors shrink-0 ${
                  isActive
                    ? "text-[var(--accent-fire)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          <Link
            href="/settings"
            className={`flex flex-col items-center gap-0.5 min-w-[64px] px-2 py-2 rounded-lg text-[10px] font-medium transition-colors shrink-0 ${
              pathname === "/settings"
                ? "text-[var(--accent-fire)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="truncate">{t.nav_settings}</span>
          </Link>
        </div>
      </nav>

      {/* Mobile top bar with notification bell */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 glass border-b border-[var(--border-default)]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center justify-between px-4 py-2">
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="w-7 h-7 rounded-lg" />
            <span className="text-sm font-bold text-[var(--text-primary)]">HabitRefactor</span>
          </Link>
          <NotificationBell />
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 md:ml-64 pb-20 md:pb-0 pt-14 md:pt-0">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
