"use client";
import { motion } from "framer-motion";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <motion.div
      className={`bg-white/8 rounded-input ${className}`}
      animate={{ opacity: [0.4, 0.8, 0.4] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export function LoadingDots({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-text-muted text-sm">
      <div className="flex gap-1">
        {[0, 0.15, 0.3].map(d => (
          <motion.div
            key={d}
            className="w-1.5 h-1.5 rounded-full bg-accent/60"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: d }}
          />
        ))}
      </div>
      <span>{label}</span>
    </div>
  );
}

export function PageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center space-y-4">
        <div className="flex gap-2 justify-center">
          {[0, 0.15, 0.3].map(d => (
            <motion.div
              key={d}
              className="w-2.5 h-2.5 rounded-full bg-accent"
              animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: d }}
            />
          ))}
        </div>
        <p className="text-text-muted text-sm">{label}</p>
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="glass-card p-5 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-2 w-12" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 flex-1" />
      </div>
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}
