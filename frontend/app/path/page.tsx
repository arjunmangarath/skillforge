"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Target } from "lucide-react";
import { PathItemCard } from "@/components/cards/path-item-card";
import { getGoals, getPathItems, generatePath } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function PathPage() {
  const [goals, setGoals] = useState<any[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<Record<string, any[]>>({});
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", skill_area: "", difficulty_level: 3 });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getGoals().then(r => {
      setGoals(r.goals);
      if (r.goals.length > 0) setSelectedGoal((r.goals[0] as any).id);
    });
  }, []);

  useEffect(() => {
    if (!selectedGoal) return;
    getPathItems(selectedGoal).then(r => setWeeks(r.weeks));
  }, [selectedGoal]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res: any = await generatePath(form);
      await getGoals().then(r => {
        setGoals(r.goals);
        setSelectedGoal(res.goal_id);
      });
      setShowNew(false);
    } finally {
      setCreating(false);
    }
  }

  const selectedGoalData = goals.find((g: any) => g.id === selectedGoal);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-sans text-xl font-bold text-text-primary">Learning Paths</h1>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-input transition-colors"
        >
          <Plus className="w-4 h-4" /> New Goal
        </button>
      </div>

      {/* Goal selector */}
      {goals.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {goals.map((g: any) => (
            <button
              key={g.id}
              onClick={() => setSelectedGoal(g.id)}
              className={cn(
                "px-4 py-2 rounded-pill text-sm font-medium border transition-colors",
                selectedGoal === g.id
                  ? "bg-accent/10 text-accent border-accent/30"
                  : "text-text-secondary border-border hover:border-white/20"
              )}
            >
              {g.title}
            </button>
          ))}
        </div>
      )}

      {/* New goal form */}
      {showNew && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6">
          <h2 className="font-semibold text-text-primary mb-4">Create New Goal</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Goal Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Become a GCP Architect"
                  className="w-full bg-white/5 border border-border rounded-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50" />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Skill Area</label>
                <input value={form.skill_area} onChange={e => setForm(f => ({ ...f, skill_area: e.target.value }))}
                  placeholder="e.g. Google Cloud Platform"
                  className="w-full bg-white/5 border border-border rounded-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={creating || !form.title || !form.skill_area}
                className="px-6 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-input transition-colors disabled:opacity-50">
                {creating ? "Generating path..." : "Generate Path with AI"}
              </button>
              <button type="button" onClick={() => setShowNew(false)}
                className="px-4 py-2 text-text-secondary text-sm hover:text-text-primary transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Weeks kanban */}
      {selectedGoalData && Object.keys(weeks).length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-text-primary">{selectedGoalData.title}</span>
            <span className="text-xs text-text-muted">·</span>
            <span className="text-xs text-text-muted">{Object.keys(weeks).length} weeks</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {Object.entries(weeks).map(([week, items]) => (
              <div key={week} className="flex-shrink-0 w-64">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Week {week}
                  </span>
                  <span className="text-xs text-text-muted">({(items as any[]).length} items)</span>
                </div>
                <div className="space-y-2">
                  {(items as any[]).map((item, i) => (
                    <PathItemCard
                      key={item.id}
                      {...item}
                      resourceType={item.resource_type}
                      estimatedHours={item.estimated_hours}
                      resourceUrl={item.resource_url}
                      delay={0.05 * i}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {goals.length === 0 && !showNew && (
        <div className="glass-card p-12 text-center">
          <div className="text-4xl mb-4">🎯</div>
          <h2 className="font-sans font-bold text-text-primary mb-2">No goals yet</h2>
          <p className="text-text-secondary text-sm mb-6">Create your first learning goal and SKILLFORGE will build you a personalized path.</p>
          <button onClick={() => setShowNew(true)}
            className="px-6 py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-input transition-colors">
            Create Your First Goal
          </button>
        </div>
      )}
    </div>
  );
}
