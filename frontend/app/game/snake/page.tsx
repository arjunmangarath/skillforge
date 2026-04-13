"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Play, RotateCcw, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getQuizQuestion } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Game constants ──────────────────────────────────────────────────────────
const CELL = 20;
const COLS = 24;
const ROWS = 20;
const W = COLS * CELL;
const H = ROWS * CELL;
const BASE_SPEED = 140; // ms per tick

type Pt = { x: number; y: number };
type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT";

interface Question {
  topic: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

interface Score { name: string; score: number; date: string }

const LS_KEY = "skillforge_snake_scores";

function loadScores(): Score[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function saveScore(entry: Score) {
  const scores = [...loadScores(), entry].sort((a, b) => b.score - a.score).slice(0, 10);
  localStorage.setItem(LS_KEY, JSON.stringify(scores));
}

function randPt(snake: Pt[]): Pt {
  let pt: Pt;
  do { pt = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
  while (snake.some(s => s.x === pt.x && s.y === pt.y));
  return pt;
}

// ── Component ───────────────────────────────────────────────────────────────
export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    snake: [{ x: 12, y: 10 }, { x: 11, y: 10 }, { x: 10, y: 10 }] as Pt[],
    dir: "RIGHT" as Dir,
    nextDir: "RIGHT" as Dir,
    apple: { x: 18, y: 10 } as Pt,
    score: 0,
    grow: 0,
    running: false,
  });

  const [phase, setPhase] = useState<"idle" | "playing" | "question" | "gameover">("idle");
  const [score, setScore] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [loadingQ, setLoadingQ] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [scores, setScores] = useState<Score[]>([]);
  const [showScores, setShowScores] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const { snake, apple } = stateRef.current;

    ctx.fillStyle = "#0f0e17";
    ctx.fillRect(0, 0, W, H);

