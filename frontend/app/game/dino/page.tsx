"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Play, RotateCcw, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getQuizQuestion } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────
const CW = 700, CH = 200;
const GROUND = 155;
const DINO_W = 44, DINO_H = 52;
const DINO_X = 80;
const GRAVITY = 0.6;
const JUMP_V = -13;
const LS_KEY = "skillforge_dino_scores";

interface Question { topic: string; question: string; options: string[]; correct_index: number; explanation: string }
interface Score { name: string; score: number; date: string }

function loadScores(): Score[] { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; } }
function saveScore(e: Score) {
  const s = [...loadScores(), e].sort((a, b) => b.score - a.score).slice(0, 10);
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

// Cloud positions
const CLOUDS = [{ x: 100, y: 30 }, { x: 300, y: 50 }, { x: 500, y: 25 }, { x: 620, y: 45 }];

export default function DinoPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number>(0);

  const gs = useRef({
    dino: { y: GROUND - DINO_H, vy: 0, onGround: true },
    obstacles: [] as { x: number; w: number; h: number; passed: boolean }[],
    clouds: CLOUDS.map(c => ({ ...c })),
    score: 0,
    speed: 5,
    frame: 0,
    nextObs: 80,
    cleared: 0,
    running: false,
    legPhase: 0,
  });

  const [phase, setPhase] = useState<"idle" | "playing" | "question" | "gameover">("idle");
  const [score, setScore] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [loadingQ, setLoadingQ] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [scores, setScores] = useState<Score[]>([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const g = gs.current;

    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, CW, CH);

    // Clouds
    g.clouds.forEach(c => {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath(); ctx.ellipse(c.x, c.y, 40, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(c.x + 20, c.y - 8, 25, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(c.x - 15, c.y - 5, 20, 10, 0, 0, Math.PI * 2); ctx.fill();
    });

    // Ground
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(0, GROUND, CW, 2);
    // Ground dots
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let x = (g.frame * g.speed) % 30; x < CW; x += 30)
      ctx.fillRect(x, GROUND + 6, 15, 2);

    // Obstacles (cacti)
    g.obstacles.forEach(obs => {
      // Main body
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(obs.x + obs.w / 2 - 8, GROUND - obs.h, 16, obs.h);
      // Arms
      if (obs.h > 40) {
        ctx.fillRect(obs.x, GROUND - obs.h * 0.6, obs.w, 12);
        ctx.fillRect(obs.x, GROUND - obs.h * 0.6 - 16, 12, 16);
        ctx.fillRect(obs.x + obs.w - 12, GROUND - obs.h * 0.6 - 16, 12, 16);
      }
      // Spikes
      ctx.fillStyle = "#16a34a";
      ctx.fillRect(obs.x + obs.w / 2 - 4, GROUND - obs.h - 6, 8, 8);
    });

    // Dino
    const dy = g.dino.y;
    const leg = g.dino.onGround ? Math.sin(g.legPhase) : 0;

    // Body
    ctx.fillStyle = "#6366f1";
    ctx.beginPath();
    ctx.roundRect(DINO_X, dy, DINO_W, DINO_H - 10, 8);
    ctx.fill();
    // Head
    ctx.fillStyle = "#818cf8";
    ctx.beginPath();
    ctx.roundRect(DINO_X + 10, dy - 18, 30, 24, 6);
    ctx.fill();
    // Eye
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(DINO_X + 30, dy - 10, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1e1b4b";
    ctx.beginPath(); ctx.arc(DINO_X + 32, dy - 9, 2.5, 0, Math.PI * 2); ctx.fill();
    // Legs
    ctx.fillStyle = "#4f46e5";
    ctx.fillRect(DINO_X + 8, dy + DINO_H - 12, 12, 8 + leg * 4);
    ctx.fillRect(DINO_X + 24, dy + DINO_H - 12, 12, 8 - leg * 4);
    // Tail
    ctx.fillStyle = "#6366f1";
    ctx.beginPath();
    ctx.moveTo(DINO_X, dy + 10);
    ctx.lineTo(DINO_X - 20, dy + 20);
    ctx.lineTo(DINO_X, dy + 28);
    ctx.fill();

    // Score
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "bold 14px monospace";
    ctx.fillText(`${Math.floor(g.score)}`, CW - 70, 25);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "10px monospace";
    ctx.fillText("SCORE", CW - 70, 14);
  }, []);

  const triggerQuestion = useCallback(() => {
    gs.current.running = false;
    cancelAnimationFrame(raf.current);
    setPhase("question");
    setSelected(null);
    setAnswered(false);
    setLoadingQ(true);
    getQuizQuestion()
      .then(q => { setQuestion(q); setLoadingQ(false); })
      .catch(() => {
        setQuestion({ topic: "Learning", question: "Which technique improves focus during study sessions?", options: ["A. Pomodoro technique", "B. Multitasking", "C. Phone nearby", "D. Background TV"], correct_index: 0, explanation: "The Pomodoro technique uses timed intervals to maintain focus and prevent burnout." });
        setLoadingQ(false);
      });
  }, []);

  const gameLoop = useCallback(() => {
    const g = gs.current;
    if (!g.running) return;

    g.frame++;
    g.legPhase += 0.3;
    g.score += g.speed * 0.04;
    g.speed = 5 + Math.floor(g.score / 200) * 0.5;

    // Move clouds
    g.clouds.forEach(c => { c.x -= 0.5; if (c.x < -60) c.x = CW + 60; });

    // Spawn obstacles
    g.nextObs--;
    if (g.nextObs <= 0) {
      const h = 35 + Math.random() * 40;
      const w = 30 + Math.random() * 20;
      g.obstacles.push({ x: CW + 10, w, h, passed: false });
      g.nextObs = 80 + Math.floor(Math.random() * 60) - Math.floor(g.score / 300) * 5;
      g.nextObs = Math.max(50, g.nextObs);
    }

    // Move + check obstacles
    g.obstacles = g.obstacles.filter(obs => obs.x + obs.w > -10);
    for (const obs of g.obstacles) {
      obs.x -= g.speed;
      // Check if passed
      if (!obs.passed && obs.x + obs.w < DINO_X) {
        obs.passed = true;
        g.cleared++;
        setScore(Math.floor(g.score));
        triggerQuestion();
        return;
      }
      // Collision
      const dinoRight = DINO_X + DINO_W - 8;
      const dinoBottom = g.dino.y + DINO_H - 6;
      const obsTop = GROUND - obs.h;
      if (dinoRight > obs.x + 4 && DINO_X + 8 < obs.x + obs.w - 4 && dinoBottom > obsTop + 4 && g.dino.y + 6 < GROUND) {
        g.running = false;
        setPhase("gameover");
        return;
      }
    }

    // Dino physics
    if (!g.dino.onGround) {
      g.dino.vy += GRAVITY;
      g.dino.y += g.dino.vy;
      if (g.dino.y >= GROUND - DINO_H) {
        g.dino.y = GROUND - DINO_H;
        g.dino.vy = 0;
        g.dino.onGround = true;
      }
    }

    setScore(Math.floor(g.score));
    draw();
    raf.current = requestAnimationFrame(gameLoop);
  }, [draw, triggerQuestion]);

  const startGame = useCallback((name: string) => {
    const g = gs.current;
    g.dino = { y: GROUND - DINO_H, vy: 0, onGround: true };
    g.obstacles = [];
    g.clouds = CLOUDS.map(c => ({ ...c }));
    g.score = 0; g.speed = 5; g.frame = 0; g.nextObs = 80; g.cleared = 0; g.legPhase = 0;
    g.running = true;
    setScore(0); setPlayerName(name); setPhase("playing");
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  function jump() {
    const g = gs.current;
    if (g.dino.onGround && g.running) {
      g.dino.vy = JUMP_V;
      g.dino.onGround = false;
    }
  }

  function handleAnswer(idx: number) {
    if (answered || !question) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === question.correct_index) {
      gs.current.score += 50;
      setScore(Math.floor(gs.current.score));
    }
  }

  function handleDone() {
    gs.current.running = true;
    setPhase("playing");
    raf.current = requestAnimationFrame(gameLoop);
  }

  useEffect(() => {
    if (phase === "gameover") {
      cancelAnimationFrame(raf.current);
      const entry = { name: playerName || "Anonymous", score: Math.floor(gs.current.score), date: new Date().toLocaleDateString() };
      saveScore(entry);
      setScores(loadScores());
    }
  }, [phase, playerName]);

  useEffect(() => {
    setScores(loadScores());
    draw();
    return () => cancelAnimationFrame(raf.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "playing") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "ArrowUp") { e.preventDefault(); jump(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/game" className="text-text-muted hover:text-text-primary transition-colors"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="font-sans text-xl font-bold text-text-primary">Dino Runner Quiz</h1>
        <div className="ml-auto flex items-center gap-3">
          <div className="glass-card px-4 py-1.5 text-sm font-mono font-bold text-green-400">{score} pts</div>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas ref={canvasRef} width={CW} height={CH}
          className="rounded-card border border-border block w-full cursor-pointer"
          onClick={jump} />

        <AnimatePresence>
          {phase === "idle" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/75 rounded-card backdrop-blur-sm">
              <div className="text-center"><div className="text-5xl mb-2">🦕</div>
                <h2 className="text-xl font-bold text-white mb-1">Dino Runner Quiz</h2>
                <p className="text-xs text-white/60">Jump over cacti → answer question → +50 bonus pts if correct</p>
              </div>
              <div className="flex flex-col gap-2 w-44">
                <input value={nameDraft} onChange={e => setNameDraft(e.target.value)} placeholder="Your name"
                  className="px-3 py-2 rounded-input bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/40 outline-none text-center"
                  onKeyDown={e => e.key === "Enter" && startGame(nameDraft.trim() || "Anonymous")} />
                <button onClick={() => startGame(nameDraft.trim() || "Anonymous")}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-400 text-white rounded-input font-semibold transition-colors">
                  <Play className="w-4 h-4" /> Start
                </button>
              </div>
              <p className="text-xs text-white/40">Space / ↑ / Click to jump</p>
            </motion.div>
          )}
          {phase === "gameover" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 rounded-card backdrop-blur-sm">
              <div className="text-5xl">🌵</div>
              <h2 className="text-2xl font-bold text-white">Ouch!</h2>
              <p className="text-green-400 text-3xl font-mono font-bold">{Math.floor(gs.current.score)} pts</p>
              <button onClick={() => setPhase("idle")}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-400 text-white rounded-input font-semibold transition-colors">
                <RotateCcw className="w-4 h-4" /> Play Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Question / Scores */}
      <div className="flex gap-4">
        <AnimatePresence mode="wait">
          {phase === "question" && (
            <motion.div key="q" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="glass-card p-5 flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌵</span>
                <div>
                  <p className="text-xs text-green-400 font-medium uppercase tracking-wider">Obstacle cleared!</p>
                  <p className="text-xs text-text-muted">Answer correctly for +50 bonus pts</p>
                </div>
              </div>
              {loadingQ ? (
                <div className="flex items-center gap-2 py-2">
                  {[0,0.15,0.3].map(d => <motion.div key={d} className="w-1.5 h-1.5 rounded-full bg-green-400" animate={{ opacity:[0.3,1,0.3] }} transition={{ duration:1, repeat:Infinity, delay:d }} />)}
                  <span className="text-xs text-text-muted">Loading question...</span>
                </div>
              ) : question && (
                <>
                  <p className="text-text-primary text-sm font-medium leading-relaxed">{question.question}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {question.options.map((opt, i) => {
                      const isCorrect = i === question.correct_index;
                      const isSelected = i === selected;
                      return (
                        <button key={i} onClick={() => handleAnswer(i)} disabled={answered}
                          className={cn("text-left px-3 py-2.5 rounded-input border text-xs transition-all",
                            !answered && "border-border hover:border-green-500/40 hover:bg-green-500/5 text-text-secondary",
                            answered && isCorrect && "border-green-500/50 bg-green-500/10 text-green-400",
                            answered && isSelected && !isCorrect && "border-red-500/50 bg-red-500/10 text-red-400",
                            answered && !isSelected && !isCorrect && "border-border/30 text-text-muted opacity-40",
                          )}>
                          <div className="flex items-center gap-1.5">
                            {answered && isCorrect && <CheckCircle2 className="w-3 h-3 flex-shrink-0" />}
                            {answered && isSelected && !isCorrect && <XCircle className="w-3 h-3 flex-shrink-0" />}
                            {opt}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {answered && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                      <p className={cn("text-xs px-3 py-2 rounded-input border", selected === question.correct_index ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-red-500/30 bg-red-500/10 text-red-300")}>
                        {selected === question.correct_index ? "✓ Correct! +50 pts" : "✗ Wrong — no bonus"}<br />
                        <span className="text-white/60">{question.explanation}</span>
                      </p>
                      <button onClick={handleDone} className="w-full py-2.5 bg-green-500 hover:bg-green-400 text-white rounded-input text-sm font-semibold transition-colors">
                        Keep Running →
                      </button>
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn("glass-card p-4 space-y-2", phase === "question" ? "w-56 flex-shrink-0" : "flex-1")}>
          <div className="flex items-center gap-2 mb-1"><Trophy className="w-3.5 h-3.5 text-yellow-400" /><span className="text-sm font-semibold text-text-primary">High Scores</span></div>
          {scores.length === 0 ? <p className="text-text-muted text-xs text-center py-3">No scores yet!</p> : scores.slice(0, 6).map((s, i) => (
            <div key={i} className={cn("flex justify-between items-center px-2 py-1.5 rounded text-xs", i === 0 ? "bg-yellow-500/10" : "")}>
              <div className="flex items-center gap-1.5">
                <span className="text-text-muted w-5">{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</span>
                <span className="text-text-primary truncate max-w-[80px]">{s.name}</span>
              </div>
              <span className="text-green-400 font-mono font-bold">{s.score}</span>
            </div>
          ))}
        </div>
      </div>

      {phase === "playing" && (
        <p className="text-center text-xs text-text-muted">Space / ↑ / Click to jump · Answer questions to earn bonus points</p>
      )}
    </div>
  );
}
