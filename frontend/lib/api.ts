import { activityLog } from "./activity-log";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002/api/v1";

const METHOD_LABELS: Record<string, string> = {
  GET: "Fetching", POST: "Sending", DELETE: "Deleting", PUT: "Updating", PATCH: "Updating",
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("sf_token") : null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  const method = (options.method ?? "GET").toUpperCase();
  const label = METHOD_LABELS[method] ?? method;
  const shortPath = path.replace(/^\//, "");

  activityLog.log("info", `${label} /${shortPath}`);

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.detail ?? `Request failed: ${res.status}`;
      activityLog.log("error", `✗ ${shortPath} — ${msg.slice(0, 80)}`);
      throw new Error(msg);
    }

    const data = await res.json();
    activityLog.log("success", `✓ ${shortPath}`);
    return data;
  } catch (e: unknown) {
    if (e instanceof Error && e.name !== "AbortError" && !e.message.includes("failed")) {
      activityLog.log("error", `✗ ${shortPath} — ${e.message.slice(0, 80)}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Chat
export const sendChat = (message: string, history: { role: string; content: string }[] = []) =>
  request<{ session_id: string; intent: string; agents_invoked: string[]; message: string; data: Record<string, unknown> }>(
    "/chat", { method: "POST", body: JSON.stringify({ message, history }) }
  );

// Dashboard
export const getDashboard = () =>
  request<{
    active_goals: number;
    avg_completion: number;
    todays_items_count: number;
    streak_days: number;
    weekly_chart: { date: string; minutes: number }[];
    todays_items: unknown[];
  }>("/progress/dashboard");

// Goals + Path
export const getGoals = () => request<{ goals: unknown[] }>("/path/goals");
export const generatePath = (data: { title: string; skill_area: string; target_date?: string; difficulty_level?: number }) =>
  request("/path/generate", { method: "POST", body: JSON.stringify(data) });
export const getPathItems = (goalId: string) =>
  request<{ goal_id: string; weeks: Record<string, unknown[]> }>(`/path/${goalId}/items`);

// Recall
export const getTodaysCards = () =>
  request<{ cards: { id: string; question: string; answer: string }[]; total: number }>("/recall/today");
export const submitReview = (card_id: string, quality: number) =>
  request("/recall/review", { method: "POST", body: JSON.stringify({ card_id, quality }) });

// Progress
export const logProgress = (data: {
  path_item_id: string;
  status: string;
  completion_pct: number;
  time_spent_mins: number;
}) => request("/progress/log", { method: "POST", body: JSON.stringify(data) });

// Quiz
export const getQuizQuestion = () =>
  request<{ topic: string; question: string; options: string[]; correct_index: number; explanation: string }>("/quiz/question");

// Team
export const getTeamGaps = (teamId: string) => request(`/team/${teamId}/gaps`);
export const getTeamHeatmap = (teamId: string) => request(`/team/${teamId}/heatmap`);

// Reset
export const resetUserData = () =>
  request<{ status: string; message: string }>("/progress/reset", { method: "DELETE" });
