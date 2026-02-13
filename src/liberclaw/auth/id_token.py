"""Verify ID tokens from Google and Apple using their JWKS endpoints."""

from __future__ import annotations

import logging
import time

import httpx
from jose import jwt, JWTError

logger = logging.getLogger(__name__)

_jwks_cache: dict[str, tuple[dict, float]] = {}
_CACHE_TTL = 3600  # 1 hour

GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"


async def _fetch_jwks(url: str) -> dict:
    """Fetch JWKS from a URL with caching."""
    cached = _jwks_cache.get(url)
    if cached and (time.time() - cached[1]) < _CACHE_TTL:
        return cached[0]

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        keys = resp.json()

    _jwks_cache[url] = (keys, time.time())
    return keys


async def verify_google_id_token(id_token: str, client_id: str) -> dict | None:
    """Verify a Google ID token. Returns claims dict or None."""
    try:
        jwks = await _fetch_jwks(GOOGLE_JWKS_URL)
        payload = jwt.decode(
            id_token,
            jwks,
            algorithms=["RS256"],
            audience=client_id,
            issuer=["https://accounts.google.com", "accounts.google.com"],
        )
        return payload
    except (JWTError, httpx.HTTPError) as e:
        logger.warning(f"Google ID token verification failed: {e}")
        return None


async def verify_apple_id_token(identity_token: str, bundle_id: str) -> dict | None:
    """Verify an Apple identity token. Returns claims dict or None."""
    try:
        jwks = await _fetch_jwks(APPLE_JWKS_URL)
        payload = jwt.decode(
            identity_token,
            jwks,
            algorithms=["RS256"],
            audience=bundle_id,
            issuer="https://appleid.apple.com",
        )
        return payload
    except (JWTError, httpx.HTTPError) as e:
        logger.warning(f"Apple ID token verification failed: {e}")
        return None
