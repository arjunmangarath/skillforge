"""Quiz routes — generates MCQ questions from the user's learning path."""
import json
import re
import random
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ....db.connection import get_db, get_genai_client, settings, retry_on_rate_limit
from ....db.models import Goal, GoalStatus, LearningPath, PathItem
from ..auth import get_current_user
from google.genai import types

router = APIRouter(prefix="/quiz", tags=["quiz"])


@router.get("/question")
async def get_question(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Generate one MCQ from the user's active learning path."""
    uid = current_user["sub"]

    # Fetch active goal topics
    goal_result = await db.execute(
        select(Goal)
        .where(Goal.user_id == uid, Goal.status == GoalStatus.active)
        .order_by(Goal.created_at.desc())
        .limit(1)
    )
    goal = goal_result.scalar_one_or_none()

    if not goal:
        return _fallback_question("general knowledge")

    path_result = await db.execute(
        select(LearningPath).where(LearningPath.goal_id == goal.id).limit(1)
    )
    path = path_result.scalar_one_or_none()

    topics = ["the subject"]
    if path:
        items_result = await db.execute(
            select(PathItem.title)
            .where(PathItem.path_id == path.id)
            .order_by(PathItem.week_number, PathItem.order_index)
        )
        all_titles = [r[0] for r in items_result.fetchall()]
        if all_titles:
            topics = all_titles

    topic = random.choice(topics)

    client = get_genai_client()
    prompt = f"""Generate ONE multiple-choice question about: "{topic}"

Return ONLY valid JSON in this exact format:
{{
  "question": "...",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correct_index": 0,
  "explanation": "..."
}}

Rules:
- correct_index is 0-based (0=A, 1=B, 2=C, 3=D)
- explanation is 1-2 sentences
- Make it educational and relevant to the topic
- Return only the JSON object, no other text"""

    try:
        response = await retry_on_rate_limit(
            client.models.generate_content,
            model=settings.gemini_flash_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        text = response.text
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return {
                "topic": topic,
                "question": data["question"],
                "options": data["options"],
                "correct_index": int(data["correct_index"]),
                "explanation": data["explanation"],
            }
    except Exception:
        pass

    return _fallback_question(topic)


def _fallback_question(topic: str) -> dict:
    return {
        "topic": topic,
        "question": f"Which of the following best describes a key concept in {topic}?",
        "options": [
            "A. Consistent practice builds mastery",
            "B. Reading once is sufficient",
            "C. Theory alone is enough",
            "D. Speed matters more than understanding",
        ],
        "correct_index": 0,
        "explanation": "Consistent practice is the foundation of mastering any skill.",
    }
