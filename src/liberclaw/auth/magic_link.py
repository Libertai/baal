"""Magic link generation and verification."""

from __future__ import annotations

import hashlib
import random
import secrets
import string
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


def generate_code() -> str:
    """Generate a random 6-digit numeric code."""
    return "".join(random.choices(string.digits, k=6))


async def create_magic_link(
    db: AsyncSession, email: str, secret: str
) -> tuple[str, str]:
    """Create a magic link record and return (token, code)."""
    token = generate_magic_link_token(email, secret)
    token_hash = hash_token(token)
    code = generate_code()
    code_hash_val = hash_token(code)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    link = MagicLink(
        email=email,
        token_hash=token_hash,
        code_hash=code_hash_val,
        expires_at=expires_at,
    )
    db.add(link)
    await db.flush()
    return token, code


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


async def verify_code(
    db: AsyncSession, email: str, code: str
) -> str | None:
    """Verify a 6-digit code. Returns email or None. Max 5 attempts."""
    result = await db.execute(
        select(MagicLink).where(
            MagicLink.email == email,
            MagicLink.used_at.is_(None),
            MagicLink.code_hash.is_not(None),
            MagicLink.expires_at > datetime.now(timezone.utc),
        ).order_by(MagicLink.created_at.desc()).limit(1)
    )
    link = result.scalar_one_or_none()
    if not link:
        return None

    if link.attempts >= 5:
        return None

    link.attempts += 1

    if link.code_hash != hash_token(code):
        return None

    link.used_at = datetime.now(timezone.utc)
    return email
