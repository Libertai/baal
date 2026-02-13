# Mobile Auth & Guest Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix mobile login (native Google/Apple sign-in, 6-digit magic link codes) and add guest mode with device-ID-based anti-abuse.

**Architecture:** Backend gets 3 new auth endpoints (guest, mobile/google, mobile/apple) and an updated verify endpoint (accepts 6-digit codes). Frontend login screen is platform-aware: native sign-in buttons on mobile, browser OAuth on web, guest mode on mobile only. Guest users are real `User` rows with `tier="guest"` and tight quotas.

**Tech Stack:** FastAPI + python-jose (RS256 JWKS verification), Expo + expo-apple-authentication + @react-native-google-signin/google-signin + expo-application, Alembic (PostgreSQL migration).

**Design doc:** `docs/plans/2026-02-13-mobile-auth-guest-mode-design.md`

---

### Task 1: Alembic Migration — add device_id and magic link code columns

**Files:**
- Create: `src/liberclaw/database/migrations/versions/002_mobile_auth_guest.py`
- Modify: `src/liberclaw/database/models.py:33-55` (User model) and `src/liberclaw/database/models.py:104-112` (MagicLink model)

**Step 1: Update the User model**

Add `device_id` column to the `User` class in `src/liberclaw/database/models.py` after line 44 (`tier`):

```python
device_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
```

**Step 2: Update the MagicLink model**

Add `code_hash` and `attempts` columns to `MagicLink` in `src/liberclaw/database/models.py` after line 111 (`used_at`):

```python
code_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
attempts: Mapped[int] = mapped_column(Integer, default=0)
```

**Step 3: Generate the Alembic migration**

Run: `uv run alembic revision --autogenerate -m "Add device_id to users, code_hash and attempts to magic_links"`

Review the generated migration file. It should contain:
- `op.add_column("users", sa.Column("device_id", sa.String(255), nullable=True))`
- `op.create_unique_constraint(...)` on `users.device_id`
- `op.add_column("magic_links", sa.Column("code_hash", sa.String(64), nullable=True))`
- `op.add_column("magic_links", sa.Column("attempts", sa.Integer(), server_default="0"))`

Edit if needed so the revision ID is `002` and `down_revision = "001"`.

**Step 4: Run the migration**

Run: `uv run alembic upgrade head`
Expected: migration applies cleanly.

**Step 5: Commit**

```bash
git add src/liberclaw/database/models.py src/liberclaw/database/migrations/versions/002_mobile_auth_guest.py
git commit -m "feat: add device_id to users, code fields to magic_links (migration 002)"
```

---

### Task 2: Guest Auth Endpoint

**Files:**
- Modify: `src/liberclaw/schemas/auth.py` — add `GuestRequest` schema
- Modify: `src/liberclaw/routers/auth.py` — add `POST /auth/guest` endpoint
- Modify: `src/liberclaw/config.py` — add guest tier limits

**Step 1: Add guest tier settings to config**

In `src/liberclaw/config.py`, add after `max_agents_per_user` (line 67):

```python
# Guest tier limits
guest_daily_messages: int = 5
guest_max_agents: int = 1
```

**Step 2: Add the GuestRequest schema**

In `src/liberclaw/schemas/auth.py`, add:

```python
class GuestRequest(BaseModel):
    device_id: str
```

**Step 3: Add the guest endpoint**

In `src/liberclaw/routers/auth.py`, add the import for `GuestRequest` in the schema imports, then add the endpoint:

```python
@router.post("/guest", response_model=TokenPair)
async def guest_login(
    body: GuestRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Create or re-login a guest user by device ID."""
    if not body.device_id or len(body.device_id) > 255:
        raise HTTPException(status_code=400, detail="Invalid device ID")

    # Check for existing guest with this device_id
    result = await db.execute(
        select(User).where(User.device_id == body.device_id)
    )
    user = result.scalar_one_or_none()

    if user:
        # Re-login existing guest (or upgraded user — still works)
        device_info = request.headers.get("user-agent", "")[:500]
        return await _create_session_and_tokens(db, user, device_info)

    # Create new guest user
    user = User(tier="guest", device_id=body.device_id)
    db.add(user)
    await db.flush()

    device_info = request.headers.get("user-agent", "")[:500]
    return await _create_session_and_tokens(db, user, device_info)
```

