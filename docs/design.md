# SKILLFORGE — Design Document
**Learning & Skill Development Assistant**
Google Cloud Gen AI Academy (APAC Edition)

---

## Understanding Summary

- **What:** A multi-agent AI system that generates personalized learning paths, tracks progress, surfaces resources via spaced repetition, and analyzes team skill gaps
- **Why:** Help individuals and teams learn faster and more intentionally — AI handles planning, scheduling, and tracking
- **Who:** Individual learners (primary) + managers/team leads (secondary)
- **Constraints:** Google Cloud tools exclusively; English-first; hackathon submission + production-grade architecture
- **Non-goals:** Content hosting, billing/subscriptions, native mobile app

---

## Assumptions

| # | Assumption |
|---|---|
| A1 | Google OAuth handles all authentication |
| A2 | AlloyDB with pgvector is the single database |
| A3 | Demo targets ~10–50 concurrent users; architecture supports 10K+ |
| A4 | No PII stored beyond what the user explicitly provides |
| A5 | Learning content is linked, not hosted |
| A6 | Solo developer or small team building this |
| A7 | English-first for the academy submission |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 App Router, shadcn/ui, Tailwind CSS, Framer Motion |
| Voice | Gemini Live API (WebRTC) |
| Backend | Python FastAPI on Cloud Run |
| Agents | Google ADK (Agent Development Kit) |
| LLM | Gemini 2.0 Pro + Flash |
| Database | AlloyDB (PostgreSQL + pgvector) |
| Search | Vertex AI + Google Search grounding |
| Auth | Google OAuth 2.0 |
| Async | Cloud Pub/Sub |
| Deploy | Cloud Run (backend + frontend) |

---

## Architecture

```
FRONTEND (Next.js 14 — Cloud Run)
├── /dashboard      → Progress overview, streak, goals
├── /path           → Active learning path (kanban-style)
├── /recall         → Spaced repetition daily queue
├── /team           → Manager view: team skill heatmap
├── /chat           → Conversational AI interface
└── /voice          → Gemini Live voice session panel

BACKEND (FastAPI — Cloud Run)
└── /api/v1
    ├── POST /chat
    ├── POST /path/generate
    ├── GET  /progress/{id}
    ├── GET  /recall/today
    ├── GET  /team/gaps
    └── WS   /voice/stream

AGENT LAYER (Google ADK)
├── OrchestratorAgent   ← routes all user input
│   ├── PathAgent       ← Gemini + Search grounding → curriculum
│   ├── ProgressAgent   ← AlloyDB queries → insights
│   ├── RecallAgent     ← SM-2 algorithm → review queue
│   └── TeamAgent       ← aggregate queries → gap heatmaps

TOOL LAYER (MCP via Gemini Function Calling)
├── calendar_tool   → Google Calendar API
├── tasks_tool      → Google Tasks API
├── notes_tool      → Google Docs / Keep API
├── search_tool     → Vertex AI + Google Search grounding
└── memory_tool     → AlloyDB pgvector semantic search

DATA LAYER
├── AlloyDB             ← all structured data
└── AlloyDB pgvector    ← semantic search (path_items, notes)
```

---

## Data Model (AlloyDB)

```sql
users (id, google_id, email, name, avatar_url, role, created_at)
teams (id, name, owner_id, created_at)
team_members (team_id, user_id, joined_at)

goals (id, user_id, title, description, target_date, status, skill_area, difficulty_level, created_at)

learning_paths (id, goal_id, generated_by, gemini_session_id, total_weeks, created_at)

path_items (id, path_id, week_number, title, resource_url, resource_type,
            estimated_hours, order_index, embedding vector(768))

progress_logs (id, user_id, path_item_id, status, completion_pct,
               time_spent_mins, notes_text, logged_at)

recall_cards (id, user_id, path_item_id, question, answer,
              ease_factor, interval_days, next_review_at, created_at)

recall_reviews (id, card_id, reviewed_at, quality_score, new_interval_days)

notes (id, user_id, title, content, source_url, tags, embedding vector(768), created_at)

calendar_events (id, user_id, google_event_id, path_item_id, scheduled_at, synced_at)
tasks_sync (id, user_id, google_task_id, path_item_id, status, synced_at)

agent_sessions (id, user_id, session_type, gemini_session_id, started_at, ended_at, summary_text)
```

---

