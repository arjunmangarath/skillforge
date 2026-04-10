"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Map, Brain, Sparkles, Gamepad2, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityLogPanel } from "@/components/ui/activity-log-panel";
import { Logo } from "@/components/ui/logo";
import { getGoals } from "@/lib/api";

const nav = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", requiresGoal: false },
  { href: "/path", icon: Map, label: "Learning Path", requiresGoal: false },
  { href: "/recall", icon: Brain, label: "Memorise", requiresGoal: false },
  { href: "/chat", icon: Sparkles, label: "Practice with AI", requiresGoal: false },
  { href: "/game", icon: Gamepad2, label: "Games", requiresGoal: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const [hasGoal, setHasGoal] = useState(false);

  useEffect(() => {
    getGoals()
      .then((r: any) => setHasGoal(r.goals?.length > 0))
      .catch(() => setHasGoal(false));
  }, [pathname]); // re-check whenever route changes

  // Don't render sidebar on auth pages
  if (pathname === "/login") return null;

  return (
    <aside className="fixed left-0 top-0 h-full w-16 lg:w-56 flex flex-col bg-surface-2 border-r border-border z-40">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center glow-accent flex-shrink-0">
          <Logo size={22} className="text-white" />
        </div>
        <span className="hidden lg:block font-sans font-700 text-lg text-text-primary">
          SKILLFORGE
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {nav.map(({ href, icon: Icon, label, requiresGoal }) => {
          const active = pathname.startsWith(href);
          const locked = requiresGoal && !hasGoal;

          if (locked) {
            return (
              <div key={href} title="Create a goal on the dashboard first">
                <motion.div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-input opacity-40 cursor-not-allowed select-none"
                >
                  <Icon className="w-5 h-5 flex-shrink-0 text-text-muted" />
                  <span className="hidden lg:flex lg:flex-1 items-center justify-between text-sm font-medium text-text-muted">
                    {label}
                    <Lock className="w-3 h-3 opacity-60" />
                  </span>
                </motion.div>
              </div>
            );
          }

          return (
            <Link key={href} href={href}>
              <motion.div
                whileHover={{ x: 2 }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-input transition-colors",
                  active
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="hidden lg:block text-sm font-medium">{label}</span>
                {active && (
                  <motion.div
                    layoutId="active-indicator"
                    className="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-accent"
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Activity Log toggle at bottom */}
      <div className="px-2 pb-4 border-t border-border pt-3">
        <ActivityLogPanel />
      </div>
    </aside>
  );
}
