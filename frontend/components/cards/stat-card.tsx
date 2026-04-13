"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: "green" | "indigo" | "white";
  delay?: number;
}

export function StatCard({ label, value, icon, accent = "white", delay = 0 }: StatCardProps) {
  const accentClass = {
    green: "text-accent",
    indigo: "text-secondary",
    white: "text-text-primary",
  }[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="glass-card p-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-text-secondary text-xs font-medium uppercase tracking-wider mb-2">
            {label}
          </p>
          <p className={cn("text-2xl font-sans font-bold", accentClass)}>{value}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-text-secondary">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
