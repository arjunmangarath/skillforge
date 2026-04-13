"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Play, RotateCcw, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getQuizQuestion } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────
const COLS = 10, ROWS = 20, CELL = 28;
const W = COLS * CELL, H = ROWS * CELL;
const LS_KEY = "skillforge_tetris_scores";

const PIECES = [
  { shape: [[1,1,1,1]], color: "#06b6d4" },           // I
  { shape: [[1,1],[1,1]], color: "#eab308" },          // O
  { shape: [[0,1,0],[1,1,1]], color: "#a855f7" },      // T
  { shape: [[0,1,1],[1,1,0]], color: "#22c55e" },      // S
  { shape: [[1,1,0],[0,1,1]], color: "#ef4444" },      // Z
  { shape: [[1,0,0],[1,1,1]], color: "#3b82f6" },      // J
  { shape: [[0,0,1],[1,1,1]], color: "#f97316" },      // L
];

type Board = (string | null)[][];
type Piece = { shape: number[][]; color: string; x: number; y: number };
interface Question { topic: string; question: string; options: string[]; correct_index: number; explanation: string }
interface Score { name: string; score: number; lines: number; date: string }

function emptyBoard(): Board { return Array.from({ length: ROWS }, () => Array(COLS).fill(null)); }
function rotate(m: number[][]): number[][] {
  return Array.from({ length: m[0].length }, (_, c) => Array.from({ length: m.length }, (_, r) => m[m.length - 1 - r][c]));
}
function randPiece(): Piece {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  return { shape: p.shape, color: p.color, x: Math.floor(COLS / 2) - Math.floor(p.shape[0].length / 2), y: 0 };
}
function canPlace(board: Board, piece: Piece, dx = 0, dy = 0, shape = piece.shape): boolean {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        const nx = piece.x + c + dx, ny = piece.y + r + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
        if (ny >= 0 && board[ny][nx]) return false;
      }
  return true;
}
function placePiece(board: Board, piece: Piece): Board {
  const b = board.map(r => [...r]);
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c] && piece.y + r >= 0) b[piece.y + r][piece.x + c] = piece.color;
  return b;
}
function clearLines(board: Board): { board: Board; cleared: number } {
  const kept = board.filter(row => row.some(c => !c));
  const cleared = ROWS - kept.length;
  const newRows = Array.from({ length: cleared }, () => Array(COLS).fill(null));
  return { board: [...newRows, ...kept], cleared };
}
function lineScore(n: number) { return [0, 100, 300, 500, 800][n] ?? 800; }
function loadScores(): Score[] { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; } }
function saveScore(e: Score) {
  const s = [...loadScores(), e].sort((a, b) => b.score - a.score).slice(0, 10);
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

export default function TetrisPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<Board>(emptyBoard());
  const pieceRef = useRef<Piece>(randPiece());
  const nextPieceRef = useRef<Piece>(randPiece());
  const scoreRef = useRef(0);
  const linesRef = useRef(0);
  const runningRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<"idle" | "playing" | "question" | "gameover">("idle");
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [loadingQ, setLoadingQ] = useState(false);
  const [pendingScore, setPendingScore] = useState(0);
  const [nameDraft, setNameDraft] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [scores, setScores] = useState<Score[]>([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, W, H);
    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke(); }
    for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke(); }
    // Board
    boardRef.current.forEach((row, r) => row.forEach((col, c) => {
      if (col) {
        ctx.fillStyle = col;
        ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, 4);
      }
    }));
    // Ghost piece
    const p = pieceRef.current;
    let ghostY = 0;
    while (canPlace(boardRef.current, p, 0, ghostY + 1)) ghostY++;
    if (ghostY > 0) {
      p.shape.forEach((row, r) => row.forEach((v, c) => {
        if (v) {
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect((p.x + c) * CELL + 1, (p.y + r + ghostY) * CELL + 1, CELL - 2, CELL - 2);
        }
      }));
    }
    // Current piece
    p.shape.forEach((row, r) => row.forEach((v, c) => {
      if (v && p.y + r >= 0) {
        ctx.fillStyle = p.color;
        ctx.fillRect((p.x + c) * CELL + 1, (p.y + r) * CELL + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect((p.x + c) * CELL + 1, (p.y + r) * CELL + 1, CELL - 2, 4);
      }
    }));
  }, []);

  const drawNext = useCallback(() => {
    const canvas = nextRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const np = nextPieceRef.current;
    const cs = 24;
    canvas.width = np.shape[0].length * cs + 8;
    canvas.height = np.shape.length * cs + 8;
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    np.shape.forEach((row, r) => row.forEach((v, c) => {
      if (v) {
        ctx.fillStyle = np.color;
        ctx.fillRect(c * cs + 4, r * cs + 4, cs - 2, cs - 2);
      }
    }));
  }, []);

  const lockPiece = useCallback(() => {
    boardRef.current = placePiece(boardRef.current, pieceRef.current);
    const { board, cleared } = clearLines(boardRef.current);
    boardRef.current = board;

    if (cleared > 0) {
      runningRef.current = false;
      if (tickRef.current) clearInterval(tickRef.current);
      linesRef.current += cleared;
      const pts = lineScore(cleared);
      setPendingScore(pts);
      setLines(linesRef.current);
      setPhase("question");
      setSelected(null);
      setAnswered(false);
      setLoadingQ(true);
      getQuizQuestion()
        .then(q => { setQuestion(q); setLoadingQ(false); })
        .catch(() => {
          setQuestion({ topic: "Learning", question: "Spaced repetition works best when?", options: ["A. Reviews spread over time", "B. Cramming before exam", "C. Reading once", "D. No breaks"], correct_index: 0, explanation: "Distributed practice leads to stronger long-term memory." });
          setLoadingQ(false);
        });
    } else {
      pieceRef.current = nextPieceRef.current;
      nextPieceRef.current = randPiece();
      drawNext();
      if (!canPlace(boardRef.current, pieceRef.current)) {
        runningRef.current = false;
        setPhase("gameover");
      }
    }
  }, [drawNext]);

  const tick = useCallback(() => {
    if (!runningRef.current) return;
    if (canPlace(boardRef.current, pieceRef.current, 0, 1)) {
      pieceRef.current = { ...pieceRef.current, y: pieceRef.current.y + 1 };
    } else {
      lockPiece();
    }
    draw();
  }, [draw, lockPiece]);

  const startGame = useCallback((name: string) => {
    boardRef.current = emptyBoard();
    pieceRef.current = randPiece();
    nextPieceRef.current = randPiece();
    scoreRef.current = 0;
    linesRef.current = 0;
    runningRef.current = true;
    setScore(0); setLines(0); setPlayerName(name); setPhase("playing");
    drawNext();
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(tick, 500);
  }, [drawNext, tick]);

  function handleAnswer(idx: number) {
    if (answered || !question) return;
    setSelected(idx);
    setAnswered(true);
    const correct = idx === question.correct_index;
    const pts = correct ? pendingScore * 2 : pendingScore;
    scoreRef.current += pts;
    setScore(scoreRef.current);
  }

  function handleDone() {
    pieceRef.current = nextPieceRef.current;
    nextPieceRef.current = randPiece();
    drawNext();
    if (!canPlace(boardRef.current, pieceRef.current)) { setPhase("gameover"); return; }
    runningRef.current = true;
    setPhase("playing");
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(tick, Math.max(100, 500 - Math.floor(linesRef.current / 10) * 40));
  }

  useEffect(() => {
    if (phase === "gameover") {
      if (tickRef.current) clearInterval(tickRef.current);
      const entry = { name: playerName || "Anonymous", score: scoreRef.current, lines: linesRef.current, date: new Date().toLocaleDateString() };
      saveScore(entry);
      setScores(loadScores());
    }
  }, [phase, playerName]);

  useEffect(() => {
    setScores(loadScores());
    draw();
    drawNext();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "playing") return;
    function onKey(e: KeyboardEvent) {
      if (!runningRef.current) return;
      const p = pieceRef.current;
      if (e.key === "ArrowLeft" && canPlace(boardRef.current, p, -1, 0)) {
        pieceRef.current = { ...p, x: p.x - 1 }; draw();
      } else if (e.key === "ArrowRight" && canPlace(boardRef.current, p, 1, 0)) {
        pieceRef.current = { ...p, x: p.x + 1 }; draw();
      } else if (e.key === "ArrowDown") {
        if (canPlace(boardRef.current, p, 0, 1)) { pieceRef.current = { ...p, y: p.y + 1 }; draw(); }
        else lockPiece();
      } else if (e.key === "ArrowUp") {
        const rotated = rotate(p.shape);
        if (canPlace(boardRef.current, { ...p, shape: rotated })) { pieceRef.current = { ...p, shape: rotated }; draw(); }
      } else if (e.key === " ") {
        e.preventDefault();
        let drop = 0;
        while (canPlace(boardRef.current, p, 0, drop + 1)) drop++;
        pieceRef.current = { ...p, y: p.y + drop };
        lockPiece();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, draw, lockPiece]);

  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/game" className="text-text-muted hover:text-text-primary transition-colors"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="font-sans text-xl font-bold text-text-primary">Tetris Quiz</h1>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-xs text-text-muted">Lines: <span className="text-accent font-mono">{lines}</span></div>
          <div className="glass-card px-4 py-1.5 text-sm font-mono font-bold text-cyan-400">{score} pts</div>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-shrink-0">
          <canvas ref={canvasRef} width={W} height={H} className="rounded-card border border-border block" />
          <AnimatePresence>
            {phase === "idle" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/75 rounded-card backdrop-blur-sm">
                <div className="text-center"><div className="text-5xl mb-2">🧱</div>
                  <h2 className="text-xl font-bold text-white mb-1">Tetris Quiz</h2>
                  <p className="text-xs text-white/60">Clear lines → answer question → double points if correct</p></div>
                <div className="flex flex-col gap-2 w-44">
                  <input value={nameDraft} onChange={e => setNameDraft(e.target.value)} placeholder="Your name"
                    className="px-3 py-2 rounded-input bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/40 outline-none text-center"
                    onKeyDown={e => e.key === "Enter" && startGame(nameDraft.trim() || "Anonymous")} />
                  <button onClick={() => startGame(nameDraft.trim() || "Anonymous")}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-white rounded-input font-semibold transition-colors">
                    <Play className="w-4 h-4" /> Start
                  </button>
                </div>
                <p className="text-xs text-white/40">← → move · ↑ rotate · ↓ soft drop · Space hard drop</p>
              </motion.div>
            )}
            {phase === "gameover" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 rounded-card backdrop-blur-sm">
                <div className="text-5xl">💥</div>
                <h2 className="text-2xl font-bold text-white">Game Over</h2>
                <p className="text-cyan-400 text-3xl font-mono font-bold">{scoreRef.current} pts</p>
                <p className="text-white/60 text-sm">{linesRef.current} lines cleared</p>
                <button onClick={() => setPhase("idle")}
                  className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-white rounded-input font-semibold transition-colors">
                  <RotateCcw className="w-4 h-4" /> Play Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 space-y-3">
          {/* Next piece */}
          <div className="glass-card p-3">
            <p className="text-xs text-text-muted mb-2">Next</p>
            <canvas ref={nextRef} className="block" />
          </div>

          {/* Question or scores */}
          <AnimatePresence mode="wait">
            {phase === "question" ? (
              <motion.div key="q" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="glass-card p-4 space-y-3">
                <div className="text-xs text-cyan-400 font-medium uppercase tracking-wider">
                  🧱 {answered ? (selected === question?.correct_index ? `+${pendingScore * 2} pts (2×!)` : `+${pendingScore} pts`) : `Line clear! +${pendingScore} pts base`}
                </div>
                {loadingQ ? (
                  <div className="flex items-center gap-2 py-2">
                    {[0,0.15,0.3].map(d => <motion.div key={d} className="w-1.5 h-1.5 rounded-full bg-cyan-400" animate={{ opacity: [0.3,1,0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d }} />)}
                    <span className="text-xs text-text-muted">Loading question...</span>
                  </div>
                ) : question && (
                  <>
                    <p className="text-text-primary text-sm leading-relaxed">{question.question}</p>
                    <div className="space-y-1.5">
                      {question.options.map((opt, i) => {
                        const isCorrect = i === question.correct_index;
                        const isSelected = i === selected;
                        return (
                          <button key={i} onClick={() => handleAnswer(i)} disabled={answered}
                            className={cn("w-full text-left px-3 py-2 rounded-input border text-xs transition-all",
                              !answered && "border-border hover:border-cyan-500/40 hover:bg-cyan-500/5 text-text-secondary",
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
                        <p className="text-xs text-white/60 border border-white/10 rounded-input px-2 py-1.5">{question.explanation}</p>
                        <button onClick={handleDone} className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-input text-sm font-semibold transition-colors">
                          Continue →
                        </button>
                      </motion.div>
                    )}
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div key="scores" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass-card p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1"><Trophy className="w-3.5 h-3.5 text-yellow-400" /><span className="text-sm font-semibold text-text-primary">High Scores</span></div>
                {scores.length === 0 ? <p className="text-text-muted text-xs text-center py-3">No scores yet!</p> : scores.slice(0, 6).map((s, i) => (
                  <div key={i} className={cn("flex justify-between items-center px-2 py-1.5 rounded text-xs", i === 0 ? "bg-yellow-500/10" : "")}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-text-muted w-4">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}</span>
                      <span className="text-text-primary">{s.name}</span>
                    </div>
                    <span className="text-cyan-400 font-mono font-bold">{s.score}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
