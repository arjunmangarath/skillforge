"""PathAgent — generates personalized learning curricula using Gemini + Search grounding."""
import json
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from ..db.models import Goal, LearningPath, PathItem, ResourceType
from ..tools.memory_tool import embed_text
from ..db.connection import settings, get_genai_client, retry_on_rate_limit
from google.genai import types


SYSTEM_PROMPT = """You are PathAgent, a specialist in creating personalized learning curricula.

Your responsibilities:
1. Analyze the learner's goal, current skill level, and available time
2. Design a structured week-by-week learning path
3. Select the best resources using Google Search grounding
4. Ensure progressive difficulty and logical sequencing
5. Generate spaced repetition recall cards for each topic

Always prioritize practical, hands-on resources. Sequence from fundamentals to advanced.
Return structured JSON that can be directly stored in the database."""


async def generate_learning_path(
    db: AsyncSession,
    goal: Goal,
    access_token: str,  # noqa: ARG001 — passed through to calendar tool
) -> LearningPath:
    """
    Core PathAgent function: generates a complete learning path for a goal.
    Called by OrchestratorAgent when a new goal is created.
    """
    client = get_genai_client()
    weeks = _calculate_weeks(goal.target_date)

    # Single Gemini call: generate the full path directly
    # URL templates that always resolve correctly (search-based, never hallucinated)
    total_items = weeks * 3
    prompt = f"""
    Goal: {goal.title}
    Skill Area: {goal.skill_area}
    Duration: EXACTLY {weeks} weeks
    Difficulty: {goal.difficulty_level}/5

    Create a structured learning path as a JSON array with EXACTLY {total_items} items ({weeks} weeks × 3 items per week).
    Week numbers must go from 1 to {weeks}. You MUST include items for ALL {weeks} weeks.

    Each item:
    {{
      "week_number": 1,
      "title": "Specific topic title",
      "search_query": "exact search query to find this resource",
      "resource_type": "video|article|course|book",
      "estimated_hours": 2.5,
      "order_index": 0,
      "description": "What the learner will achieve"
    }}

    IMPORTANT: Return EXACTLY {total_items} items. Weeks 1-{weeks // 2} = fundamentals, weeks {weeks // 2 + 1}-{weeks} = advanced topics.
    Make search_query very specific (e.g. "python functions tutorial beginner youtube 2024").
    Return only valid JSON array, no markdown, no other text.
    """

    response = await retry_on_rate_limit(
        client.models.generate_content,
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
        max_retries=1,
        call_timeout=60.0,
    )
    path_items_data = _parse_json_response(response.text)

    # Ensure we have exactly weeks*3 items — pad if Gemini returned too few
    target_count = weeks * 3
    while len(path_items_data) < target_count:
        i = len(path_items_data)
        w = (i // 3) + 1
        path_items_data.append({
            "week_number": w,
            "title": f"Week {w} — {goal.skill_area} Advanced Practice",
            "search_query": f"{goal.skill_area} advanced week {w} tutorial 2024",
            "resource_type": "article",
            "estimated_hours": 2.0,
            "order_index": i,
            "description": f"Week {w} advanced topics for {goal.title}",
        })

    # Force correct week_number based on position (Gemini often assigns wrong weeks)
    for i, item in enumerate(path_items_data):
        item["week_number"] = (i // 3) + 1

    # Step 4: Persist to AlloyDB
    path = LearningPath(
        id=str(uuid.uuid4()),
        goal_id=goal.id,
        generated_by="ai",
        total_weeks=weeks,
    )
    db.add(path)

    for i, item_data in enumerate(path_items_data):
        resource_type = _parse_resource_type(item_data.get("resource_type", "article"))

        # Build a guaranteed-valid search URL from the search query
        search_query = item_data.get("search_query", item_data.get("title", ""))
        from urllib.parse import quote_plus
        if resource_type.value == "video":
            resource_url = f"https://www.youtube.com/results?search_query={quote_plus(search_query)}"
        elif resource_type.value == "course":
            resource_url = f"https://www.google.com/search?q={quote_plus(search_query + ' course site:coursera.org OR site:udemy.com OR site:freecodecamp.org')}"
        else:
            resource_url = f"https://www.google.com/search?q={quote_plus(search_query)}"

        item = PathItem(
            id=str(uuid.uuid4()),
            path_id=path.id,
            week_number=item_data.get("week_number", (i // 3) + 1),
            title=item_data.get("title", f"Week {i+1} Resource"),
            resource_url=resource_url,
            resource_type=resource_type,
            estimated_hours=item_data.get("estimated_hours", 1.5),
            order_index=i,
        )
        db.add(item)

        # Generate embedding for semantic search
        try:
            embedding = await embed_text(f"{item.title} {item_data.get('description', '')}")
            item.embedding = embedding
        except Exception:
            pass  # Embedding failure is non-blocking

    await db.commit()
    await db.refresh(path)
    return path


def _calculate_weeks(target_date: datetime | None) -> int:
    if not target_date:
        return 8  # default
    delta = target_date - datetime.utcnow()
    weeks = max(1, delta.days // 7)
    return min(weeks, 52)  # cap at 1 year


def _parse_json_response(text: str) -> list[dict]:
    import re
    json_match = re.search(r'\[.*\]', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass
    return []


def _parse_resource_type(type_str: str) -> ResourceType:
    mapping = {
        "video": ResourceType.video,
        "article": ResourceType.article,
        "course": ResourceType.course,
        "book": ResourceType.book,
    }
    return mapping.get(type_str.lower(), ResourceType.article)
