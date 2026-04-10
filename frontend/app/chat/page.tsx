"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Sparkles, MessageSquare, Mic } from "lucide-react";
import Link from "next/link";
import { sendChat, getGoals } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  agents?: string[];
}

const SUGGESTED_PROMPTS = [
  "Quiz me on my current week's topics",
  "Explain the first concept in my path",
  "Give me a practice question",
  "Test me on what I've studied so far",
  "What should I focus on today?",
];

const EXAMPLE_HINTS = [
  { icon: "🧠", text: "Quiz me on Week 1" },
  { icon: "📖", text: "Explain simplification tricks for bank exams" },
  { icon: "✏️", text: "Give me 3 MCQs on reasoning" },
  { icon: "✅", text: "I think the answer is B — am I right?" },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm your SKILLFORGE AI tutor. I know your learning curriculum — ask me to quiz you, explain a concept, or test your knowledge on any topic from your path.",
      agents: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeGoal, setActiveGoal] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    getGoals()
      .then((r: any) => {
        if (r.goals?.length > 0) setActiveGoal((r.goals[0] as any).title);
      })
      .catch(() => {});
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages
        .filter(m => m.id !== "welcome")
        .map(m => ({ role: m.role, content: m.content }));
      const res = await sendChat(input, history);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.message,
        agents: res.agents_invoked,
      };
      setMessages(m => [...m, assistantMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sorry, I hit an error. Please try again.";
      const isRateLimit = msg.includes("429") || msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("resource_exhausted");
      const isTimeout = msg.includes("aborted") || msg.includes("timeout");
      setMessages(m => [...m, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: isRateLimit
          ? "I'm being rate-limited by the AI backend. Please wait a few seconds and try again."
          : isTimeout
          ? "The request timed out. The AI may still be processing — please try again in a moment."
          : `Sorry, something went wrong: ${msg.slice(0, 100)}`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleSuggest(prompt: string) {
    setInput(prompt);
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-5rem)]">
      {/* Section header + sub-tabs */}
      <div className="mb-4">
        <h1 className="font-sans text-xl font-bold text-text-primary mb-3">Practice with AI</h1>
        <div className="flex gap-1 p-1 bg-white/5 rounded-input w-fit border border-border">
          <Link href="/chat"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium bg-accent/20 text-accent border border-accent/30 transition-colors">
            <MessageSquare className="w-3.5 h-3.5" /> Chat
          </Link>
          <Link href="/voice"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors">
            <Mic className="w-3.5 h-3.5" /> Voice
          </Link>
        </div>
      </div>

      {/* Chat header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border mb-4">
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
          <Bot className="w-4 h-4 text-accent" />
        </div>
        <div className="flex-1">
          <h1 className="font-sans font-bold text-text-primary">SKILLFORGE AI Tutor</h1>
          {activeGoal ? (
            <p className="text-xs text-text-muted">
              Practicing: <span className="text-accent">{activeGoal}</span>
            </p>
          ) : (
            <p className="text-xs text-text-muted">No active goal — create one on the dashboard</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-text-muted">Live</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}
            >
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                msg.role === "assistant" ? "bg-accent/20" : "bg-secondary/20"
              )}>
                {msg.role === "assistant"
                  ? <Bot className="w-3.5 h-3.5 text-accent" />
                  : <User className="w-3.5 h-3.5 text-secondary" />}
              </div>
              <div className={cn("max-w-[80%] space-y-1", msg.role === "user" && "items-end")}>
                <div className={cn(
                  "px-4 py-3 rounded-card text-sm leading-relaxed",
                  msg.role === "assistant"
                    ? "glass-card text-text-primary"
                    : "bg-secondary/20 border border-secondary/20 text-text-primary"
                )}>
                  {msg.role === "assistant" ? (
                    <div className="space-y-1.5">
                      {msg.content.split("\n").filter(l => l !== "").map((line, i) => {
                        const numbered = line.match(/^(\d+)\.\s+(.*)/);
                        const bullet = line.match(/^[-•]\s+(.*)/);
                        function renderInline(text: string) {
                          return text.split(/\*\*(.*?)\*\*/g).map((p, j) =>
                            j % 2 === 1
                              ? <strong key={j} className="text-text-primary font-semibold">{p}</strong>
                              : <span key={j}>{p}</span>
                          );
                        }
                        if (numbered) return (
                          <div key={i} className="flex gap-2">
                            <span className="text-accent font-bold flex-shrink-0">{numbered[1]}.</span>
                            <span>{renderInline(numbered[2])}</span>
                          </div>
                        );
                        if (bullet) return (
                          <div key={i} className="flex gap-2">
                            <span className="text-accent flex-shrink-0">•</span>
                            <span>{renderInline(bullet[1])}</span>
                          </div>
                        );
                        return <p key={i}>{renderInline(line)}</p>;
                      })}
                    </div>
                  ) : msg.content}
                </div>
                {msg.agents && msg.agents.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {msg.agents.map(a => (
                      <span key={a} className="text-xs px-2 py-0.5 rounded-pill bg-accent/10 text-accent border border-accent/20">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-accent" />
              </div>
              <div className="glass-card px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  {[0, 0.15, 0.3].map(d => (
                    <motion.div key={d} className="w-1.5 h-1.5 rounded-full bg-accent"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: d }} />
                  ))}
                </div>
                <span className="text-xs text-text-muted">Thinking...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts + example hints — shown only when no conversation yet */}
      {messages.length === 1 && !loading && (
        <div className="py-3 space-y-4">
          {/* Example hints (faded) */}
          <div className="grid grid-cols-2 gap-2">
            {EXAMPLE_HINTS.map(h => (
              <button
                key={h.text}
                onClick={() => handleSuggest(h.text)}
                className="flex items-start gap-2 px-3 py-2.5 rounded-input border border-border/40 text-left opacity-50 hover:opacity-80 hover:border-accent/30 transition-all group"
              >
                <span className="text-base leading-none mt-0.5">{h.icon}</span>
                <span className="text-xs text-text-muted group-hover:text-text-secondary leading-relaxed">
                  &ldquo;{h.text}&rdquo;
                </span>
              </button>
            ))}
          </div>

          {/* Quick-fill chips */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs text-text-muted">Or try</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => handleSuggest(p)}
                  className="text-xs px-3 py-1.5 rounded-pill border border-border text-text-secondary hover:border-accent/40 hover:text-accent transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-3 pt-4 border-t border-border mt-2 items-end">
        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!loading && input.trim()) handleSend(e as any);
              }
            }}
            rows={1}
            placeholder="Quiz me, explain a topic, or ask anything..."
            className="w-full bg-white/5 border border-border rounded-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 transition-colors resize-none overflow-hidden"
            style={{ minHeight: "44px", maxHeight: "160px" }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 160) + "px";
            }}
          />
          <span className="absolute bottom-2 right-3 text-[10px] text-text-muted opacity-50 pointer-events-none">
            Enter to send · Shift+Enter for new line
          </span>
        </div>
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-3 bg-accent hover:bg-accent-hover rounded-input transition-colors disabled:opacity-40 min-w-[44px] flex items-center justify-center flex-shrink-0"
        >
          {loading ? (
            <motion.div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
              animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
          ) : (
            <Send className="w-4 h-4 text-white" />
          )}
        </button>
      </form>
    </div>
  );
}
