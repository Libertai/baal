"""JWT token creation and validation."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt


def create_access_token(
    user_id: uuid.UUID,
    secret: str,
    algorithm: str = "HS256",
    expire_minutes: int = 15,
) -> str:
    """Create a short-lived access token."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=expire_minutes),
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def create_refresh_token(
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    secret: str,
    algorithm: str = "HS256",
    expire_days: int = 30,
) -> str:
    """Create a long-lived refresh token tied to a session."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "sid": str(session_id),
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days=expire_days),
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def decode_access_token(token: str, secret: str, algorithm: str = "HS256") -> dict | None:
    """Decode and validate an access token. Returns payload or None."""
    try:
        payload = jwt.decode(token, secret, algorithms=[algorithm])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str, secret: str, algorithm: str = "HS256") -> dict | None:
    """Decode and validate a refresh token. Returns payload or None."""
    try:
        payload = jwt.decode(token, secret, algorithms=[algorithm])
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None
