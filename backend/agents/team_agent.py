"""TeamAgent — analyzes team skill gaps and generates remediation plans."""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from ..db.models import TeamMember, Goal, ProgressLog, LearningPath, PathItem
from ..db.connection import settings, get_genai_client, retry_on_rate_limit
from google.genai import types


SYSTEM_PROMPT = """You are TeamAgent, a specialist in team skill development and gap analysis.

Your responsibilities:
1. Aggregate individual progress data across a team
2. Identify skill gaps against industry benchmarks
3. Generate team-level learning plans
4. Prioritize gaps by business impact
5. Recommend optimal team learning approaches

Be strategic and data-driven. Focus on actionable gaps that can be closed within 90 days."""


async def get_team_skill_heatmap(
    db: AsyncSession,
    team_id: str,
) -> dict:
    """
    Generate a skill heatmap for the team.
    Returns: {member: {skill_area: completion_pct}}
    """
    # Get all team members
    members_result = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team_id)
    )
    members = members_result.scalars().all()

    heatmap = {}
    all_skill_areas = set()

    for member in members:
        # Get all goals for this member
        goals_result = await db.execute(
            select(Goal).where(Goal.user_id == member.user_id, Goal.status == "active")
        )
        goals = goals_result.scalars().all()

        member_skills = {}
        for goal in goals:
            all_skill_areas.add(goal.skill_area)

            # Calculate completion for this skill area
            progress_result = await db.execute(
                select(func.avg(ProgressLog.completion_pct))
                .join(PathItem, ProgressLog.path_item_id == PathItem.id)
                .join(LearningPath, PathItem.path_id == LearningPath.id)
                .where(
                    LearningPath.goal_id == goal.id,
                    ProgressLog.user_id == member.user_id,
                )
            )
            avg_completion = progress_result.scalar() or 0
            member_skills[goal.skill_area] = round(avg_completion, 1)

        heatmap[member.user_id] = member_skills

    return {
        "heatmap": heatmap,
        "skill_areas": list(all_skill_areas),
        "team_id": team_id,
    }


async def identify_skill_gaps(
    db: AsyncSession,
    team_id: str,
    threshold: float = 60.0,
) -> list[dict]:
    """
    Identify skills where team average completion is below threshold.
    Returns list of gaps with severity and affected members.
    """
    heatmap_data = await get_team_skill_heatmap(db, team_id)
    heatmap = heatmap_data["heatmap"]
    skill_areas = heatmap_data["skill_areas"]

    gaps = []
    for skill in skill_areas:
        completions = [
            member_data.get(skill, 0)
            for member_data in heatmap.values()
            if skill in member_data
        ]
        if not completions:
            continue

        avg = sum(completions) / len(completions)
        if avg < threshold:
            affected = [
                uid for uid, skills in heatmap.items()
                if skills.get(skill, 0) < threshold
            ]
            gaps.append({
                "skill_area": skill,
                "team_avg_completion": round(avg, 1),
                "gap_severity": "critical" if avg < 30 else "moderate" if avg < 50 else "low",
                "affected_member_count": len(affected),
                "affected_user_ids": affected,
            })

    return sorted(gaps, key=lambda x: x["team_avg_completion"])


async def generate_team_learning_plan(
    db: AsyncSession,  # noqa: ARG001
    team_id: str,  # noqa: ARG001
    gaps: list[dict],
) -> str:
    """Use Gemini to generate a team learning plan based on identified gaps."""
    import json
    client = get_genai_client()
    prompt = f"""
    Team skill gaps identified:
    {json.dumps(gaps, indent=2)}

    Generate a 90-day team learning plan that:
    1. Addresses gaps in priority order (critical first)
    2. Recommends team learning formats (workshops, paired learning, courses)
    3. Sets measurable milestones for each gap
    4. Suggests specific resources for each skill area

    Format as a clear, actionable plan with phases.
    """

    response = await retry_on_rate_limit(
        client.models.generate_content,
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
    )
    return response.text


async def get_team_summary(db: AsyncSession, team_id: str) -> dict:
    """Full team analysis: heatmap + gaps + AI plan."""
    heatmap_data = await get_team_skill_heatmap(db, team_id)
    gaps = await identify_skill_gaps(db, team_id)
    plan = await generate_team_learning_plan(db, team_id, gaps) if gaps else None

    return {
        "heatmap": heatmap_data,
        "gaps": gaps,
        "remediation_plan": plan,
        "critical_gap_count": sum(1 for g in gaps if g["gap_severity"] == "critical"),
    }