    // Grid dots
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    for (let x = 0; x < COLS; x++)
      for (let y = 0; y < ROWS; y++)
        ctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);

    // Apple
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(apple.x * CELL + CELL / 2, apple.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(apple.x * CELL + CELL / 2, apple.y * CELL + 2, 3, 5);

    // Snake
    snake.forEach((seg, i) => {
      const isHead = i === 0;
      const ratio = 1 - i / snake.length * 0.5;
      ctx.fillStyle = isHead ? "#6366f1" : `rgba(99,102,241,${ratio})`;
      const pad = isHead ? 1 : 2;
      ctx.beginPath();
      ctx.roundRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, isHead ? 4 : 3);
      ctx.fill();
    });
  }, []);

  // Tick
  const tick = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;

    s.dir = s.nextDir;
    const head = s.snake[0];
    const next: Pt = {
      x: (head.x + (s.dir === "RIGHT" ? 1 : s.dir === "LEFT" ? -1 : 0) + COLS) % COLS,
      y: (head.y + (s.dir === "DOWN" ? 1 : s.dir === "UP" ? -1 : 0) + ROWS) % ROWS,
    };

    // Self collision
    if (s.snake.some(seg => seg.x === next.x && seg.y === next.y)) {
      s.running = false;
      setPhase("gameover");
      return;
    }

    s.snake = [next, ...s.snake];
    if (s.grow > 0) {
      s.grow--;
    } else {
      s.snake.pop();
    }

    // Apple eaten
    if (next.x === s.apple.x && next.y === s.apple.y) {
      s.running = false;
      s.grow += 1;
      s.apple = randPt(s.snake);
      setPhase("question");
      setSelected(null);
      setAnswered(false);
      setLoadingQ(true);
      getQuizQuestion()
        .then(q => { setQuestion(q); setLoadingQ(false); })
        .catch(() => {
          setQuestion({
            topic: "Learning",
            question: "Which habit best supports long-term skill retention?",
            options: ["A. Spaced repetition", "B. Cramming once", "C. Passive reading", "D. Skipping review"],
            correct_index: 0,
            explanation: "Spaced repetition distributes practice over time, which is scientifically proven to improve long-term retention.",
          });
          setLoadingQ(false);
        });
    }

    draw();
    setScore(s.score);
  }, [draw]);

  // Start game
  const startGame = useCallback((name: string) => {
    const s = stateRef.current;
    s.snake = [{ x: 12, y: 10 }, { x: 11, y: 10 }, { x: 10, y: 10 }];
    s.dir = "RIGHT";
    s.nextDir = "RIGHT";
    s.apple = randPt(s.snake);
    s.score = 0;
    s.grow = 0;
    s.running = true;
    setScore(0);
    setPlayerName(name);
    setPhase("playing");
    draw();

    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(tick, BASE_SPEED);
  }, [draw, tick]);

  // Resume after question
  const resumeGame = useCallback(() => {
    stateRef.current.running = true;
    setPhase("playing");
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(tick, BASE_SPEED);
  }, [tick]);

  // Answer question
  function handleAnswer(idx: number) {
    if (answered || !question) return;
    setSelected(idx);
    setAnswered(true);
    const correct = idx === question.correct_index;
    if (correct) {
      stateRef.current.score += 10;
      stateRef.current.grow += 2; // bonus growth
      setScore(stateRef.current.score);
    }
  }

  function handleDone() {
    setQuestion(null);
    resumeGame();
  }

  // Game over — save score
  function handleGameOver() {
    const entry: Score = {
      name: playerName || "Anonymous",
      score: stateRef.current.score,
      date: new Date().toLocaleDateString(),
    };
    saveScore(entry);
    setScores(loadScores());
    setShowScores(true);
  }

  useEffect(() => {
    if (phase === "gameover") {
      if (tickRef.current) clearInterval(tickRef.current);
      handleGameOver();
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setScores(loadScores());
  }, []);

  // Keyboard
  useEffect(() => {
    const MAP: Record<string, Dir> = {
      ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT",
      w: "UP", s: "DOWN", a: "LEFT", d: "RIGHT",
    };
    const OPPOSITE: Record<Dir, Dir> = { UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT" };
    function onKey(e: KeyboardEvent) {
      const dir = MAP[e.key];
      if (!dir) return;
      e.preventDefault();
      const s = stateRef.current;
      if (dir !== OPPOSITE[s.dir]) s.nextDir = dir;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    draw();
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/game" className="text-text-muted hover:text-text-primary transition-colors"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="font-sans text-xl font-bold text-text-primary">Snake Quiz</h1>
          <p className="text-xs text-text-muted">Eat the apple → answer a question → grow smarter</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowScores(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-input border border-border text-text-secondary hover:text-accent hover:border-accent/40 text-sm transition-colors">
            <Trophy className="w-3.5 h-3.5" /> High Scores
          </button>
          <div className="glass-card px-4 py-2 text-sm font-mono font-bold text-accent">
            {score} pts
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Canvas */}
        <div className="relative flex-shrink-0">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="rounded-card border border-border block"
          />

          {/* Overlays */}
          <AnimatePresence>
            {phase === "idle" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/70 rounded-card backdrop-blur-sm">
                <div className="text-center">
                  <div className="text-5xl mb-2">🐍</div>
                  <h2 className="text-xl font-bold text-white mb-1">Snake Quiz</h2>
                  <p className="text-sm text-white/60">Each apple = 1 question from your learning path</p>
                </div>
                <div className="flex flex-col gap-2 w-48">
                  <input
                    value={nameDraft}
                    onChange={e => setNameDraft(e.target.value)}
                    placeholder="Your name"
                    className="px-3 py-2 rounded-input bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/40 outline-none text-center"
                    onKeyDown={e => e.key === "Enter" && nameDraft.trim() && startGame(nameDraft.trim())}
                  />
                  <button onClick={() => startGame(nameDraft.trim() || "Anonymous")}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-input font-semibold transition-colors">
                    <Play className="w-4 h-4" /> Start Game
                  </button>
                </div>
                <p className="text-xs text-white/40">Arrow keys or WASD to move</p>
              </motion.div>
            )}

            {phase === "gameover" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 rounded-card backdrop-blur-sm">
                <div className="text-5xl">💀</div>
                <h2 className="text-2xl font-bold text-white">Game Over</h2>
                <p className="text-accent text-3xl font-mono font-bold">{stateRef.current.score} pts</p>
                <button onClick={() => { setPhase("idle"); setShowScores(true); }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-input font-semibold transition-colors">
                  <RotateCcw className="w-4 h-4" /> Play Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Question panel / High scores */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {phase === "question" && (
              <motion.div key="question" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="glass-card p-5 space-y-4 h-full flex flex-col">
                {loadingQ ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    {[0, 0.15, 0.3].map(d => (
                      <motion.div key={d} className="w-2 h-2 rounded-full bg-accent"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: d }} />
                    ))}
                    <p className="text-xs text-text-muted">Loading question...</p>
                  </div>
                ) : question ? (
                  <>
                    <div>
                      <span className="text-xs text-accent uppercase tracking-wider">{question.topic}</span>
                      <p className="text-text-primary text-sm font-medium leading-relaxed mt-1">{question.question}</p>
                    </div>
                    <div className="space-y-2 flex-1">
                      {question.options.map((opt, i) => {
                        const isCorrect = i === question.correct_index;
                        const isSelected = i === selected;
                        return (
                          <button key={i} onClick={() => handleAnswer(i)} disabled={answered}
                            className={cn(
                              "w-full text-left px-3 py-2.5 rounded-input border text-sm transition-all",
                              !answered && "border-border hover:border-accent/40 hover:bg-accent/5 text-text-secondary",
                              answered && isCorrect && "border-green-500/50 bg-green-500/10 text-green-400",
                              answered && isSelected && !isCorrect && "border-red-500/50 bg-red-500/10 text-red-400",
                              answered && !isSelected && !isCorrect && "border-border/30 text-text-muted opacity-50",
                            )}>
                            <div className="flex items-center gap-2">
                              {answered && isCorrect && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />}
                              {answered && isSelected && !isCorrect && <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                              {opt}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {answered && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                        <div className={cn("text-xs px-3 py-2 rounded-input border",
                          selected === question.correct_index
                            ? "border-green-500/30 bg-green-500/10 text-green-300"
                            : "border-red-500/30 bg-red-500/10 text-red-300")}>
                          {selected === question.correct_index ? "✓ Correct! +10 pts" : "✗ Wrong — no points"}
                          <p className="text-white/70 mt-1 text-xs">{question.explanation}</p>
                        </div>
                        <button onClick={handleDone}
                          className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white rounded-input font-semibold text-sm transition-colors">
                          Done — Continue Game
                        </button>
                      </motion.div>
                    )}
                  </>
                ) : null}
              </motion.div>
            )}

            {(phase !== "question" || showScores) && (
              <motion.div key="scores" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="glass-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  <h3 className="font-semibold text-text-primary text-sm">High Scores</h3>
                </div>
                {scores.length === 0 ? (
                  <p className="text-text-muted text-xs text-center py-4">No scores yet — play your first game!</p>
                ) : (
                  <div className="space-y-1.5">
                    {scores.slice(0, 8).map((s, i) => (
                      <div key={i} className={cn("flex items-center justify-between px-3 py-2 rounded-input text-sm",
                        i === 0 ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-white/3")}>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs font-mono w-5", i === 0 ? "text-yellow-400" : "text-text-muted")}>
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                          </span>
                          <span className="text-text-primary font-medium">{s.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-accent font-mono font-bold">{s.score}</span>
                          <span className="text-text-muted text-xs ml-1">pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Controls hint */}
      {phase === "playing" && (
        <p className="text-center text-xs text-text-muted">
          ↑ ↓ ← → or WASD to move · Eat the red apple · Answer correctly for +10 pts & bonus growth
        </p>
      )}
    </div>
  );
}
