"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface WeeklyChartProps {
  data: { date: string; minutes: number }[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs">
      <p className="text-text-secondary mb-0.5">{label}</p>
      <p className="text-accent font-semibold">{payload[0].value} min</p>
    </div>
  );
}

export function WeeklyChart({ data }: WeeklyChartProps) {
  const formatted = data.map(d => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en", { weekday: "short" }),
  }));

  return (
    <div className="glass-card p-5">
      <p className="text-xs text-text-secondary uppercase tracking-wider mb-4">
        Weekly Learning Activity
      </p>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={formatted} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="accentGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="minutes"
            stroke="#10B981"
            strokeWidth={2}
            fill="url(#accentGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