## UI Design System

```
Style:    Dark SaaS + Glassmorphism
Colors:   #0A0F1E (bg) · #1E2D4A (surface) · #10B981 (accent) · #6366F1 (secondary)
Font:     Inter 700 (headings) · DM Sans 400/500 (body)
Radius:   12px cards · 8px inputs
Motion:   Framer Motion — fade-up, stagger
Glass:    backdrop-blur-xl bg-white/5 border border-white/10
```

### Pages
- `/dashboard` — stat cards (goals, progress, reviews, streak), today's focus, weekly chart
- `/path` — kanban by week, resource cards, drawer for detail + notes
- `/recall` — flashcard UI with SM-2 quality buttons (Again/Hard/Good/Easy)
- `/team` — skill heatmap grid, gap alerts, team learning plan CTA
- `/chat` — split: conversation + context panel + voice toggle
- `/voice` — Gemini Live WebRTC panel

---

## Agent Flows

### New Goal
```
User intent → OrchestratorAgent
  ├── PathAgent (parallel): generates curriculum via Gemini + Search
  ├── ProgressAgent (parallel): creates goal in AlloyDB
  └── RecallAgent (after path): generates cards, schedules Calendar, creates Tasks
Result: full plan delivered in one response
```

### Daily Check-in
```
OrchestratorAgent
  ├── RecallAgent: cards due today (next_review_at <= now)
  ├── ProgressAgent: today's path items
  └── calendar_tool: today's scheduled sessions
Result: daily briefing card
```

### Team Gap Analysis
```
Manager intent → OrchestratorAgent → TeamAgent
  ├── Aggregate progress_logs by skill_area across team
  ├── Gemini + Search: compare vs benchmarks
  └── Return: heatmap data + recommended team plan
```

---

## Error Handling

| Failure | Handling |
|---|---|
| PathAgent timeout | Return partial path; background-complete via Pub/Sub |
| Calendar API down | Queue with `pending` status; retry worker every 5min |
| AlloyDB connection lost | Circuit breaker — 3 retries then 503 |
| Sub-agent returns empty | Orchestrator falls back to direct Gemini response |
| Recall generation fails | Goal created; cards queued async |
| Gemini Live disconnect | Auto-save transcript; resume from last turn |

---

## Deployment

```
GitHub → Cloud Build CI/CD
  ├── frontend image → Cloud Run (public)
  └── backend image  → Cloud Run (private VPC)

AlloyDB        → private VPC
Cloud Pub/Sub  → async worker triggers
Secret Manager → credentials
Firebase Auth  → Google OAuth
```

---

## Project Structure

```
skillforge/
├── frontend/
│   ├── app/(auth)/login/
│   ├── app/dashboard/
│   ├── app/path/
│   ├── app/recall/
│   ├── app/team/
│   ├── app/chat/
│   ├── app/voice/
│   ├── components/ui/
│   ├── components/charts/
│   ├── components/cards/
│   └── lib/api.ts · gemini-live.ts
├── backend/
│   ├── agents/orchestrator.py · path_agent.py · progress_agent.py · recall_agent.py · team_agent.py
│   ├── tools/calendar_tool.py · tasks_tool.py · notes_tool.py · search_tool.py · memory_tool.py
│   ├── db/models.py · migrations/ · connection.py
│   ├── api/v1/routes/
│   └── workers/pubsub_worker.py
├── infra/cloudbuild.yaml · *.dockerfile
└── docs/design.md
```

---

## Decision Log

| Decision | Chosen | Alternatives | Why |
|---|---|---|---|
| Primary use case | Learning & Skill Dev | All 5 | Focused scope, clear data model |
| Architecture | Next.js + FastAPI + ADK | tRPC mono, Streamlit | ADK native multi-agent + premium UI |
| Database | AlloyDB pgvector | Firestore + Vertex Search | Single DB for SQL + vectors |
| Agent framework | Google ADK | LangGraph, CrewAI | Native Gemini + Google tool support |
| UI style | Dark Glassmorphism SaaS | Material 3, Light | Premium look for academy demo |
| Auth | Google OAuth | Custom auth | Fits Google-only constraint |
| Async | Cloud Pub/Sub | Cloud Tasks | Better for fan-out agent patterns |
| Spaced repetition | SM-2 algorithm | Custom AI scoring | Proven, simple, well-understood |