**Step 4: Make quota enforcement tier-aware**

In `src/liberclaw/routers/chat.py`, change the rate limit call (line 41-43) to use tier-based limits:

```python
# Rate limiting — tier-aware
daily_limit = (
    settings.guest_daily_messages if user.tier == "guest"
    else settings.free_tier_daily_messages
)
allowed, remaining = await check_and_increment(db, user.id, daily_limit)
```

In `src/liberclaw/routers/agents.py`, change the agent limit check (line 63-64) to use tier-based limits:

```python
# Check agent limit — tier-aware
agent_limit = (
    settings.guest_max_agents if user.tier == "guest"
    else settings.max_agents_per_user
)
count = await get_agent_count(db, user.id)
if count >= agent_limit:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Agent limit reached ({agent_limit})",
    )
```

Also update the usage summary in `src/liberclaw/routers/usage.py` (line 27-33) to return tier-aware limits:

```python
daily_limit = (
    settings.guest_daily_messages if user.tier == "guest"
    else settings.free_tier_daily_messages
)
agent_limit = (
    settings.guest_max_agents if user.tier == "guest"
    else settings.max_agents_per_user
)

return UsageSummary(
    daily_messages_used=daily_used,
    daily_messages_limit=daily_limit,
    agent_count=agent_count,
    agent_limit=agent_limit,
    tier=user.tier,
)
```

**Step 5: Test manually**

Run: `uv run uvicorn liberclaw.main:app --reload`

```bash
curl -X POST http://localhost:8000/api/v1/auth/guest \
  -H "Content-Type: application/json" \
  -d '{"device_id": "test-device-123"}'
```

Expected: 200 with `{"access_token": "...", "refresh_token": "...", ...}`

Run the same command again — should return tokens for the same user (re-login).

**Step 6: Commit**

```bash
git add src/liberclaw/config.py src/liberclaw/schemas/auth.py src/liberclaw/routers/auth.py src/liberclaw/routers/chat.py src/liberclaw/routers/agents.py src/liberclaw/routers/usage.py
git commit -m "feat: add guest auth endpoint with tier-aware quotas"
```

---

### Task 3: 6-Digit Magic Link Code

**Files:**
- Modify: `src/liberclaw/auth/magic_link.py` — generate and verify 6-digit codes
- Modify: `src/liberclaw/services/email.py` — include code in email
- Modify: `src/liberclaw/schemas/auth.py` — update verify request schema
- Modify: `src/liberclaw/routers/auth.py` — update verify endpoint

**Step 1: Update magic_link.py to generate and verify codes**

In `src/liberclaw/auth/magic_link.py`, add code generation to `create_magic_link()` and a new `verify_code()` function:

```python
import random
import string

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
    code_hash = hash_token(code)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    link = MagicLink(
        email=email,
        token_hash=token_hash,
        code_hash=code_hash,
        expires_at=expires_at,
    )
    db.add(link)
    await db.flush()
    return token, code


async def verify_code(
    db: AsyncSession, email: str, code: str
) -> str | None:
    """Verify a 6-digit code for an email. Returns email or None.

    Increments attempt counter on each call. Returns None after 5 failed attempts.
    """
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
```

Note: `create_magic_link` now returns a tuple `(token, code)` instead of just `token`. Update all callers.

**Step 2: Update the verify request schema**

In `src/liberclaw/schemas/auth.py`, change `MagicLinkVerifyRequest`:

```python
class MagicLinkVerifyRequest(BaseModel):
    token: str | None = None
    email: EmailStr | None = None
    code: str | None = None
```

**Step 3: Update the auth router**

In `src/liberclaw/routers/auth.py`:

Update the `request_magic_link` endpoint to handle the new tuple return:

```python
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
```

Update the `verify_magic_link` endpoint to accept either token or code:

