"""RecallAgent — manages spaced repetition using the SM-2 algorithm."""
import uuid
import math
from datetime import datetime, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from ..db.models import PathItem, RecallCard, RecallReview, CalendarEvent
from ..db.connection import settings, get_genai_client, retry_on_rate_limit
from google.genai import types


SYSTEM_PROMPT = """You are RecallAgent, a specialist in spaced repetition and memory science.

Your responsibilities:
1. Generate high-quality recall cards from learning content
2. Apply SM-2 algorithm to schedule optimal review intervals
3. Sync review sessions to Google Calendar
4. Create Google Tasks for upcoming reviews
5. Analyze recall performance and adapt intervals

Generate cards that test genuine understanding, not just memorization.
Prefer questions that require synthesis and application."""


# SM-2 Algorithm implementation
def sm2_update(
    ease_factor: float,
    interval: int,
    quality: int,  # 0-5
) -> tuple[float, int]:
    """
    Apply SM-2 algorithm to compute new ease factor and interval.
    Returns (new_ease_factor, new_interval_days)
    """
    if quality < 3:
        # Failed recall — reset interval
        return max(1.3, ease_factor - 0.2), 1

    new_ef = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)

    if interval == 1:
        new_interval = 6
    elif interval == 6:
        new_interval = 1
    else:
        new_interval = math.ceil(interval * new_ef)

    return new_ef, new_interval


async def generate_recall_cards(
    db: AsyncSession,
    path_item: PathItem,
    user_id: str,
    cards_per_item: int = 3,
    skip_if_exists: bool = True,
) -> list[RecallCard]:
    """Generate recall cards for a learning path item using Gemini."""
    if skip_if_exists:
        existing = await db.scalar(
            select(func.count(RecallCard.id)).where(
                RecallCard.user_id == user_id,
                RecallCard.path_item_id == path_item.id,
            )
        )
        if existing and existing > 0:
            return []

    client = get_genai_client()
    prompt = f"""
    Generate {cards_per_item} spaced repetition flashcards for this learning item:
    Title: {path_item.title}
    Type: {path_item.resource_type}

    Return as JSON array:
    [
      {{"question": "...", "answer": "..."}},
      ...
    ]

    Make questions that test understanding and application, not just facts.
    Keep answers concise (2-4 sentences max).
    Return only valid JSON.
    """

    import json, re
    response = await retry_on_rate_limit(
        client.models.generate_content,
        model=settings.gemini_flash_model,
        contents=prompt,
        config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
    )
    text = response.text
    json_match = re.search(r'\[.*\]', text, re.DOTALL)

    cards = []
    if json_match:
        try:
            card_data = json.loads(json_match.group())
            for cd in card_data:
                card = RecallCard(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    path_item_id=path_item.id,
                    question=cd.get("question", ""),
                    answer=cd.get("answer", ""),
                    ease_factor=2.5,
                    interval_days=1,
                    next_review_at=datetime.utcnow(),  # due immediately
                )
                db.add(card)
                cards.append(card)
        except (json.JSONDecodeError, KeyError):
            pass

    await db.commit()
    return cards


async def process_review(
    db: AsyncSession,
    card_id: str,
    quality: int,  # 0-5
) -> RecallCard:
    """Process a recall review and update SM-2 state."""
    card = await db.get(RecallCard, card_id)
    if not card:
        raise ValueError(f"Card {card_id} not found")

    new_ef, new_interval = sm2_update(card.ease_factor, card.interval_days, quality)

    # Record the review
    review = RecallReview(
        id=str(uuid.uuid4()),
        card_id=card_id,
        quality_score=quality,
        new_interval_days=new_interval,
    )
    db.add(review)

    # Update card state
    card.ease_factor = new_ef
    card.interval_days = new_interval
    card.next_review_at = datetime.utcnow() + timedelta(days=new_interval)

    await db.commit()
    await db.refresh(card)
    return card


async def get_due_cards(
    db: AsyncSession,
    user_id: str,
    limit: int = 20,
) -> list[RecallCard]:
    """Get all recall cards due for review today."""
    result = await db.execute(
        select(RecallCard)
        .where(
            RecallCard.user_id == user_id,
            RecallCard.next_review_at <= datetime.utcnow(),
        )
        .order_by(RecallCard.next_review_at)
        .limit(limit)
    )
    return list(result.scalars().all())


async def schedule_recall_to_calendar(
    db: AsyncSession,
    user_id: str,
    path_item: PathItem,
    scheduled_at: datetime,
    access_token: str,
) -> CalendarEvent:
    """Schedule a recall session to Google Calendar and record sync."""
    from ..tools.calendar_tool import schedule_learning_session

    result = await schedule_learning_session(
        access_token=access_token,
        title=f"Review: {path_item.title}",
        description="Spaced repetition review session — SKILLFORGE",
        start_time=scheduled_at,
        duration_hours=0.5,
        resource_url=path_item.resource_url,
    )

    event = CalendarEvent(
        id=str(uuid.uuid4()),
        user_id=user_id,
        google_event_id=result.get("google_event_id"),
        path_item_id=path_item.id,
        scheduled_at=scheduled_at,
        sync_status="synced",
        synced_at=datetime.utcnow(),
    )
    db.add(event)
    await db.commit()
    return event
