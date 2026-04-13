"""Recall routes — spaced repetition card management."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from ....db.connection import get_db
from ....agents.recall_agent import get_due_cards, process_review
from ..auth import get_current_user

router = APIRouter(prefix="/recall", tags=["recall"])


class ReviewRequest(BaseModel):
    card_id: str
    quality: int  # 0-5


@router.get("/today")
async def get_todays_cards(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get all recall cards due for review today."""
    cards = await get_due_cards(db, current_user["sub"])
    return {
        "cards": [
            {
                "id": c.id,
                "question": c.question,
                "answer": c.answer,
                "ease_factor": c.ease_factor,
                "interval_days": c.interval_days,
            }
            for c in cards
        ],
        "total": len(cards),
    }


@router.post("/review")
async def submit_review(
    request: ReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Submit a review result and update SM-2 state."""
    if request.quality < 0 or request.quality > 5:
        raise HTTPException(status_code=400, detail="Quality must be 0-5")

    card = await process_review(db, request.card_id, request.quality)
    return {
        "card_id": card.id,
        "new_interval_days": card.interval_days,
        "next_review_at": card.next_review_at,
        "ease_factor": card.ease_factor,
    }