```python
@router.post("/verify-magic-link", response_model=TokenPair)
async def verify_magic_link(
    body: MagicLinkVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Verify a magic link token or 6-digit code and return JWT pair."""
    settings = get_settings()

    email: str | None = None

    if body.token:
        email = await verify_and_consume_magic_link(db, body.token, settings.magic_link_secret)
    elif body.email and body.code:
        from liberclaw.auth.magic_link import verify_code
        email = await verify_code(db, body.email, body.code)
    else:
        raise HTTPException(status_code=400, detail="Provide either token or email+code")

    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    user = await _get_or_create_user_by_email(db, email)
    device_info = request.headers.get("user-agent", "")[:500]
    return await _create_session_and_tokens(db, user, device_info)
```

Add `verify_code` to the imports from `liberclaw.auth.magic_link` at the top of the file.

**Step 4: Update the email template**

In `src/liberclaw/services/email.py`, update `_build_html` and `send_magic_link_email` to include the code:

```python
def _build_html(verify_url: str, code: str = "") -> str:
    code_section = ""
    if code:
        code_section = (
            '<p style="font-size: 24px; font-weight: bold; letter-spacing: 8px; '
            f'text-align: center; margin: 20px 0;">{code}</p>'
            '<p style="text-align: center; color: #666;">Enter this code in the app</p>'
            '<p style="text-align: center; color: #666;">— or —</p>'
        )
    return (
        "<h2>Sign in to LiberClaw</h2>"
        f"{code_section}"
        f'<p><a href="{verify_url}">Click here to sign in</a></p>'
        "<p>This link and code expire in 15 minutes.</p>"
        "<p>If you didn't request this, you can safely ignore this email.</p>"
    )
```

Add `code` parameter to `send_magic_link_email` and pass it through to `_build_html`, `_send_smtp`, and `_send_resend`. Also log it in the dev fallback.

**Step 5: Test manually**

Run: `uv run uvicorn liberclaw.main:app --reload`

```bash
# Request magic link (check server logs for code in dev mode)
curl -X POST http://localhost:8000/api/v1/auth/login/email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Verify with code (use the code from logs)
curl -X POST http://localhost:8000/api/v1/auth/verify-magic-link \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "code": "123456"}'
```

Expected: 200 with `TokenPair` on correct code, 400 on wrong code, 400 after 5 attempts.

**Step 6: Commit**

```bash
git add src/liberclaw/auth/magic_link.py src/liberclaw/services/email.py src/liberclaw/schemas/auth.py src/liberclaw/routers/auth.py
git commit -m "feat: add 6-digit code verification for magic links"
```

---

### Task 4: Google ID Token Verification Endpoint

**Files:**
- Create: `src/liberclaw/auth/id_token.py` — shared JWKS verification for Google/Apple
- Modify: `src/liberclaw/schemas/auth.py` — add `GoogleIdTokenRequest`
- Modify: `src/liberclaw/routers/auth.py` — add `POST /auth/mobile/google`

**Step 1: Create ID token verifier**

Create `src/liberclaw/auth/id_token.py`:

```python
"""Verify ID tokens from Google and Apple using their JWKS endpoints."""

from __future__ import annotations

import logging
import time

import httpx
from jose import jwt, JWTError

logger = logging.getLogger(__name__)

# JWKS cache: {url: (keys, fetch_time)}
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


async def verify_google_id_token(
    id_token: str, client_id: str
) -> dict | None:
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


async def verify_apple_id_token(
    identity_token: str, bundle_id: str
) -> dict | None:
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
```

**Step 2: Add config for Apple bundle ID**

In `src/liberclaw/config.py`, add after `github_client_secret` (line 37):

```python
# Apple Sign In
apple_bundle_id: str = "io.libertai.liberclaw"
```

**Step 3: Add the request schema**

In `src/liberclaw/schemas/auth.py`, add:

```python
class GoogleIdTokenRequest(BaseModel):
    id_token: str

class AppleIdTokenRequest(BaseModel):
    identity_token: str
    full_name: str | None = None
```

**Step 4: Add the Google endpoint**

In `src/liberclaw/routers/auth.py`, add import for `verify_google_id_token` from `liberclaw.auth.id_token` and `GoogleIdTokenRequest` from schemas, then:

```python
@router.post("/mobile/google", response_model=TokenPair)
async def mobile_google_login(
    body: GoogleIdTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Verify a Google ID token from native sign-in and return JWT pair."""
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google auth not configured")

    claims = await verify_google_id_token(body.id_token, settings.google_client_id)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid Google ID token")

    email = claims.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email in Google token")

    # Use the existing OAuth linking logic
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
```

**Step 5: Test manually**

This requires a real Google ID token, so just verify the endpoint exists and rejects invalid tokens:

```bash
curl -X POST http://localhost:8000/api/v1/auth/mobile/google \
  -H "Content-Type: application/json" \
  -d '{"id_token": "fake-token"}'
```

Expected: 401 "Invalid Google ID token"

**Step 6: Commit**

```bash
git add src/liberclaw/auth/id_token.py src/liberclaw/config.py src/liberclaw/schemas/auth.py src/liberclaw/routers/auth.py
git commit -m "feat: add Google ID token verification endpoint for native mobile sign-in"
```

---

### Task 5: Apple ID Token Verification Endpoint

**Files:**
- Modify: `src/liberclaw/routers/auth.py` — add `POST /auth/mobile/apple`

**Step 1: Add the Apple endpoint**

In `src/liberclaw/routers/auth.py`, add import for `verify_apple_id_token` and `AppleIdTokenRequest`, then:

```python
@router.post("/mobile/apple", response_model=TokenPair)
async def mobile_apple_login(
    body: AppleIdTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Verify an Apple identity token from native sign-in and return JWT pair."""
    settings = get_settings()

    claims = await verify_apple_id_token(body.identity_token, settings.apple_bundle_id)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid Apple identity token")

    email = claims.get("email")  # May be a relay address like xxx@privaterelay.appleid.com
    apple_sub = claims["sub"]    # Stable Apple user ID

    # Use OAuth linking — Apple's "sub" is the stable provider_id
    user_info = {
        "provider": "apple",
        "provider_id": apple_sub,
        "email": email,
        "email_verified": claims.get("email_verified", True),  # Apple emails are always verified
        "name": body.full_name,
    }
    user = await _link_oauth(db, user_info)

    device_info = request.headers.get("user-agent", "")[:500]
    return await _create_session_and_tokens(db, user, device_info)
```

**Step 2: Test manually**

```bash
curl -X POST http://localhost:8000/api/v1/auth/mobile/apple \
  -H "Content-Type: application/json" \
  -d '{"identity_token": "fake-token"}'
```

Expected: 401 "Invalid Apple identity token"

**Step 3: Commit**

```bash
git add src/liberclaw/routers/auth.py
git commit -m "feat: add Apple identity token verification endpoint for native mobile sign-in"
```

---

### Task 6: Guest Upgrade Flow

**Files:**
- Modify: `src/liberclaw/routers/auth.py` — update `_link_oauth` and `_get_or_create_user_by_email` to handle guest upgrade

**Step 1: Update `_get_or_create_user_by_email` for guest upgrade**

When a guest user (identified by the current session) verifies an email, we want to attach that email to the guest user instead of creating a new one. The verify endpoint already gets the email from the magic link — but we need to check if the request comes from an authenticated guest.

Add a helper and update the verify endpoint:

```python
async def _upgrade_guest_if_needed(
    db: AsyncSession, user: User, email: str | None = None
) -> None:
    """If user is a guest, upgrade to free tier."""
    if user.tier != "guest":
        return
    user.tier = "free"
    if email and not user.email:
        user.email = email
        user.email_verified = True
```

Then in the `mobile_google_login` and `mobile_apple_login` endpoints, after `user = await _link_oauth(db, user_info)`, check if the current request has a valid Bearer token for a guest user. If so, merge:

Actually, simpler approach: the `_link_oauth` function already handles finding/creating users. For guest upgrade, the flow is:

1. Guest is logged in → hits "Continue with Google" → app sends the Google ID token along with the existing access token
2. Backend checks: if the request includes a valid guest session, attach the OAuth to that guest user instead of creating a new one

Update the Google and Apple endpoints to accept an optional Bearer token:

