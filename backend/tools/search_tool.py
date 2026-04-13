"""Learning resource search — uses plain Gemini generation (no paid Search grounding)."""
from ..db.connection import settings, get_genai_client, retry_on_rate_limit


async def search_learning_resources(
    query: str,
    skill_area: str,
    resource_types: list[str] | None = None,
    max_results: int = 10,
) -> list[dict]:
    """
    Generate learning resources using Gemini knowledge (no Search grounding).
    Returns structured list of resources.
    """
    client = get_genai_client()
    types_hint = ", ".join(resource_types) if resource_types else "courses, articles, videos, books"
    prompt = f"""
    List {max_results} well-known learning resources for: "{query}" in {skill_area}.

    Return as a JSON array only, no other text:
    [
      {{
        "title": "Resource title",
        "url": "https://...",
        "type": "video|article|course|book",
        "estimated_hours": 2.5,
        "description": "One sentence description",
        "week_suggestion": 1
      }}
    ]

    Prefer: {types_hint}
    Use only well-known, real URLs (YouTube, Coursera, MDN, freeCodeCamp, etc).
    """

    response = await retry_on_rate_limit(
        client.models.generate_content,
        model=settings.gemini_flash_model,
        contents=prompt,
    )

    import json, re
    text = response.text
    json_match = re.search(r'\[.*\]', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass
    return []


async def research_skill_area(skill_area: str, weeks: int) -> str:
    """
    Use Gemini to outline a learning plan for a skill area (no Search grounding).
    """
    client = get_genai_client()
    prompt = f"""
    Create a {weeks}-week structured learning plan outline for: {skill_area}

    For each week provide:
    - Week theme/focus
    - 3-5 specific topics to cover
    - Recommended resource types
    - Expected outcomes

    Base this on widely accepted learning practices.
    Format as structured text.
    """
    response = await retry_on_rate_limit(
        client.models.generate_content,
        model=settings.gemini_flash_model,
        contents=prompt,
    )
    return response.text
