"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Clock, BookOpen, Video, FileText, Book, CheckCircle2, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { logProgress } from "@/lib/api";

const typeIcons: Record<string, React.ReactNode> = {
  video: <Video className="w-3 h-3" />,
  article: <FileText className="w-3 h-3" />,
  course: <BookOpen className="w-3 h-3" />,
  book: <Book className="w-3 h-3" />,
};

const typeColors: Record<string, string> = {
  video: "bg-red-500/20 text-red-400 border-red-500/20",
  article: "bg-blue-500/20 text-blue-400 border-blue-500/20",
  course: "bg-accent/20 text-accent border-accent/20",
  book: "bg-secondary/20 text-secondary border-secondary/20",
};

interface PathItemCardProps {
  id: string;
  title: string;
  resourceType: string;
  estimatedHours: number;
  resourceUrl?: string;
  status?: "not_started" | "in_progress" | "done";
  onClick?: () => void;
  delay?: number;
  onDone?: () => void;
}

function formatElapsed(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function PathItemCard({
  id, title, resourceType, estimatedHours, resourceUrl,
  status: initialStatus = "not_started", onClick, delay = 0, onDone,
}: PathItemCardProps) {
  const [status, setStatus] = useState(initialStatus);
  const [tracking, setTracking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const startRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync external status changes
  useEffect(() => { setStatus(initialStatus); }, [initialStatus]);

  // Live timer
  useEffect(() => {
    if (tracking) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [tracking]);

  function handleClick() {
    if (status === "done") return;
    if (onClick) { onClick(); return; }
    if (resourceUrl) {
      window.open(resourceUrl, "_blank", "noopener,noreferrer");
      if (!tracking) {
        startRef.current = Date.now();
        setTracking(true);
        setElapsed(0);
        setStatus("in_progress");
      }
    }
  }

  async function handleDone(e: React.MouseEvent) {
    e.stopPropagation();
    if (saving) return;
    setSaving(true);
    setTracking(false);
    const minsSpent = Math.max(1, Math.round(elapsed / 60));
    try {
      await logProgress({
        path_item_id: id,
        status: "done",
        completion_pct: 100,
        time_spent_mins: minsSpent,
      });
      setStatus("done");
      onDone?.();
    } catch {
      // Silently fail — don't block UX
      setStatus("done");
      onDone?.();
    } finally {
      setSaving(false);
      setElapsed(0);
    }
  }

  function handleCancel(e: React.MouseEvent) {
    e.stopPropagation();
    setTracking(false);
    setElapsed(0);
    setStatus("not_started");
    startRef.current = null;
  }

  const isDone = status === "done";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      onClick={handleClick}
      className={cn(
        "glass-card p-4 transition-all group",
        isDone ? "opacity-60 cursor-default" : "cursor-pointer hover:border-accent/30 hover:bg-white/5",
        tracking && "border-accent/40 bg-accent/5",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className={cn(
          "text-sm font-medium text-text-primary leading-snug",
          isDone && "line-through text-text-muted"
        )}>
          {title}
        </p>
        {!isDone && resourceUrl && (
          <span className="flex-shrink-0 text-text-muted group-hover:text-accent transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />
          </span>
        )}
        {isDone && <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-xs font-medium border",
          typeColors[resourceType] ?? typeColors.article
        )}>
          {typeIcons[resourceType]}
          {resourceType}
        </span>
        <span className="flex items-center gap-1 text-xs text-text-muted">
          <Clock className="w-3 h-3" />
          {estimatedHours}h est.
        </span>

        {/* Live timer + Done button */}
        <AnimatePresence>
          {tracking && (
            <motion.div
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="ml-auto flex items-center gap-2"
              onClick={e => e.stopPropagation()}
            >
              <span className="flex items-center gap-1 text-xs text-accent font-mono">
                <Timer className="w-3 h-3" />
                {formatElapsed(elapsed)}
              </span>
              <button
                onClick={handleDone}
                disabled={saving}
                className="text-xs px-2.5 py-1 rounded-pill bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Done"}
              </button>
              <button
                onClick={handleCancel}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {!tracking && isDone && (
          <span className="ml-auto text-xs text-green-400 font-medium">Done ✓</span>
        )}
        {!tracking && status === "in_progress" && (
          <span className="ml-auto text-xs text-accent font-medium">In Progress</span>
        )}
      </div>
    </motion.div>
  );
}