```python
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

    claims = await verify_google_id_token(body.id_token, settings.google_client_id)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid Google ID token")

    email = claims.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email in Google token")

    # If a guest user is upgrading, attach OAuth to their account
    if current_user and current_user.tier == "guest":
        # Check email isn't already taken by another user
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=409, detail="Email already linked to another account")

        # Attach to guest user
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
```

Apply the same pattern to the Apple endpoint and the magic link verify endpoint (check `get_optional_user`, upgrade guest if present).

**Step 2: Update magic link verify for guest upgrade**

In the `verify_magic_link` endpoint, add `current_user: User | None = Depends(get_optional_user)`:

```python
if email:
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
```

**Step 3: Add `get_optional_user` import**

Make sure `get_optional_user` is imported at the top of `src/liberclaw/routers/auth.py` from `liberclaw.auth.dependencies`.

**Step 4: Test manually**

1. Create a guest: `POST /auth/guest` with `device_id`
2. Use the guest's access token to call `POST /auth/mobile/google` with a valid ID token
3. Verify the user's tier changed from "guest" to "free"

**Step 5: Commit**

```bash
git add src/liberclaw/routers/auth.py
git commit -m "feat: add guest-to-authenticated upgrade flow for Google, Apple, and magic link"
```

---

### Task 7: Frontend — Install Dependencies & Configure

**Files:**
- Modify: `apps/liberclaw/package.json` — add dependencies
- Modify: `apps/liberclaw/app.json` — add Apple Sign In + Google config plugin

**Step 1: Install npm packages**

```bash
cd apps/liberclaw
npx expo install expo-apple-authentication expo-application @react-native-google-signin/google-signin
```

**Step 2: Update app.json**

Add to `ios`:
```json
"usesAppleSignIn": true
```

Add to `plugins`:
```json
"@react-native-google-signin/google-signin"
```

**Step 3: Commit**

```bash
git add apps/liberclaw/package.json apps/liberclaw/package-lock.json apps/liberclaw/app.json
git commit -m "feat: add expo-apple-authentication, google-signin, expo-application deps"
```

---

### Task 8: Frontend — Auth API Functions

**Files:**
- Modify: `apps/liberclaw/lib/api/auth.ts` — add guest login, code verify, native sign-in API calls

**Step 1: Add new API functions**

In `apps/liberclaw/lib/api/auth.ts`, add:

```typescript
/**
 * Start as guest using a device fingerprint.
 */
export async function guestLogin(deviceId: string): Promise<TokenPair> {
  return apiFetch<TokenPair>("/auth/guest", {
    method: "POST",
    body: JSON.stringify({ device_id: deviceId }),
    noAuth: true,
  });
}

/**
 * Verify a 6-digit magic link code.
 */
export async function verifyMagicLinkCode(
  email: string,
  code: string,
): Promise<TokenPair> {
  return apiFetch<TokenPair>("/auth/verify-magic-link", {
    method: "POST",
    body: JSON.stringify({ email, code }),
    noAuth: true,
  });
}

/**
 * Authenticate with a Google ID token from native sign-in.
 */
export async function mobileGoogleLogin(idToken: string): Promise<TokenPair> {
  return apiFetch<TokenPair>("/auth/mobile/google", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
    noAuth: true,
  });
}

/**
 * Authenticate with an Apple identity token from native sign-in.
 */
export async function mobileAppleLogin(
  identityToken: string,
  fullName?: string,
): Promise<TokenPair> {
  return apiFetch<TokenPair>("/auth/mobile/apple", {
    method: "POST",
    body: JSON.stringify({ identity_token: identityToken, full_name: fullName }),
    noAuth: true,
  });
}
```

**Step 2: Update verifyMagicLink to pass email+code**

The existing `verifyMagicLink` function sends `{ token }`. Keep it as-is (it still works for web). The new `verifyMagicLinkCode` handles the 6-digit flow.

**Step 3: Commit**

```bash
git add apps/liberclaw/lib/api/auth.ts
git commit -m "feat: add guest, code verify, and native sign-in API functions"
```

---

### Task 9: Frontend — Rewrite Mobile Login Screen

**Files:**
- Modify: `apps/liberclaw/app/(auth)/login.tsx` — platform-aware login with native buttons

