"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Users, TrendingDown } from "lucide-react";
import { getTeamGaps } from "@/lib/api";
import { cn } from "@/lib/utils";

const TEAM_ID = "default-team"; // replace with dynamic team ID from auth context

function HeatCell({ value }: { value: number }) {
  const pct = value ?? 0;
  const bg =
    pct >= 70 ? "bg-accent/70" :
    pct >= 40 ? "bg-yellow-500/60" :
    "bg-red-500/60";
  return (
    <div className={cn("w-12 h-8 rounded flex items-center justify-center text-xs font-mono font-bold text-white", bg)}>
      {pct}%
    </div>
  );
}

export default function TeamPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTeamGaps(TEAM_ID).then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 bg-white/8 rounded-input animate-pulse" />
        </div>
        <div className="glass-card p-6 space-y-4">
          <div className="h-4 w-24 bg-white/8 rounded-input animate-pulse" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-3 w-16 bg-white/8 rounded-input animate-pulse" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="w-12 h-8 bg-white/8 rounded animate-pulse" />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-text-muted text-sm">
          <motion.div className="w-1.5 h-1.5 rounded-full bg-accent/60" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }} />
          <motion.div className="w-1.5 h-1.5 rounded-full bg-accent/60" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.15 }} />
          <motion.div className="w-1.5 h-1.5 rounded-full bg-accent/60" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }} />
          <span>Loading team data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-sans text-xl font-bold text-text-primary">Team Skills</h1>
        {data?.critical_gap_count > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-pill text-red-400 text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            {data.critical_gap_count} critical gap{data.critical_gap_count > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Heatmap */}
      {data?.heatmap && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" /> Skill Heatmap
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-text-muted text-xs pr-4 pb-3">Member</th>
                  {data.heatmap.skill_areas?.map((skill: string) => (
                    <th key={skill} className="text-text-muted text-xs pb-3 px-2">{skill}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="space-y-2">
                {Object.entries(data.heatmap.heatmap ?? {}).map(([userId, skills]: [string, any]) => (
                  <tr key={userId}>
                    <td className="pr-4 py-2 text-text-secondary text-xs font-mono">{userId.slice(0, 8)}…</td>
                    {data.heatmap.skill_areas?.map((skill: string) => (
                      <td key={skill} className="px-2 py-2">
                        <HeatCell value={skills[skill] ?? 0} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-accent/70 inline-block" />≥70% Strong</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-500/60 inline-block" />40–70% Moderate</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/60 inline-block" />&lt;40% Gap</span>
          </div>
        </motion.div>
      )}

      {/* Gaps */}
      {data?.gaps?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass-card p-6">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-400" /> Identified Gaps
          </h2>
          <div className="space-y-3">
            {data.gaps.map((gap: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/3 rounded-input">
                <div>
                  <p className="text-text-primary text-sm font-medium">{gap.skill_area}</p>
                  <p className="text-text-muted text-xs">{gap.affected_member_count} member{gap.affected_member_count > 1 ? "s" : ""} affected</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-text-secondary">{gap.team_avg_completion}%</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-pill text-xs font-medium border",
                    gap.gap_severity === "critical"
                      ? "bg-red-500/20 text-red-400 border-red-500/30"
                      : gap.gap_severity === "moderate"
                      ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                      : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                  )}>
                    {gap.gap_severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* AI Remediation Plan */}
      {data?.remediation_plan && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="glass-card p-6 border-accent/20">
          <h2 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">
            AI Remediation Plan
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">
            {data.remediation_plan}
          </p>
        </motion.div>
      )}
    </div>
  );
}
