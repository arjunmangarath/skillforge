"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, X, Trash2 } from "lucide-react";
import { activityLog, LogEntry } from "@/lib/activity-log";
import { cn } from "@/lib/utils";

const levelStyles: Record<string, string> = {
  info:    "text-text-muted",
  success: "text-green-400",
  error:   "text-red-400",
  ai:      "text-accent",
};

const levelDot: Record<string, string> = {
  info:    "bg-white/20",
  success: "bg-green-400",
  error:   "bg-red-400",
  ai:      "bg-accent",
};

function fmt(d: Date) {
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ActivityLogPanel() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return activityLog.subscribe(setEntries);
  }, []);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, open]);

  return (
    <>
      {/* Toggle button — sits at bottom of sidebar */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Activity Log"
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-input transition-colors w-full",
          open
            ? "bg-accent/10 text-accent border border-accent/20"
            : "text-text-secondary hover:text-text-primary hover:bg-white/5"
        )}
      >
        <Activity className="w-5 h-5 flex-shrink-0" />
        <span className="hidden lg:block text-sm font-medium">Activity Log</span>
        {entries.length > 0 && (
          <span className="hidden lg:flex ml-auto w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] items-center justify-center font-mono">
            {Math.min(entries.length, 99)}
          </span>
        )}
      </button>

      {/* Slide-in panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed left-16 lg:left-56 top-0 h-full w-80 bg-surface-2 border-r border-border z-30 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent" />
                <span className="text-sm font-semibold text-text-primary">Activity Log</span>
                <span className="flex items-center gap-1">
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full bg-green-400"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-[10px] text-green-400 font-mono">LIVE</span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => activityLog.clear()}
                  title="Clear log"
                  className="p-1.5 text-text-muted hover:text-red-400 transition-colors rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 text-text-muted hover:text-text-primary transition-colors rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Log entries */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-xs">
              {entries.length === 0 ? (
                <p className="text-text-muted text-center mt-8">No activity yet.</p>
              ) : (
                [...entries].reverse().map(entry => (
                  <div key={entry.id} className="flex items-start gap-2 py-1 border-b border-white/3">
                    <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", levelDot[entry.level])} />
                    <div className="flex-1 min-w-0">
                      <span className="text-white/30 mr-1.5">{fmt(entry.timestamp)}</span>
                      <span className={levelStyles[entry.level]}>{entry.message}</span>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
