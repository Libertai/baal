# Mobile Auth & Guest Mode Design

## Problem

The LiberClaw Expo app's login flow is broken on mobile:
- OAuth opens a browser with no way to redirect back to the app
- Magic link emails open in the browser, not the app
- No guest mode for frictionless onboarding on mobile

## Design

### 1. Native Sign-In (per platform)

**Android — Google One Tap:**
- Library: `@react-native-google-signin/google-signin` (Credential Manager APIs)
- UX: Native bottom sheet "Sign in as jon@gmail.com?" — one tap, no browser
- Returns: Google ID token (JWT)
- Backend: `POST /auth/mobile/google` receives `{ id_token }`, verifies against Google's JWKS, extracts email, creates/finds user, returns `TokenPair`

**iOS — Sign in with Apple:**
- Library: `expo-apple-authentication` (native system sheet with Face ID/Touch ID)
- UX: Native Apple auth sheet — one tap + biometric
- Returns: Apple identity token + optional full name/email
- Backend: `POST /auth/mobile/apple` receives `{ identity_token, full_name? }`, verifies against Apple's JWKS, extracts email (may be relay address), creates/finds user, returns `TokenPair`

**Web — unchanged:**
- Existing browser-based OAuth (Google + GitHub) stays as-is

### 2. Magic Link — 6-Digit Code

**Current problem:** Magic link tokens are long signed strings, unusable on mobile.

**Solution:** Generate a random 6-digit numeric code alongside the existing token. Email includes both the clickable link (web/desktop) and the visible 6-digit code (mobile).

**Backend changes:**
- `create_magic_link()` generates a 6-digit code, stores its hash on the `MagicLink` row
- Verify endpoint accepts either the full signed token OR `{ email, code }` pair
- Brute-force protection: max 5 attempts per code, counter on the `MagicLink` row
- Code expires with the same 15-minute TTL

**DB changes (magic_links table):**
- Add `code_hash` column (string, nullable)
- Add `attempts` column (integer, default 0)

**Email template:** Include both:
- Clickable "Sign in to LiberClaw" link (existing)
- Visible "Your code: 847291" text (new)

**Frontend:** The magic-link screen already has a code input — constrain to 6-digit numeric, improve labeling.

### 3. Guest Mode

**Endpoint:** `POST /auth/guest` with `{ device_id: string }`
- If guest user with that `device_id` already exists → return tokens for existing user
- Otherwise create `User(tier="guest", device_id=device_id)` → return `TokenPair`
- Rate limit: reject if too many guest accounts from same IP (future hardening)

**DB changes (users table):**
- Add `device_id` column (string, nullable, unique)

**Device fingerprint:**
- Android: `Application.androidId` from `expo-application`
- iOS: `Application.getIosIdForVendorsAsync()` from `expo-application`

**Quotas for guests:**
- 1 agent slot
- 5 messages/day
- Enforced server-side via `user.tier` in existing `usage_tracker`

**Upgrade path:** When a guest authenticates via email, Google, or Apple:
- Attach the credential to the existing guest User (set email, create OAuthConnection, etc.)
- Change `tier` from `"guest"` to `"free"`
- All agents, sessions, and history preserved on the same `user_id`
- If email/OAuth already belongs to a different user → 409 "already linked to another account"

### 4. Mobile Login Screen Layout

```
┌─────────────────────────────┐
│        LiberClaw            │
│    Autonomous AI Agents     │
│                             │
│  ┌───────────────────────┐  │
│  │ Continue with Google   │  │  ← Android only (native One Tap)
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Sign in with Apple     │  │  ← iOS only (native Apple auth)
│  └───────────────────────┘  │
│                             │
│  ─────── or ───────         │
│                             │
│  [ Email address         ]  │
│  ┌───────────────────────┐  │
│  │ Send Code              │  │
│  └───────────────────────┘  │
│                             │
│  ─────────────────────────  │
│                             │
│  Start as guest             │  ← subtle link, not a primary button
│                             │
└─────────────────────────────┘
```

### 5. Dependencies

**New npm packages:**
- `expo-apple-authentication` — native Apple sign-in
- `@react-native-google-signin/google-signin` — native Google One Tap
- `expo-application` — device ID for guest mode

**app.json changes:**
- `ios.usesAppleSignIn: true`
- Google Sign-In config plugin entry

**New Python packages (backend):**
- `PyJWT` + `cryptography` — verify Google/Apple ID tokens (RS256 JWKS)
  (or reuse `python-jose` which is already a dependency)

**External setup:**
- Google Cloud Console: web client ID for Google Sign-In
- Apple Developer: Sign in with Apple capability + service ID

### 6. New Backend Endpoints Summary

| Endpoint | Input | Action |
|----------|-------|--------|
| `POST /auth/mobile/google` | `{ id_token }` | Verify Google JWT, find/create user, return TokenPair |
| `POST /auth/mobile/apple` | `{ identity_token, full_name? }` | Verify Apple JWT, find/create user, return TokenPair |
| `POST /auth/guest` | `{ device_id }` | Find/create guest user, return TokenPair |
| `POST /auth/verify-magic-link` (updated) | `{ token }` OR `{ email, code }` | Accept either full token or 6-digit code |

### 7. Migration

Single Alembic migration:
- `users` table: add `device_id` (String, nullable, unique)
- `magic_links` table: add `code_hash` (String, nullable), add `attempts` (Integer, default 0)
