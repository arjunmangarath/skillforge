"""
Authentication — Google OAuth 2.0 with optional dev-mode bypass.
DEV_MODE=true in .env returns a fixed dev user without requiring a token.
"""
from typing import Optional
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import google.auth
import google.auth.transport.requests
from google.oauth2 import id_token
from ...db.connection import settings

# auto_error=False so missing token returns None instead of 403
security = HTTPBearer(auto_error=False)

DEV_USER = {
    "sub": settings.dev_user_id,
    "email": "dev@skillforge.local",
    "name": "Dev User",
    "picture": "",
    "access_token": "dev-token",
}


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> dict:
    """
    Verify Google ID token. In DEV_MODE, returns a fixed dev user when
    no token is provided so the app works without Google OAuth.
    """
    if credentials is None:
        if settings.dev_mode:
            return DEV_USER
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials

    # Dev-mode bypass: accept the literal string "dev-token"
    if settings.dev_mode and token == "dev-token":
        return DEV_USER

    try:
        request = google.auth.transport.requests.Request()
        id_info = id_token.verify_oauth2_token(
            token,
            request,
            settings.google_client_id,
        )
        if id_info["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
            raise HTTPException(status_code=401, detail="Invalid token issuer")

        return {
            "sub": id_info["sub"],
            "email": id_info["email"],
            "name": id_info.get("name", ""),
            "picture": id_info.get("picture", ""),
            "access_token": token,
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


async def get_or_create_user(db, user_info: dict):
    """Upsert user in AlloyDB after Google login or on dev startup."""
    import uuid
    from sqlalchemy import select
    from ...db.models import User, UserRole

    result = await db.execute(
        select(User).where(User.google_id == user_info["sub"])
    )
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            id=user_info["sub"],   # Use sub as primary key so user_id = sub everywhere
            google_id=user_info["sub"],
            email=user_info["email"],
            name=user_info["name"],
            avatar_url=user_info.get("picture"),
            role=UserRole.learner,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user
