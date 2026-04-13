"""Progress routes — dashboard stats and progress logging."""
import logging
from fastapi import APIRouter, Depends

logger = logging.getLogger(__name__)
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from ....db.connection import get_db
from ....agents.progress_agent import get_dashboard_stats, log_progress
from ....agents.recall_agent import generate_recall_cards
from ....db.models import (
    ProgressStatus, Goal, LearningPath, PathItem,
    ProgressLog, RecallCard, RecallReview, AgentSession,
)
from ..auth import get_current_user

router = APIRouter(prefix="/progress", tags=["progress"])


class ProgressLogRequest(BaseModel):
    path_item_id: str
    status: ProgressStatus
    completion_pct: float
    time_spent_mins: int
    notes_text: str | None = None


@router.get("/dashboard")
async def dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get all dashboard stats for the current user."""
    return await get_dashboard_stats(db, current_user["sub"])


@router.post("/log")
async def log_progress_endpoint(
    request: ProgressLogRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Log progress on a path item."""
    log = await log_progress(
        db=db,
        user_id=current_user["sub"],
        path_item_id=request.path_item_id,
        status=request.status,
        completion_pct=request.completion_pct,
        time_spent_mins=request.time_spent_mins,
        notes_text=request.notes_text,
    )

    # When an item is marked done, generate flashcards for it immediately
    if request.status == ProgressStatus.done:
        path_item = await db.get(PathItem, request.path_item_id)
        if path_item:
            try:
                await generate_recall_cards(
                    db=db,
                    path_item=path_item,
                    user_id=current_user["sub"],
                    skip_if_exists=True,
                )
            except Exception as e:
                logger.error("Recall card generation failed for item %s: %s", request.path_item_id, e)

    return {"id": log.id, "logged_at": log.logged_at}


@router.delete("/reset")
async def reset_user_data(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Delete all learning data for the current user so they can start fresh."""
    uid = current_user["sub"]

    # Delete in dependency order
    # 1. Recall reviews (FK → recall_cards)
    card_ids = (await db.execute(
        __import__("sqlalchemy", fromlist=["select"]).select(RecallCard.id).where(RecallCard.user_id == uid)
    )).scalars().all()
    if card_ids:
        await db.execute(delete(RecallReview).where(RecallReview.card_id.in_(card_ids)))

    # 2. Recall cards, progress logs, agent sessions
    await db.execute(delete(RecallCard).where(RecallCard.user_id == uid))
    await db.execute(delete(ProgressLog).where(ProgressLog.user_id == uid))
    await db.execute(delete(AgentSession).where(AgentSession.user_id == uid))

    # 3. Path items (FK → learning_paths → goals)
    path_ids = (await db.execute(
        __import__("sqlalchemy", fromlist=["select"]).select(LearningPath.id)
        .join(Goal, LearningPath.goal_id == Goal.id)
        .where(Goal.user_id == uid)
    )).scalars().all()
    if path_ids:
        await db.execute(delete(PathItem).where(PathItem.path_id.in_(path_ids)))
        await db.execute(delete(LearningPath).where(LearningPath.id.in_(path_ids)))

    # 4. Goals
    await db.execute(delete(Goal).where(Goal.user_id == uid))

    await db.commit()
    return {"status": "ok", "message": "All your data has been cleared. Start fresh!"}
