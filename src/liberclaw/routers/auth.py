"""Auth routes — magic link, OAuth, wallet, token refresh."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from liberclaw.auth.dependencies import get_current_user, get_optional_user, get_settings
from liberclaw.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)
from liberclaw.auth.id_token import verify_apple_id_token, verify_google_id_token
from liberclaw.auth.magic_link import create_magic_link, verify_and_consume_magic_link, verify_code
from liberclaw.auth.oauth import (
    create_github_client,
    create_google_client,
    get_github_user_info,
    get_google_user_info,
)
from liberclaw.auth.wallet import create_challenge, verify_signature
from liberclaw.database.models import (
    OAuthConnection,
    Session,
    User,
    WalletConnection,
)
from liberclaw.database.session import get_db
from liberclaw.schemas.auth import (
    AppleIdTokenRequest,
    GoogleIdTokenRequest,
    GuestRequest,
    MagicLinkRequest,
    MagicLinkResponse,
    MagicLinkVerifyRequest,
    RefreshRequest,
    TokenPair,
    WalletChallengeRequest,
    WalletChallengeResponse,
    WalletVerifyRequest,
)
from liberclaw.services.email import send_magic_link_email

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Helpers ────────────────────────────────────────────────────────────


async def _create_session_and_tokens(
    db: AsyncSession, user: User, device_info: str | None = None
) -> TokenPair:
    """Create a new session and return access + refresh token pair."""
    settings = get_settings()
    session_id = uuid.uuid4()

    access_token = create_access_token(
        user.id, settings.jwt_secret, settings.jwt_algorithm,
        expire_minutes=settings.access_token_expire_minutes,
    )
    refresh_token = create_refresh_token(
        user.id, session_id, settings.jwt_secret, settings.jwt_algorithm,
        expire_days=settings.refresh_token_expire_days,
    )

    session = Session(
        id=session_id,
        user_id=user.id,
        refresh_token_hash=hashlib.sha256(refresh_token.encode()).hexdigest(),
        device_info=device_info,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(session)
    await db.flush()

    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


async def _get_or_create_user_by_email(db: AsyncSession, email: str) -> User:
    """Find user by email or create a new one."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        return user

    user = User(email=email, email_verified=True)
    db.add(user)
    await db.flush()
    return user


