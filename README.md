# SkillForge

AI-powered multi-agent platform that builds personalized learning paths, tracks your progress, and adapts to how you actually learn.

**Live:** https://skillforge-frontend-991002074047.us-central1.run.app

---

## What it does

You set a goal (e.g. "Learn Rust in 8 weeks at intermediate level"). SkillForge's agent pipeline takes it from there:

- **PathAgent** — generates a week-by-week curriculum using Gemini, with real search-backed resource links (YouTube, Coursera, Google)
- **RecallAgent** — creates spaced repetition flashcards (SM-2 algorithm) as you complete each topic
- **ProgressAgent** — tracks completion, time spent, and weekly streaks; surfaces a live dashboard
- **OrchestratorAgent** — routes all chat input to the right sub-agent and maintains conversation context

---

## Architecture

```
┌─────────────────────────────────────────┐
│           Next.js Frontend              │
│     Dashboard · Path · Recall · Chat    │
└────────────────┬────────────────────────┘
                 │ REST / SWR
┌────────────────▼────────────────────────┐
│           FastAPI Backend               │
│                                         │
│  OrchestratorAgent                      │
│    ├── PathAgent      (Gemini 2.5 Flash)│
│    ├── RecallAgent    (SM-2 algorithm)  │
│    └── ProgressAgent  (analytics)       │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│     AlloyDB (PostgreSQL + pgvector)     │
│  Goals · Paths · Progress · Recall Cards│
└─────────────────────────────────────────┘
```

**Backend:** FastAPI · Google ADK · Gemini 2.5 Flash · SQLAlchemy (async) · pgvector  
**Frontend:** Next.js 14 · Tailwind CSS · Radix UI · Recharts · Framer Motion · SWR  
**Infra:** Google Cloud Run · AlloyDB · Cloud Build · Google OAuth 2.0

---

## Features

- **Google OAuth sign-in** — secure authentication, each account has fully isolated data
- **Personalized learning paths** — week-by-week plans with difficulty scaling, generated fresh per goal
- **Search-grounded resources** — links are built from real search queries (YouTube, Coursera, Google Search)
- **Spaced repetition flashcards** — SM-2 scheduling, auto-generated when you mark a topic done
- **Progress dashboard** — streak tracking, weekly hours chart, completion stats
- **AI chat** — ask questions mid-learning; the orchestrator routes to the right agent
- **Mini games** — Snake, Tetris, Dino for break time

---

## Local setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- Google Cloud project with Gemini API enabled
- AlloyDB (or any PostgreSQL 15+ instance with pgvector)
- Google OAuth 2.0 Client ID

### Backend

```bash
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env   # fill in your credentials
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 \
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com \
npm run dev
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Gemini API key (Google AI Studio) |
| `ALLOYDB_DSN` | PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret |
| `JWT_SECRET` | Secret for signing JWTs |
| `DEV_MODE` | Set `false` for production |

See [`.env.example`](.env.example) for the full list.

---

## Deployment

Cloud Build handles CI/CD on push to `main`:

```bash
gcloud builds submit . --config infra/cloudbuild.yaml
```

Builds and deploys both Docker images to Cloud Run. Secrets are managed via Google Secret Manager — see [`infra/setup-secrets.sh`](infra/setup-secrets.sh).

---

## Project structure

```
backend/
  agents/          # PathAgent, RecallAgent, ProgressAgent, OrchestratorAgent
  api/v1/routes/   # FastAPI route handlers
  db/              # SQLAlchemy models + AlloyDB connection
  tools/           # Reusable tools (memory, search, calendar, notes, tasks)
frontend/
  app/             # Next.js App Router pages
  components/      # UI components (cards, charts, layout, sidebar)
  lib/             # API client, utilities
infra/
  backend.dockerfile
  frontend.dockerfile
  cloudbuild.yaml
scripts/
  init_db.py       # Database schema initialisation
```

---

## Built with

- [Google ADK](https://google.github.io/adk-docs/) + Gemini 2.5 Flash
- [FastAPI](https://fastapi.tiangolo.com/)
- [Next.js](https://nextjs.org/)
- [AlloyDB](https://cloud.google.com/alloydb) + [pgvector](https://github.com/pgvector/pgvector)
- [Google Cloud Run](https://cloud.google.com/run)
