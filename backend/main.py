"""SKILLFORGE — FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.v1.routes import chat, path, progress, recall, team, quiz
from .db.connection import engine, Base

app = FastAPI(
    title="SKILLFORGE API",
    description="Multi-Agent Learning & Skill Development Assistant",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "https://skillforge.run.app", "https://skillforge-frontend-*-uc.a.run.app"],
    allow_origin_regex=r"https://skillforge-.*\.run\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(chat.router, prefix="/api/v1")
app.include_router(path.router, prefix="/api/v1")
app.include_router(progress.router, prefix="/api/v1")
app.include_router(recall.router, prefix="/api/v1")
app.include_router(team.router, prefix="/api/v1")
app.include_router(quiz.router, prefix="/api/v1")


@app.get("/health")
async def health():
    from .db.connection import settings
    return {"status": "ok", "service": "skillforge-api", "dev_mode": settings.dev_mode}


@app.on_event("startup")
async def startup():
    """Initialize DB tables on startup (dev only — use Alembic in prod)."""
    from .db.connection import settings, AsyncSessionLocal
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed dev user when DEV_MODE is enabled
    if settings.dev_mode:
        from .api.v1.auth import DEV_USER, get_or_create_user
        async with AsyncSessionLocal() as db:
            await get_or_create_user(db, DEV_USER)