async def _link_oauth(
    db: AsyncSession, user_info: dict
) -> User:
    """Find/create user from OAuth info, linking accounts by email."""
    provider = user_info["provider"]
    provider_id = user_info["provider_id"]
    email = user_info.get("email")

    # Check if this OAuth connection already exists
    result = await db.execute(
        select(OAuthConnection).where(
            OAuthConnection.provider == provider,
            OAuthConnection.provider_id == provider_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        result = await db.execute(select(User).where(User.id == existing.user_id))
        return result.scalar_one()

    # Try to find existing user by email for auto-linking
    user = None
    if email:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

    # Create new user if needed
    if not user:
        user = User(
            email=email,
            email_verified=user_info.get("email_verified", False),
            display_name=user_info.get("name"),
            avatar_url=user_info.get("avatar_url"),
        )
        db.add(user)
        await db.flush()

    # Create OAuth connection
    conn = OAuthConnection(
        user_id=user.id,
        provider=provider,
        provider_id=provider_id,
        provider_email=email,
    )
    db.add(conn)
    await db.flush()
    return user


# ── Magic Link ─────────────────────────────────────────────────────────


@router.post("/login/email", response_model=MagicLinkResponse)
async def request_magic_link(
    body: MagicLinkRequest,
    db: AsyncSession = Depends(get_db),
):
    """Request a magic link email."""
    settings = get_settings()
    if not settings.magic_link_secret:
        raise HTTPException(status_code=501, detail="Magic link auth not configured (set LIBERCLAW_MAGIC_LINK_SECRET)")

    token, code = await create_magic_link(db, body.email, settings.magic_link_secret)
    await send_magic_link_email(
        body.email,
        token,
        settings.frontend_url,
        settings.resend_api_key,
        code=code,
        smtp_host=settings.smtp_host,
        smtp_port=settings.smtp_port,
        smtp_user=settings.smtp_user,
        smtp_password=settings.smtp_password,
        smtp_from=settings.smtp_from,
        smtp_use_tls=settings.smtp_use_tls,
    )
    return MagicLinkResponse()


@router.post("/verify-magic-link", response_model=TokenPair)
async def verify_magic_link(
    body: MagicLinkVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Verify a magic link token or 6-digit code and return JWT pair."""
    settings = get_settings()

    email: str | None = None

    if body.token:
        email = await verify_and_consume_magic_link(db, body.token, settings.magic_link_secret)
    elif body.email and body.code:
        email = await verify_code(db, body.email, body.code)
    else:
        raise HTTPException(status_code=400, detail="Provide either token or email+code")

    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    if current_user and current_user.tier == "guest":
        # Check email isn't already taken
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=409, detail="Email already linked to another account")
        current_user.email = email
        current_user.email_verified = True
        current_user.tier = "free"
        user = current_user
    else:
        user = await _get_or_create_user_by_email(db, email)

    device_info = request.headers.get("user-agent", "")[:500]
    return await _create_session_and_tokens(db, user, device_info)


# ── Token Refresh ──────────────────────────────────────────────────────


@router.post("/refresh", response_model=TokenPair)
async def refresh_tokens(
    body: RefreshRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token using rotation (old refresh token is revoked)."""
    settings = get_settings()
    payload = decode_refresh_token(body.refresh_token, settings.jwt_secret, settings.jwt_algorithm)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    session_id = uuid.UUID(payload["sid"])
    token_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()

    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.refresh_token_hash == token_hash,
            Session.revoked_at.is_(None),
            Session.expires_at > datetime.now(timezone.utc),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or revoked")

    # Revoke old session
    session.revoked_at = datetime.now(timezone.utc)

    # Get user
    result = await db.execute(select(User).where(User.id == session.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    device_info = request.headers.get("user-agent", "")[:500]
    return await _create_session_and_tokens(db, user, device_info)


# ── OAuth — Google ─────────────────────────────────────────────────────


@router.get("/oauth/google")
async def oauth_google_redirect():
    """Redirect to Google consent screen."""
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")

    redirect_uri = f"{settings.api_url}/api/v1/auth/oauth/google/callback"
    client = create_google_client(
        settings.google_client_id, settings.google_client_secret, redirect_uri
    )
    uri, _ = client.create_authorization_url(
        "https://accounts.google.com/o/oauth2/v2/auth"
    )
    return RedirectResponse(url=uri)


@router.get("/oauth/google/callback")
async def oauth_google_callback(
    code: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Exchange Google auth code for JWT pair."""
    settings = get_settings()
    redirect_uri = f"{settings.api_url}/api/v1/auth/oauth/google/callback"
    client = create_google_client(
        settings.google_client_id, settings.google_client_secret, redirect_uri
    )

    token = await client.fetch_token(
        url="https://oauth2.googleapis.com/token", code=code
    )
    user_info = await get_google_user_info(client, token)
    user = await _link_oauth(db, user_info)

    device_info = request.headers.get("user-agent", "")[:500]
    tokens = await _create_session_and_tokens(db, user, device_info)

    # Redirect to frontend with tokens
    return RedirectResponse(
        url=f"{settings.frontend_url}/auth/callback?access_token={tokens.access_token}&refresh_token={tokens.refresh_token}"
    )


# ── OAuth — GitHub ─────────────────────────────────────────────────────


@router.get("/oauth/github")
async def oauth_github_redirect():
    """Redirect to GitHub auth screen."""
    settings = get_settings()
    if not settings.github_client_id:
        raise HTTPException(status_code=501, detail="GitHub OAuth not configured")

    redirect_uri = f"{settings.api_url}/api/v1/auth/oauth/github/callback"
    client = create_github_client(
        settings.github_client_id, settings.github_client_secret, redirect_uri
    )
    uri, _ = client.create_authorization_url(
        "https://github.com/login/oauth/authorize"
    )
    return RedirectResponse(url=uri)


@router.get("/oauth/github/callback")
async def oauth_github_callback(
    code: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Exchange GitHub auth code for JWT pair."""
    settings = get_settings()
    redirect_uri = f"{settings.api_url}/api/v1/auth/oauth/github/callback"
    client = create_github_client(
        settings.github_client_id, settings.github_client_secret, redirect_uri
    )

    token = await client.fetch_token(
        url="https://github.com/login/oauth/access_token",
        code=code,
        headers={"Accept": "application/json"},
    )
    user_info = await get_github_user_info(client, token)
    user = await _link_oauth(db, user_info)

    device_info = request.headers.get("user-agent", "")[:500]
    tokens = await _create_session_and_tokens(db, user, device_info)

    return RedirectResponse(
        url=f"{settings.frontend_url}/auth/callback?access_token={tokens.access_token}&refresh_token={tokens.refresh_token}"
    )


# ── Wallet Auth ────────────────────────────────────────────────────────


@router.post("/wallet/challenge", response_model=WalletChallengeResponse)
async def wallet_challenge(
    body: WalletChallengeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Get a challenge nonce for wallet sign-in."""
    result = await create_challenge(db, body.address)
    return WalletChallengeResponse(**result)


@router.post("/wallet/verify", response_model=TokenPair)
async def wallet_verify(
    body: WalletVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Verify wallet signature and return JWT pair."""
    valid = await verify_signature(db, body.address, body.signature, body.nonce)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid signature")

    address = body.address.lower()

    # Find or create user by wallet
    result = await db.execute(
        select(WalletConnection).where(WalletConnection.address == address)
    )
    wallet_conn = result.scalar_one_or_none()

    if wallet_conn:
        result = await db.execute(select(User).where(User.id == wallet_conn.user_id))
        user = result.scalar_one()
    else:
        user = User(display_name=f"{address[:6]}...{address[-4:]}")
        db.add(user)
        await db.flush()

        wallet_conn = WalletConnection(
            user_id=user.id, chain="evm", address=address, is_primary=True
        )
        db.add(wallet_conn)
        await db.flush()

    device_info = request.headers.get("user-agent", "")[:500]
    return await _create_session_and_tokens(db, user, device_info)


# ── Guest Auth ─────────────────────────────────────────────────────


@router.post("/guest", response_model=TokenPair)
async def guest_login(
    body: GuestRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Create or re-login a guest user by device ID."""
    if not body.device_id or len(body.device_id) > 255:
        raise HTTPException(status_code=400, detail="Invalid device ID")

    result = await db.execute(
        select(User).where(User.device_id == body.device_id)
    )
    user = result.scalar_one_or_none()

    if user:
        device_info = request.headers.get("user-agent", "")[:500]
        return await _create_session_and_tokens(db, user, device_info)

    user = User(tier="guest", device_id=body.device_id)
    db.add(user)
    await db.flush()

    device_info = request.headers.get("user-agent", "")[:500]
    return await _create_session_and_tokens(db, user, device_info)


# ── Mobile OAuth — Google ID Token ────────────────────────────────


@router.post("/mobile/google", response_model=TokenPair)
async def mobile_google_login(
    body: GoogleIdTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Verify a Google ID token from native sign-in and return JWT pair."""
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google auth not configured")

    valid_audiences = [
        cid for cid in [
            settings.google_client_id,
            settings.google_android_client_id,
            settings.google_ios_client_id,
        ] if cid
    ]
    claims = await verify_google_id_token(body.id_token, valid_audiences)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid Google ID token")

    email = claims.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email in Google token")

    # If a guest user is upgrading, attach OAuth to their account
    if current_user and current_user.tier == "guest":
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=409, detail="Email already linked to another account")

        # Check if this Google account is already linked to someone
        result = await db.execute(
            select(OAuthConnection).where(
                OAuthConnection.provider == "google",
                OAuthConnection.provider_id == claims["sub"],
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Google account already linked to another user")

        conn = OAuthConnection(
            user_id=current_user.id,
            provider="google",
            provider_id=claims["sub"],
            provider_email=email,
        )
        db.add(conn)
        current_user.tier = "free"
        if not current_user.email:
            current_user.email = email
            current_user.email_verified = True
        if not current_user.display_name:
            current_user.display_name = claims.get("name")
        if not current_user.avatar_url:
            current_user.avatar_url = claims.get("picture")
        await db.flush()

        device_info = request.headers.get("user-agent", "")[:500]
        return await _create_session_and_tokens(db, current_user, device_info)

    # Normal flow — find or create user via OAuth
    user_info = {
        "provider": "google",
        "provider_id": claims["sub"],
        "email": email,
        "email_verified": claims.get("email_verified", False),
        "name": claims.get("name"),
        "avatar_url": claims.get("picture"),
    }
    user = await _link_oauth(db, user_info)

    device_info = request.headers.get("user-agent", "")[:500]
    return await _create_session_and_tokens(db, user, device_info)


# ── Mobile OAuth — Apple ID Token ─────────────────────────────────


@router.post("/mobile/apple", response_model=TokenPair)
async def mobile_apple_login(
    body: AppleIdTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Verify an Apple identity token from native sign-in and return JWT pair."""
    settings = get_settings()

    claims = await verify_apple_id_token(body.identity_token, settings.apple_bundle_id)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid Apple identity token")

    email = claims.get("email")
    apple_sub = claims["sub"]

    # If a guest user is upgrading, attach OAuth to their account
    if current_user and current_user.tier == "guest":
        if email:
            result = await db.execute(select(User).where(User.email == email))
            existing = result.scalar_one_or_none()
            if existing and existing.id != current_user.id:
                raise HTTPException(status_code=409, detail="Email already linked to another account")

        # Check if this Apple account is already linked to someone
        result = await db.execute(
            select(OAuthConnection).where(
                OAuthConnection.provider == "apple",
                OAuthConnection.provider_id == apple_sub,
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Apple account already linked to another user")

        conn = OAuthConnection(
            user_id=current_user.id,
            provider="apple",
            provider_id=apple_sub,
            provider_email=email,
        )
        db.add(conn)
        current_user.tier = "free"
        if email and not current_user.email:
            current_user.email = email
            current_user.email_verified = True
        if not current_user.display_name and body.full_name:
            current_user.display_name = body.full_name
        await db.flush()

        device_info = request.headers.get("user-agent", "")[:500]
        return await _create_session_and_tokens(db, current_user, device_info)

    # Normal flow — find or create user via OAuth
    user_info = {
        "provider": "apple",
        "provider_id": apple_sub,
        "email": email,
        "email_verified": claims.get("email_verified", True),
        "name": body.full_name,
    }
    user = await _link_oauth(db, user_info)

    device_info = request.headers.get("user-agent", "")[:500]
    return await _create_session_and_tokens(db, user, device_info)


# ── Logout ─────────────────────────────────────────────────────────────


@router.post("/logout", status_code=204)
async def logout(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Revoke a single refresh token."""
    token_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()
    result = await db.execute(
        select(Session).where(
            Session.refresh_token_hash == token_hash,
            Session.revoked_at.is_(None),
        )
    )
    session = result.scalar_one_or_none()
    if session:
        session.revoked_at = datetime.now(timezone.utc)


@router.post("/logout/all", status_code=204)
async def logout_all(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke all sessions for the current user."""
    result = await db.execute(
        select(Session).where(
            Session.user_id == user.id,
            Session.revoked_at.is_(None),
        )
    )
    sessions = result.scalars().all()
    now = datetime.now(timezone.utc)
    for s in sessions:
        s.revoked_at = now
