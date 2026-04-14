"""Chat route — main entry point for the OrchestratorAgent."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from ....db.connection import get_db
from ....agents.orchestrator import OrchestratorAgent
from ..auth import get_current_user, get_or_create_user

router = APIRouter(prefix="/chat", tags=["chat"])


class HistoryMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[HistoryMessage] = []


class ChatResponse(BaseModel):
    session_id: str
    intent: str
    agents_invoked: list[str]
    message: str
    data: dict


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Send a message to the OrchestratorAgent."""
    await get_or_create_user(db, current_user)
    agent = OrchestratorAgent(
        db=db,
        user_id=current_user["sub"],
        access_token=current_user["access_token"],
    )
    try:
        history = [{"role": h.role, "content": h.content} for h in request.history]
        result = await agent.process(request.message, history=history)
        return ChatResponse(**result)
    except Exception as e:
        err = str(e)
        if "429" in err or "RESOURCE_EXHAUSTED" in err:
            raise HTTPException(
                status_code=429,
                detail="Vertex AI rate limit hit — please wait a few seconds and try again.",
            )
        raise HTTPException(status_code=500, detail=err)
