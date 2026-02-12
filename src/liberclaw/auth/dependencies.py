"""FastAPI auth dependencies."""

from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from liberclaw.auth.jwt import decode_access_token
from liberclaw.config import LiberClawSettings
from liberclaw.database.models import User
from liberclaw.database.session import get_db

_bearer = HTTPBearer()
_bearer_optional = HTTPBearer(auto_error=False)

# Singleton settings — set by app lifespan
_settings: LiberClawSettings | None = None


def set_settings(settings: LiberClawSettings) -> None:
    global _settings
    _settings = settings


def get_settings() -> LiberClawSettings:
    if _settings is None:
        raise RuntimeError("Settings not initialized")
    return _settings


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Require a valid access token and return the user."""
    settings = get_settings()
    payload = decode_access_token(
        credentials.credentials,
        settings.jwt_secret,
        settings.jwt_algorithm,
    )
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_optional),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Optionally authenticate — returns None if no/invalid token."""
    if not credentials:
        return None
    settings = get_settings()
    payload = decode_access_token(
        credentials.credentials,
        settings.jwt_secret,
        settings.jwt_algorithm,
    )
    if not payload:
        return None

    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
