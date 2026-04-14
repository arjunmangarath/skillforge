"""Learning path routes — goal and path management."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ....db.connection import get_db
from ....db.models import Goal, GoalStatus, LearningPath, PathItem
from ....agents.path_agent import generate_learning_path
from ..auth import get_current_user, get_or_create_user

router = APIRouter(prefix="/path", tags=["path"])


class GoalCreateRequest(BaseModel):
    title: str
    skill_area: str
    description: str | None = None
    target_date: datetime | None = None
    difficulty_level: int = 3


@router.post("/generate")
async def generate_path(
    request: GoalCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Create a goal and generate a learning path via PathAgent."""
    await get_or_create_user(db, current_user)
    goal = Goal(
        id=str(uuid.uuid4()),
        user_id=current_user["sub"],
        title=request.title,
        skill_area=request.skill_area,
        description=request.description,
        target_date=request.target_date,
        difficulty_level=request.difficulty_level,
        status=GoalStatus.active,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)

    path = await generate_learning_path(db, goal, current_user["access_token"])
    return {"goal_id": goal.id, "path_id": path.id, "total_weeks": path.total_weeks}


@router.get("/goals")
async def list_goals(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List all active goals for the current user."""
    result = await db.execute(
        select(Goal)
        .where(Goal.user_id == current_user["sub"])
        .order_by(Goal.created_at.desc())
    )
    goals = result.scalars().all()
    return {
        "goals": [
            {
                "id": g.id,
                "title": g.title,
                "skill_area": g.skill_area,
                "status": g.status,
                "target_date": g.target_date,
                "difficulty_level": g.difficulty_level,
            }
            for g in goals
        ]
    }


@router.get("/{goal_id}/items")
async def get_path_items(
    goal_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get all path items for a goal, grouped by week."""
    result = await db.execute(
        select(PathItem, LearningPath)
        .join(LearningPath, PathItem.path_id == LearningPath.id)
        .where(LearningPath.goal_id == goal_id)
        .order_by(PathItem.week_number, PathItem.order_index)
    )
    rows = result.fetchall()

    weeks: dict[int, list] = {}
    for item, path in rows:
        week = item.week_number
        if week not in weeks:
            weeks[week] = []
        weeks[week].append({
            "id": item.id,
            "title": item.title,
            "resource_url": item.resource_url,
            "resource_type": item.resource_type,
            "estimated_hours": item.estimated_hours,
            "order_index": item.order_index,
        })

    return {"goal_id": goal_id, "weeks": weeks}
