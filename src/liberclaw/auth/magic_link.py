"""Magic link generation and verification."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from liberclaw.database.models import MagicLink


def _make_serializer(secret: str) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(secret)


def generate_magic_link_token(email: str, secret: str) -> str:
    """Generate a signed magic link token for an email."""
    s = _make_serializer(secret)
    return s.dumps(email, salt="magic-link")


def verify_magic_link_token(token: str, secret: str, max_age: int = 900) -> str | None:
    """Verify a magic link token. Returns email or None."""
    s = _make_serializer(secret)
    try:
        email = s.loads(token, salt="magic-link", max_age=max_age)
        return email
    except (BadSignature, SignatureExpired):
        return None


def hash_token(token: str) -> str:
    """SHA-256 hash a token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


async def create_magic_link(
    db: AsyncSession, email: str, secret: str
) -> str:
    """Create a magic link record and return the token."""
    token = generate_magic_link_token(email, secret)
    token_hash = hash_token(token)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    link = MagicLink(
        email=email,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(link)
    await db.flush()
    return token


async def verify_and_consume_magic_link(
    db: AsyncSession, token: str, secret: str
) -> str | None:
    """Verify a magic link token and mark it as used. Returns email or None."""
    # First verify signature
    email = verify_magic_link_token(token, secret)
    if not email:
        return None

    # Check DB record hasn't been used
    token_hash = hash_token(token)
    result = await db.execute(
        select(MagicLink).where(
            MagicLink.token_hash == token_hash,
            MagicLink.used_at.is_(None),
            MagicLink.expires_at > datetime.now(timezone.utc),
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        return None

    # Mark as used
    link.used_at = datetime.now(timezone.utc)
    return email
