"""User profile and account management routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from baal_core.encryption import decrypt, encrypt
from liberclaw.auth.dependencies import get_current_user, get_settings
from liberclaw.database.models import ApiKey, OAuthConnection, User, WalletConnection
from liberclaw.database.session import get_db
from liberclaw.schemas.users import (
    ApiKeyCreate,
    ApiKeyResponse,
    ConnectionResponse,
    UserProfile,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfile)
async def get_profile(user: User = Depends(get_current_user)):
    """Get current user's profile."""
    return UserProfile.model_validate(user)


@router.patch("/me", response_model=UserProfile)
async def update_profile(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user profile."""
    if body.display_name is not None:
        user.display_name = body.display_name
    if body.show_tool_calls is not None:
        user.show_tool_calls = body.show_tool_calls
    await db.flush()
    return UserProfile.model_validate(user)


@router.get("/me/connections", response_model=list[ConnectionResponse])
async def list_connections(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all linked auth methods."""
    connections: list[ConnectionResponse] = []

    # OAuth connections
    result = await db.execute(
        select(OAuthConnection).where(OAuthConnection.user_id == user.id)
    )
    for oauth in result.scalars().all():
        connections.append(ConnectionResponse(
            id=oauth.id, type="oauth", provider=oauth.provider,
            email=oauth.provider_email, created_at=oauth.created_at,
        ))

    # Wallet connections
    result = await db.execute(
        select(WalletConnection).where(WalletConnection.user_id == user.id)
    )
    for wallet in result.scalars().all():
        connections.append(ConnectionResponse(
            id=wallet.id, type="wallet", chain=wallet.chain,
            address=wallet.address, created_at=wallet.created_at,
        ))

    return connections


@router.delete("/me/connections/{connection_id}", status_code=204)
async def remove_connection(
    connection_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unlink an auth method (must keep at least 1)."""
    # Count total connections
    oauth_count = await db.scalar(
        select(func.count(OAuthConnection.id)).where(OAuthConnection.user_id == user.id)
    )
    wallet_count = await db.scalar(
        select(func.count(WalletConnection.id)).where(WalletConnection.user_id == user.id)
    )
    has_email = user.email is not None and user.email_verified
    total = (oauth_count or 0) + (wallet_count or 0) + (1 if has_email else 0)

    if total <= 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot remove last authentication method",
        )

    # Try OAuth first
    result = await db.execute(
        select(OAuthConnection).where(
            OAuthConnection.id == connection_id, OAuthConnection.user_id == user.id
        )
    )
    oauth = result.scalar_one_or_none()
    if oauth:
        await db.delete(oauth)
        return

    # Try wallet
    result = await db.execute(
        select(WalletConnection).where(
            WalletConnection.id == connection_id, WalletConnection.user_id == user.id
        )
    )
    wallet = result.scalar_one_or_none()
    if wallet:
        await db.delete(wallet)
        return

    raise HTTPException(status_code=404, detail="Connection not found")


# ── API Keys ───────────────────────────────────────────────────────────


@router.post("/me/api-keys", response_model=ApiKeyResponse, status_code=201)
async def add_api_key(
    body: ApiKeyCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a LibertAI API key."""
    settings = get_settings()
    encrypted = encrypt(body.key, settings.encryption_key)

    key = ApiKey(
        user_id=user.id,
        encrypted_key=encrypted,
        label=body.label,
    )
    db.add(key)
    await db.flush()

    masked = body.key[:8] + "..." + body.key[-4:]
    return ApiKeyResponse(
        id=key.id, label=key.label, masked_key=masked,
        is_active=key.is_active, created_at=key.created_at,
    )


@router.get("/me/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List API keys (masked)."""
    settings = get_settings()
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id).order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()
    responses = []
    for key in keys:
        try:
            decrypted = decrypt(key.encrypted_key, settings.encryption_key)
            masked = decrypted[:8] + "..." + decrypted[-4:]
        except Exception:
            masked = "***"
        responses.append(ApiKeyResponse(
            id=key.id, label=key.label, masked_key=masked,
            is_active=key.is_active, created_at=key.created_at,
        ))
    return responses


@router.delete("/me/api-keys/{key_id}", status_code=204)
async def remove_api_key(
    key_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an API key."""
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user.id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    await db.delete(key)
