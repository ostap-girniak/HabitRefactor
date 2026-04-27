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
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "War Room" },
  { href: "/habits", icon: Swords, label: "Habits" },
  { href: "/checkin", icon: CalendarCheck, label: "Check-in" },
  { href: "/journal", icon: Mic, label: "Journal" },
  { href: "/insights", icon: Brain, label: "AI Insights" },
  { href: "/identity", icon: Shield, label: "Identity Lab" },
  { href: "/forge", icon: Flame, label: "HabitRefactor" },
  { href: "/pain", icon: BarChart3, label: "Pain Data" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

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
          <Link href="/settings" className="sidebar-link">
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Link>
          <button onClick={handleLogout} className="sidebar-link w-full text-left hover:text-[var(--accent-danger)]">
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-secondary)] border-t border-[var(--border-default)] z-30 px-2 py-1 glass">
        <div className="flex items-center justify-around">
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-[10px] font-medium transition-colors ${
                  isActive
                    ? "text-[var(--accent-fire)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 md:ml-64 pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
