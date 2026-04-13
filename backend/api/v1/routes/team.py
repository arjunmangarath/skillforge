"""Team routes — skill gap analysis and team management."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from ....db.connection import get_db
from ....db.models import Team, TeamMember
from ....agents.team_agent import get_team_summary, get_team_skill_heatmap
from ..auth import get_current_user

router = APIRouter(prefix="/team", tags=["team"])


class TeamCreateRequest(BaseModel):
    name: str


class AddMemberRequest(BaseModel):
    user_id: str


@router.post("")
async def create_team(
    request: TeamCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Create a new team."""
    team = Team(id=str(uuid.uuid4()), name=request.name, owner_id=current_user["sub"])
    db.add(team)
    member = TeamMember(team_id=team.id, user_id=current_user["sub"])
    db.add(member)
    await db.commit()
    return {"team_id": team.id, "name": team.name}


@router.post("/{team_id}/members")
async def add_member(
    team_id: str,
    request: AddMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Add a member to a team."""
    member = TeamMember(team_id=team_id, user_id=request.user_id)
    db.add(member)
    await db.commit()
    return {"team_id": team_id, "user_id": request.user_id}


@router.get("/{team_id}/gaps")
async def get_gaps(
    team_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Full team analysis: heatmap + gaps + AI remediation plan."""
    return await get_team_summary(db, team_id)


@router.get("/{team_id}/heatmap")
async def get_heatmap(
    team_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get the raw skill heatmap for a team."""
    return await get_team_skill_heatmap(db, team_id)
