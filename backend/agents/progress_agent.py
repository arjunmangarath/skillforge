"""ProgressAgent — tracks and analyzes learning progress."""
import uuid
from datetime import datetime, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from ..db.models import Goal, LearningPath, PathItem, ProgressLog, ProgressStatus
from ..db.connection import settings, get_genai_client, retry_on_rate_limit


SYSTEM_PROMPT = """You are ProgressAgent, a specialist in learning analytics and motivation.

Your responsibilities:
1. Track learner progress across goals and path items
2. Calculate completion percentages and learning velocity
3. Identify at-risk goals (falling behind schedule)
4. Generate progress insights and encouragement
5. Provide data for dashboard visualizations

Be data-driven and encouraging. Surface actionable insights, not just numbers."""


async def get_dashboard_stats(db: AsyncSession, user_id: str) -> dict:
    """Aggregate all stats needed for the dashboard."""

    # Active goals count
    active_goals = await db.scalar(
        select(func.count(Goal.id)).where(
            Goal.user_id == user_id, Goal.status == "active"
        )
    )

    # Completion = done items / total items across all active goals
    total_items = await db.scalar(
        select(func.count(PathItem.id))
        .join(LearningPath, PathItem.path_id == LearningPath.id)
        .join(Goal, LearningPath.goal_id == Goal.id)
        .where(Goal.user_id == user_id, Goal.status == "active")
    ) or 0

    done_items = await db.scalar(
        select(func.count(ProgressLog.id))
        .join(PathItem, ProgressLog.path_item_id == PathItem.id)
        .join(LearningPath, PathItem.path_id == LearningPath.id)
        .join(Goal, LearningPath.goal_id == Goal.id)
        .where(
            Goal.user_id == user_id,
            Goal.status == "active",
            ProgressLog.status == "done",
        )
    ) or 0

    avg_completion = round((done_items / total_items) * 100, 1) if total_items > 0 else 0

    # Today's items due
    today_items = await get_todays_items(db, user_id)

    # Learning streak (consecutive days with progress)
    streak = await _calculate_streak(db, user_id)

    # Weekly progress chart (last 7 days)
    weekly_data = await _get_weekly_progress(db, user_id)

    return {
        "active_goals": active_goals or 0,
        "avg_completion": round(avg_completion, 1),
        "todays_items_count": len(today_items),
        "streak_days": streak,
        "weekly_chart": weekly_data,
        "todays_items": today_items,
    }


async def get_todays_items(db: AsyncSession, user_id: str) -> list[dict]:
    """Get path items the user should work on today, newest goal first."""
    result = await db.execute(
        select(PathItem, LearningPath, Goal)
        .join(LearningPath, PathItem.path_id == LearningPath.id)
        .join(Goal, LearningPath.goal_id == Goal.id)
        .outerjoin(
            ProgressLog,
            (ProgressLog.path_item_id == PathItem.id) & (ProgressLog.user_id == user_id),
        )
        .where(
            Goal.user_id == user_id,
            Goal.status == "active",
            ProgressLog.id.is_(None) | (ProgressLog.status != "done"),
        )
        .order_by(Goal.created_at.desc(), PathItem.order_index.asc())
        .limit(5)
    )
    items = []
    for path_item, path, goal in result.fetchall():
        items.append({
            "id": path_item.id,
            "title": path_item.title,
            "resource_url": path_item.resource_url,
            "resource_type": path_item.resource_type,
            "estimated_hours": path_item.estimated_hours,
            "week_number": path_item.week_number,
            "goal_title": goal.title,
        })
    return items


async def log_progress(
    db: AsyncSession,
    user_id: str,
    path_item_id: str,
    status: ProgressStatus,
    completion_pct: float,
    time_spent_mins: int,
    notes_text: str | None = None,
) -> ProgressLog:
    """Record a progress update for a path item."""
    log = ProgressLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        path_item_id=path_item_id,
        status=status,
        completion_pct=completion_pct,
        time_spent_mins=time_spent_mins,
        notes_text=notes_text,
    )
    db.add(log)
    await db.commit()
    return log


async def generate_progress_insight(
    db: AsyncSession,  # noqa: ARG001
    user_id: str,  # noqa: ARG001
    stats: dict,
) -> str:
    """Use Gemini to generate a personalized progress insight."""
    from google.genai import types
    client = get_genai_client()
    prompt = f"""
    Learner stats:
    - Active goals: {stats['active_goals']}
    - Average completion: {stats['avg_completion']}%
    - Current streak: {stats['streak_days']} days
    - Items due today: {stats['todays_items_count']}

    Generate a brief (2-3 sentences) motivating progress insight.
    Be specific to their numbers. Be encouraging but honest.
    """
    response = await retry_on_rate_limit(
        client.models.generate_content,
        model=settings.gemini_flash_model,
        contents=prompt,
        config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
    )
    return response.text


async def _calculate_streak(db: AsyncSession, user_id: str) -> int:
    """Calculate consecutive days with at least one progress log."""
    streak = 0
    check_date = datetime.utcnow().date()

    for _ in range(365):
        day_start = datetime.combine(check_date, datetime.min.time())
        day_end = datetime.combine(check_date, datetime.max.time())

        count = await db.scalar(
            select(func.count(ProgressLog.id)).where(
                ProgressLog.user_id == user_id,
                ProgressLog.logged_at >= day_start,
                ProgressLog.logged_at <= day_end,
            )
        )
        if count and count > 0:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break
    return streak


async def _get_weekly_progress(db: AsyncSession, user_id: str) -> list[dict]:
    """Get per-day progress totals for the last 7 days."""
    data = []
    for i in range(6, -1, -1):
        day = datetime.utcnow().date() - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())

        total_mins = await db.scalar(
            select(func.coalesce(func.sum(ProgressLog.time_spent_mins), 0)).where(
                ProgressLog.user_id == user_id,
                ProgressLog.logged_at >= day_start,
                ProgressLog.logged_at <= day_end,
            )
        )
        data.append({"date": day.isoformat(), "minutes": total_mins or 0})
    return data