**Step 1: Rewrite the login screen**

Replace `apps/liberclaw/app/(auth)/login.tsx` with a platform-aware version:

- **Web**: Keep existing magic link + OAuth buttons (unchanged)
- **iOS**: "Sign in with Apple" button (native) + email/code + "Start as guest"
- **Android**: "Continue with Google" button (native) + email/code + "Start as guest"

Key logic:
```typescript
import { Platform } from "react-native";
import * as Application from "expo-application";
import { guestLogin, mobileGoogleLogin, mobileAppleLogin } from "@/lib/api/auth";

const isWeb = Platform.OS === "web";
const isIOS = Platform.OS === "ios";
const isAndroid = Platform.OS === "android";

// Google One Tap (Android)
async function handleGoogleSignIn() {
  const { GoogleOneTapSignIn } = await import("@react-native-google-signin/google-signin");
  const response = await GoogleOneTapSignIn.signIn();
  if (response.type === "success" && response.data.idToken) {
    const tokens = await mobileGoogleLogin(response.data.idToken);
    await login(tokens);
    router.replace("/(tabs)");
  }
}

// Apple Sign In (iOS)
async function handleAppleSignIn() {
  const AppleAuth = await import("expo-apple-authentication");
  const credential = await AppleAuth.signInAsync({
    requestedScopes: [
      AppleAuth.AppleAuthenticationScope.FULL_NAME,
      AppleAuth.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (credential.identityToken) {
    const fullName = credential.fullName
      ? `${credential.fullName.givenName ?? ""} ${credential.fullName.familyName ?? ""}`.trim()
      : undefined;
    const tokens = await mobileAppleLogin(credential.identityToken, fullName || undefined);
    await login(tokens);
    router.replace("/(tabs)");
  }
}

// Guest mode
async function handleGuestLogin() {
  let deviceId: string;
  if (isAndroid) {
    deviceId = Application.androidId ?? `android-${Date.now()}`;
  } else {
    deviceId = await Application.getIosIdForVendorsAsync() ?? `ios-${Date.now()}`;
  }
  const tokens = await guestLogin(deviceId);
  await login(tokens);
  router.replace("/(tabs)");
}
```

For the email flow on mobile, change the button text from "Send Magic Link" to "Send Code" (the backend now generates both).

Render conditionally:
- `{isAndroid && <GoogleSignInButton />}`
- `{isIOS && <AppleSignInButton />}`
- `{isWeb && <WebOAuthButtons />}` (existing Google + GitHub buttons)
- Email input + "Send Code" button (all platforms)
- `{!isWeb && <GuestButton />}`

**Step 2: Commit**

```bash
git add apps/liberclaw/app/\(auth\)/login.tsx
git commit -m "feat: platform-aware login screen with native Google/Apple sign-in and guest mode"
```

---

### Task 10: Frontend — Update Magic Link Screen for 6-Digit Code

**Files:**
- Modify: `apps/liberclaw/app/(auth)/magic-link.tsx` — 6-digit numeric input

**Step 1: Update the magic link screen**

In `apps/liberclaw/app/(auth)/magic-link.tsx`:

- Change placeholder from "Enter code" to "000000"
- Add `keyboardType="number-pad"` and `maxLength={6}`
- Use `verifyMagicLinkCode(email, code)` instead of `verifyMagicLink(token)` when the user enters a 6-digit code
- Keep the existing `verifyMagicLink(token)` path for when a full token is entered (web deep link fallback)

```typescript
import { verifyMagicLinkCode, verifyMagicLink } from "@/lib/api/auth";

const handleVerify = async () => {
  if (!token.trim()) return;
  setLoading(true);
  setError(null);
  try {
    let data: TokenPair;
    // If it's exactly 6 digits, use code verification
    if (/^\d{6}$/.test(token.trim()) && email) {
      data = await verifyMagicLinkCode(email, token.trim());
    } else {
      data = await verifyMagicLink(token.trim());
    }
    await login(data);
    router.replace("/(tabs)");
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : "Something went wrong");
  } finally {
    setLoading(false);
  }
};
```

