"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Target, TrendingUp, Brain, Flame, MessageSquare } from "lucide-react";
import { StatCard } from "@/components/cards/stat-card";
import { PathItemCard } from "@/components/cards/path-item-card";
import { WeeklyChart } from "@/components/charts/weekly-chart";
import { getDashboard, sendChat, resetUserData } from "@/lib/api";
import { StatCardSkeleton, CardSkeleton, LoadingDots } from "@/components/ui/loading-skeleton";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [quickChat, setQuickChat] = useState("");
  const [chatResponse, setChatResponse] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("sf_last_chat") ?? "";
    return "";
  });
  const [chatLoading, setChatLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    getDashboard()
      .then(setStats)
      .catch(() => setStats({ active_goals: 0, avg_completion: 0, todays_items_count: 0, streak_days: 0, weekly_chart: [], todays_items: [] }))
      .finally(() => setLoadingStats(false));
  }, []);

  async function handleReset() {
    if (!confirm("Clear all your goals and learning data and start fresh?")) return;
    setResetting(true);
    try {
      await resetUserData();
      setStats(null);
      setChatResponse("");
      sessionStorage.removeItem("sf_last_chat");
      // Reload fresh stats
      const fresh = await getDashboard();
      setStats(fresh);
    } catch (e) {
      console.error(e);
    } finally {
      setResetting(false);
    }
  }

  async function handleQuickChat(e: React.FormEvent) {
    e.preventDefault();
    if (!quickChat.trim()) return;
    setChatLoading(true);
    try {
      const res = await sendChat(quickChat);
      setChatResponse(res.message);
      sessionStorage.setItem("sf_last_chat", res.message);
      setQuickChat("");
      // If PathAgent ran, a new goal was created — reload stats and show loading
      if (res.agents_invoked?.includes("PathAgent")) {
        setLoadingStats(true);
        getDashboard()
          .then(setStats)
          .catch(() => {})
          .finally(() => setLoadingStats(false));
      } else {
        // Soft refresh in background
        getDashboard().then(setStats).catch(() => {});
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("aborted") || msg.includes("timeout")) {
        setChatResponse("This is taking longer than expected — generating your learning path involves multiple AI calls. Please wait a few seconds and try again, or check the Learning Path tab to see if it was created.");
      } else {
        setChatResponse(`Error: ${msg.slice(0, 100)}`);
      }
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h1 className="font-sans text-2xl font-bold text-text-primary">
            {greeting} 👋
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Here&apos;s your learning snapshot for today.
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="text-xs px-3 py-1.5 rounded-input border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
        >
          {resetting ? "Clearing..." : "Clear & Start Fresh"}
        </button>
      </motion.div>

      {/* App intro — shown only when user has no goals yet */}
      {!loadingStats && !stats?.active_goals && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-card p-6 border border-accent/20 bg-gradient-to-br from-accent/5 to-secondary/5 space-y-4">
          <div className="flex items-start gap-4">
            <div className="text-4xl flex-shrink-0">🧠</div>
            <div>
              <h2 className="font-sans font-bold text-text-primary text-lg">Welcome to SKILLFORGE</h2>
              <p className="text-text-secondary text-sm mt-1 leading-relaxed">
                Your AI-powered personal learning assistant. Tell SKILLFORGE what you want to learn —
                it builds a week-by-week curriculum, generates flashcards as you progress, quizzes you
                in the Practice tab, and even lets you earn points through learning games.
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Try typing one of these in the chat →</p>
            <div className="flex flex-wrap gap-2">
              {[
                "I want to learn Python in 4 weeks",
                "Prepare me for a bank exam in 8 weeks",
                "I want to learn SQL in 10 days",
                "Teach me web development in 3 months",
                "I want to learn C++ in 3 weeks",
              ].map(q => (
                <button key={q} onClick={() => setQuickChat(q)}
                  className="text-xs px-3 py-1.5 rounded-pill border border-accent/30 text-accent hover:bg-accent/10 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingStats ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Active Goals" value={stats?.active_goals ?? 0} icon={<Target className="w-5 h-5" />} accent="green" delay={0.1} />
            <StatCard label="Avg. Progress" value={`${stats?.avg_completion ?? 0}%`} icon={<TrendingUp className="w-5 h-5" />} accent="indigo" delay={0.15} />
            <StatCard label="Reviews Today" value={stats?.todays_items_count ?? 0} icon={<Brain className="w-5 h-5" />} delay={0.2} />
            <StatCard label="Streak" value={`🔥 ${stats?.streak_days ?? 0}d`} icon={<Flame className="w-5 h-5" />} accent="green" delay={0.25} />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today's Focus */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Today&apos;s Focus
          </h2>
          {loadingStats ? (
            Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
          ) : stats?.todays_items?.length ? (
            stats.todays_items.map((item: any, i: number) => (
              <PathItemCard key={item.id} {...item} resourceType={item.resource_type} estimatedHours={item.estimated_hours} resourceUrl={item.resource_url} delay={0.1 * i}
                onDone={() => getDashboard().then(setStats).catch(() => {})} />
            ))
          ) : (
            <div className="glass-card p-6 text-center text-text-muted text-sm">
              All caught up! No items due today. Create a goal to get started.
            </div>
          )}
        </div>

        {/* Quick Chat */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Ask SKILLFORGE
          </h2>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-4 space-y-3"
          >
            {chatResponse && (
              <div className="bg-accent/10 border border-accent/20 rounded-input p-3 text-sm text-text-primary space-y-2 max-h-64 overflow-y-auto">
                {chatResponse.split("\n").filter(l => l !== "").map((line, i) => {
                  // Numbered list item: "1. ..."
                  const numbered = line.match(/^(\d+)\.\s+(.*)/);
                  // Bullet: "- ..."
                  const bullet = line.match(/^[-•]\s+(.*)/);

                  // Render inline bold: **text**
                  function renderInline(text: string) {
                    const parts = text.split(/\*\*(.*?)\*\*/g);
                    return parts.map((p, j) => j % 2 === 1
                      ? <strong key={j} className="text-text-primary font-semibold">{p}</strong>
                      : <span key={j}>{p}</span>
                    );
                  }

                  if (numbered) {
                    return (
                      <div key={i} className="flex gap-2">
                        <span className="text-accent font-bold flex-shrink-0">{numbered[1]}.</span>
                        <span className="text-text-secondary leading-relaxed">{renderInline(numbered[2])}</span>
                      </div>
                    );
                  }
                  if (bullet) {
                    return (
                      <div key={i} className="flex gap-2">
                        <span className="text-accent flex-shrink-0 mt-1">•</span>
                        <span className="text-text-secondary leading-relaxed">{renderInline(bullet[1])}</span>
                      </div>
                    );
                  }
                  return (
                    <p key={i} className="text-text-secondary leading-relaxed">{renderInline(line)}</p>
                  );
                })}
              </div>
            )}
            <form onSubmit={handleQuickChat} className="flex gap-2">
              <input
                value={quickChat}
                onChange={e => setQuickChat(e.target.value)}
                placeholder="What should I focus on today?"
                className="flex-1 bg-white/5 border border-border rounded-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 transition-colors"
              />
              <button
                type="submit"
                disabled={chatLoading}
                className="p-2 bg-accent hover:bg-accent-hover rounded-input transition-colors disabled:opacity-50 min-w-[36px] flex items-center justify-center"
              >
                {chatLoading
                  ? <LoadingDots label="" />
                  : <MessageSquare className="w-4 h-4 text-white" />}
              </button>
            </form>
          </motion.div>
        </div>
      </div>

      {/* Weekly Chart */}
      {stats?.weekly_chart && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <WeeklyChart data={stats.weekly_chart} />
        </motion.div>
      )}
    </div>
  );
}
