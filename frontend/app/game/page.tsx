"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Trophy, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getGoals } from "@/lib/api";

const GAMES = [
  {
    href: "/game/snake",
    emoji: "🐍",
    title: "Snake Quiz",
    description: "Eat apples, answer MCQs, grow longer. Wrong answer? No points — but no lives lost.",
    color: "from-indigo-500/20 to-purple-500/10",
    border: "border-indigo-500/30",
    accent: "text-indigo-400",
  },
  {
    href: "/game/tetris",
    emoji: "🧱",
    title: "Tetris Quiz",
    description: "Clear lines to trigger quiz questions. Answer correctly for double line points.",
    color: "from-cyan-500/20 to-blue-500/10",
    border: "border-cyan-500/30",
    accent: "text-cyan-400",
  },
  {
    href: "/game/dino",
    emoji: "🦕",
    title: "Dino Runner Quiz",
    description: "Jump over obstacles — each one cleared pauses for a question. Correct = bonus score.",
    color: "from-green-500/20 to-emerald-500/10",
    border: "border-green-500/30",
    accent: "text-green-400",
  },
];

const LS_KEYS = { snake: "skillforge_snake_scores", tetris: "skillforge_tetris_scores", dino: "skillforge_dino_scores" };

export default function GamesPage() {
  const router = useRouter();
  const [topScores, setTopScores] = useState<Record<string, { name: string; score: number } | null>>({});
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getGoals()
      .then((r: any) => {
        if (!r.goals?.length) router.replace("/dashboard");
        else setChecking(false);
      })
      .catch(() => router.replace("/dashboard"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const result: Record<string, { name: string; score: number } | null> = {};
    for (const [key, lsKey] of Object.entries(LS_KEYS)) {
      try {
        const arr = JSON.parse(localStorage.getItem(lsKey) || "[]");
        result[key] = arr[0] ?? null;
      } catch { result[key] = null; }
    }
    setTopScores(result);
  }, []);

  if (checking) return null;

  const topKeys = ["snake", "tetris", "dino"];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-sans text-2xl font-bold text-text-primary">Games</h1>
        <p className="text-text-muted text-sm mt-1">Learn while you play — every game is powered by your curriculum</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {GAMES.map((game, i) => (
          <motion.div key={game.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Link href={game.href} className={`block glass-card p-6 border ${game.border} bg-gradient-to-br ${game.color} hover:scale-[1.02] transition-all group`}>
              <div className="text-5xl mb-4">{game.emoji}</div>
              <h2 className={`font-sans font-bold text-lg mb-1 ${game.accent}`}>{game.title}</h2>
              <p className="text-text-muted text-xs leading-relaxed mb-4">{game.description}</p>
              {topScores[topKeys[i]] && (
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <Trophy className="w-3 h-3 text-yellow-400" />
                  <span className="text-yellow-400 font-medium">{topScores[topKeys[i]]!.name}</span>
                  <span>— {topScores[topKeys[i]]!.score} pts</span>
                </div>
              )}
              <div className={`mt-3 text-xs font-semibold ${game.accent} group-hover:underline`}>Play →</div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