Update the TextInput:
```tsx
<TextInput
  className="border border-surface-border rounded-lg px-4 py-3 mb-4 text-2xl text-center tracking-[12px] text-text-primary bg-surface-raised font-mono"
  placeholder="000000"
  placeholderTextColor="#5a5464"
  keyboardType="number-pad"
  maxLength={6}
  autoCapitalize="none"
  autoCorrect={false}
  value={token}
  onChangeText={setToken}
/>
```

Update the label text from "Or enter the code from your email:" to "Enter the 6-digit code from your email:".

**Step 2: Commit**

```bash
git add apps/liberclaw/app/\(auth\)/magic-link.tsx
git commit -m "feat: update magic link screen for 6-digit code entry"
```

---

### Task 11: Frontend — Guest Upgrade Banner

**Files:**
- Modify: `apps/liberclaw/app/(tabs)/index.tsx` or `apps/liberclaw/app/(tabs)/profile.tsx` — add upgrade nudge for guests

**Step 1: Add a simple upgrade banner component**

In the agents dashboard or profile screen, when `user.tier === "guest"`, show a subtle banner:

```tsx
{user?.tier === "guest" && (
  <TouchableOpacity
    className="bg-claw-orange/10 border border-claw-orange/25 rounded-lg p-3 mx-4 mb-4 flex-row items-center justify-between"
    onPress={() => router.push("/(auth)/login")}
  >
    <Text className="text-claw-orange text-sm flex-1">
      Sign in to unlock more agents and messages
    </Text>
    <Text className="text-claw-orange font-semibold text-sm ml-2">
      Sign in →
    </Text>
  </TouchableOpacity>
)}
```

**Step 2: Commit**

```bash
git add apps/liberclaw/app/\(tabs\)/index.tsx
git commit -m "feat: add guest upgrade banner on agents dashboard"
```

---

### Task 12: Configure Google Sign-In

**Files:**
- Create: `apps/liberclaw/google-services.json` (Android, from Firebase/Google Cloud Console) — gitignored
- Modify: `apps/liberclaw/app.json` — add webClientId

**This task requires external setup:**

1. Go to Google Cloud Console → APIs & Credentials
2. Create an OAuth 2.0 Web Client ID (this is the `webClientId` used by the native SDK)
3. Create an Android OAuth Client ID with your package name (`io.libertai.liberclaw`) and SHA-1 fingerprint
4. For iOS, create an iOS OAuth Client ID with your bundle ID

In `apps/liberclaw/app.json`, update the Google Sign-In plugin config:

```json
["@react-native-google-signin/google-signin", {
  "webClientId": "<YOUR_WEB_CLIENT_ID>"
}]
```

Configure `GoogleOneTapSignIn.configure()` in the app initialization (e.g., in `_layout.tsx`):

```typescript
import { GoogleOneTapSignIn } from "@react-native-google-signin/google-signin";

GoogleOneTapSignIn.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
});
```

**Note:** This task is blocked on having Google Cloud credentials. Skip if not yet available — the rest of the auth flow works without it.

**Commit when ready:**

```bash
git add apps/liberclaw/app.json apps/liberclaw/app/_layout.tsx
git commit -m "feat: configure Google One Tap sign-in"
```

---

### Task 13: Final Integration Test

**Step 1: Start the backend**

```bash
docker compose up -d
uv run alembic upgrade head
uv run uvicorn liberclaw.main:app --reload
```

**Step 2: Start the Expo app**

```bash
cd apps/liberclaw && npx expo start
```

**Step 3: Test each flow**

1. **Guest mode**: Tap "Start as guest" → should land on dashboard with limited quotas
2. **Email + code**: Enter email → check server logs for 6-digit code → enter code → should authenticate
3. **Google (Android)**: Tap "Continue with Google" → native sheet → authenticated (requires device/emulator with Google Play Services)
4. **Apple (iOS)**: Tap "Sign in with Apple" → native sheet → authenticated (requires iOS device/simulator)
5. **Guest upgrade**: While logged in as guest, go to profile → "Sign in" → authenticate → verify tier changed to "free" and agents preserved
6. **Web**: Verify existing browser OAuth still works unchanged

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration test fixes for mobile auth"
```
