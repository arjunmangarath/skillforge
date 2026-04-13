"use client";
import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { getTodaysCards, submitReview } from "@/lib/api";
import { motion } from "framer-motion";

const QUALITY_BUTTONS = [
  { label: "Again", quality: 0, color: "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30" },
  { label: "Hard", quality: 2, color: "bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30" },
  { label: "Good", quality: 4, color: "bg-accent/20 text-accent border-accent/30 hover:bg-accent/30" },
  { label: "Easy", quality: 5, color: "bg-secondary/20 text-secondary border-secondary/30 hover:bg-secondary/30" },
];

export default function RecallPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTodaysCards().then(res => {
      setCards(res.cards);
      setLoading(false);
    });
  }, []);

  async function handleReview(quality: number) {
    const card = cards[current];
    await submitReview(card.id, quality);
    setRevealed(false);
    if (current + 1 >= cards.length) {
      setDone(true);
    } else {
      setCurrent(c => c + 1);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 bg-white/8 rounded-input animate-pulse" />
          <div className="h-4 w-20 bg-white/8 rounded-input animate-pulse" />
        </div>
        <div className="h-1.5 bg-white/5 rounded-full" />
        <div className="glass-card p-8 min-h-[280px] flex flex-col justify-center items-center gap-4">
          {[0, 0.15, 0.3].map(d => (
            <motion.div key={d} className="w-2.5 h-2.5 rounded-full bg-accent"
              animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: d }} />
          ))}
          <p className="text-text-muted text-sm mt-2">Loading your recall cards...</p>
        </div>
      </div>
    );
  }
  if (done || cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="text-5xl">🎉</div>
        <h2 className="font-sans text-2xl font-bold text-text-primary">All done!</h2>
        <p className="text-text-secondary">No more cards due today. Come back tomorrow.</p>
      </div>
    );
  }

  const card = cards[current];
  if (!card) return null;
  const progress = ((current) / cards.length) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-sans text-xl font-bold text-text-primary">Daily Review</h1>
        <span className="text-text-secondary text-sm">{cards.length - current} remaining</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-accent rounded-full"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={card.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="glass-card p-8 min-h-[280px] flex flex-col justify-between"
        >
          <div className="flex-1">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-4">Question</p>
            <p className="text-text-primary text-lg leading-relaxed">{card.question}</p>
          </div>

          {revealed && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 pt-6 border-t border-border"
            >
              <p className="text-xs text-accent uppercase tracking-wider mb-3">Answer</p>
              <p className="text-text-secondary leading-relaxed">{card.answer}</p>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Actions */}
      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-input transition-colors"
        >
          Reveal Answer
        </button>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {QUALITY_BUTTONS.map(({ label, quality, color }) => (
            <button
              key={label}
              onClick={() => handleReview(quality)}
              className={`py-3 rounded-input border text-sm font-semibold transition-colors ${color}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
