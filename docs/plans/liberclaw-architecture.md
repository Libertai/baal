# LiberClaw - Architecture & Implementation Plan

## Context

Baal is currently a Telegram bot for deploying AI agents on Aleph Cloud. **LiberClaw** is a new, separate product — a web + mobile app for deploying and chatting with AI agents — sharing the same underlying infrastructure (Aleph Cloud VMs running `baal-agent`). Both products live in the same monorepo.

Think: your own OpenClaw-like AI agent instances, instantly deployable from your phone or browser.

## Architecture

```
Expo App (web/iOS/Android)              Telegram Bot (existing)
         |                                       |
         v                                       v
   LiberClaw API Server              Baal Bot (python-telegram-bot)
   (FastAPI, PostgreSQL)             (SQLite, Telegram handlers)
         |                                       |
         +---------- baal_core (shared) ---------+
         |   deployer, proxy, encryption,        |
         |   pool_manager, models                |
         v                                       v
               Agent VMs (baal-agent, unchanged)
                        |
                        v
              LibertAI API (inference)
```

**Three components:**
1. **baal** — Telegram bot (existing, unchanged)
2. **baal-agent** — Agent code deployed to each VM (existing, unchanged)
3. **liberclaw** — New API server + Expo app (this plan)

Plus a shared core: **baal_core** — infrastructure extracted from baal that both products use.

## Tech Stack

### Backend (API Server)
- **Python 3.12+**, managed with `uv`
- `fastapi>=0.109` + `uvicorn` — API framework
- `sqlalchemy[asyncio]>=2.0` + `asyncpg` — PostgreSQL ORM
- `alembic>=1.13` — database migrations
- `python-jose[cryptography]` — JWT tokens
- `authlib>=1.3` — OAuth 2.0 (Google, GitHub)
- `itsdangerous>=2.1` — signed magic link tokens
- `web3>=6.0` — Ethereum wallet signature verification
- `resend>=0.7` — magic link email delivery
- `httpx>=0.27` — HTTP proxy to agent VMs (via baal_core)

### Frontend (Mobile + Web)
- **Expo SDK ~52** with Expo Router v4
- **TypeScript**
- **NativeWind** (Tailwind CSS for React Native)
- `@tanstack/react-query` — server state + caching
- `zustand` — client state (chat messages, preferences)
- `expo-secure-store` — secure token storage
- `expo-auth-session` — OAuth flows
- `react-native-reanimated` — animations
- `react-native-markdown-display` — chat markdown rendering
- `@walletconnect/modal-react-native` — Web3 wallet connection

## Project Structure

```
baal/
  pyproject.toml                        # Updated: [core], [bot], [agent], [api] extras
  src/
    baal_core/                          # NEW: shared infrastructure
      __init__.py
      deployer.py                       # AlephDeployer (moved from baal/services/)
      proxy.py                          # SSE proxy (moved from baal/services/)
      encryption.py                     # Fernet encrypt/decrypt (moved)
      pool_manager.py                   # VM pool manager (moved)
      models.py                         # Shared Pydantic models
    baal/                               # EXISTING: Telegram bot (uses baal_core via re-exports)
      ...
    baal_agent/                         # EXISTING: agent VM code (unchanged)
      ...
    liberclaw/                          # NEW: LiberClaw API server
      __init__.py
      main.py                           # FastAPI app, lifespan, CORS
      config.py                         # LiberClawSettings (LIBERCLAW_ env prefix)
      database/
        models.py                       # SQLAlchemy ORM models
        session.py                      # Async engine + session factory
        migrations/                     # Alembic
          env.py
          versions/
            001_initial.py
      auth/
        dependencies.py                 # get_current_user FastAPI dependency
        jwt.py                          # JWT access + refresh tokens
        oauth.py                        # Google + GitHub OAuth
        magic_link.py                   # Email magic links
        wallet.py                       # Web3 wallet challenge/verify
      routers/
        auth.py                         # /api/v1/auth/*
        agents.py                       # /api/v1/agents/*
        chat.py                         # /api/v1/chat/* (SSE proxy)
        files.py                        # /api/v1/files/* (file proxy)
        users.py                        # /api/v1/users/*
        usage.py                        # /api/v1/usage/*
        health.py                       # /api/v1/health
      services/
        agent_manager.py                # Agent CRUD + deployment orchestration
        chat_proxy.py                   # SSE streaming to web/mobile
        email.py                        # Magic link email sending
        usage_tracker.py                # Rate limiting + usage tracking
      schemas/
        auth.py                         # Auth request/response schemas
        agents.py                       # Agent request/response schemas
        chat.py                         # Chat schemas
        users.py                        # User schemas
        usage.py                        # Usage schemas
  apps/
    liberclaw/                          # NEW: Expo app
      app.json
      package.json
      tsconfig.json
      tailwind.config.js
      eas.json
      app/                              # Expo Router pages
        _layout.tsx                     # Root: providers, auth gate
        (auth)/
          _layout.tsx
          login.tsx                     # OAuth + magic link + wallet
          magic-link.tsx                # "Check your email"
        (tabs)/
          _layout.tsx                   # Bottom tabs: Agents, Chat, Settings
          index.tsx                     # Agent dashboard
          chat.tsx                      # Active chat or agent picker
          settings.tsx                  # Profile, API keys, usage
        agent/
          create.tsx                    # Creation wizard
          [id]/
            index.tsx                   # Agent detail
            chat.tsx                    # Chat interface (SSE streaming)
            edit.tsx                    # Edit system prompt
      components/
        ui/                             # Button, Input, Card, Badge, etc.
        chat/                           # MessageBubble, ToolIndicator, ChatInput, etc.
        agent/                          # AgentCard, ModelSelector, DeploymentProgress
        auth/                           # OAuthButton, WalletButton, MagicLinkForm
      lib/
        api/
          client.ts                     # HTTP client with JWT interceptor
          agents.ts, auth.ts, chat.ts   # API call functions
          types.ts                      # TypeScript types
        auth/
          provider.tsx                  # AuthContext
          storage.ts                    # Secure token storage
        hooks/
          useSSE.ts                     # SSE streaming hook
          useAgent.ts, useAgents.ts     # TanStack Query wrappers
          useChat.ts                    # Chat orchestration
          useDeployment.ts              # Deployment polling
        store/
          chat.ts                       # Zustand: messages, streaming state
          preferences.ts                # Zustand: settings
      assets/
  docs/plans/
    initial-architecture.md             # Original Baal architecture
    liberclaw-architecture.md           # This file
```

## Database Schema (PostgreSQL)

LiberClaw uses PostgreSQL (not SQLite like the Telegram bot). The schemas are independent.

### Users

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    display_name    TEXT,
    avatar_url      TEXT,
    show_tool_calls BOOLEAN NOT NULL DEFAULT TRUE,
    tier            TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Auth Connections

```sql
-- OAuth (Google, GitHub)
CREATE TABLE oauth_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL CHECK (provider IN ('google', 'github')),
    provider_id     TEXT NOT NULL,
    provider_email  TEXT,
    access_token    TEXT,          -- Fernet-encrypted
    refresh_token   TEXT,          -- Fernet-encrypted
    token_expires_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_id)
);

-- Web3 wallets
CREATE TABLE wallet_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chain           TEXT NOT NULL DEFAULT 'ethereum',
    address         TEXT NOT NULL,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (chain, address)
);

-- JWT refresh tokens
CREATE TABLE sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash  TEXT NOT NULL UNIQUE,    -- SHA-256 of token
    device_info         TEXT,
    ip_address          INET,
    expires_at          TIMESTAMPTZ NOT NULL,
    revoked_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Magic links
CREATE TABLE magic_links (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT NOT NULL,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Agents & Deployment

```sql
CREATE TABLE agents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    system_prompt       TEXT NOT NULL,
    model               TEXT NOT NULL DEFAULT 'qwen3-coder-next',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    is_public           BOOLEAN NOT NULL DEFAULT FALSE,
    instance_hash       TEXT,
    vm_ipv6             TEXT,
    vm_url              TEXT,
    crn_url             TEXT,
    ssh_port            INTEGER DEFAULT 22,
    auth_token          TEXT,          -- Fernet-encrypted bearer token
    deployment_status   TEXT NOT NULL DEFAULT 'pending'
        CHECK (deployment_status IN ('pending','provisioning','deploying','running','failed','stopped','updating')),
    source              TEXT NOT NULL DEFAULT 'liberclaw' CHECK (source IN ('liberclaw', 'telegram')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE deployment_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    status          TEXT NOT NULL,
    step            TEXT,
    error_message   TEXT,
    duration_seconds INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Usage & API Keys

```sql
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_key   TEXT NOT NULL,        -- Fernet-encrypted LibertAI key
    label           TEXT NOT NULL DEFAULT 'default',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE daily_usage (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    message_count   INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, date)
);

CREATE TABLE usage_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id    UUID REFERENCES agents(id) ON DELETE SET NULL,
    event_type  TEXT NOT NULL CHECK (event_type IN ('message', 'deployment', 'file_download')),
    tokens_used INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## API Routes

All prefixed with `/api/v1`.

### Auth (`/auth/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login/email` | No | Send magic link email |
| POST | `/verify-magic-link` | No | Verify token -> JWT pair |
| POST | `/refresh` | No | Refresh access token (token rotation) |
| GET | `/oauth/google` | No | Redirect to Google OAuth |
| GET | `/oauth/google/callback` | No | Google callback -> JWT pair |
| GET | `/oauth/github` | No | Redirect to GitHub OAuth |
| GET | `/oauth/github/callback` | No | GitHub callback -> JWT pair |
| POST | `/wallet/challenge` | No | Get sign-in nonce |
| POST | `/wallet/verify` | No | Verify wallet signature -> JWT pair |
| POST | `/logout` | Yes | Revoke refresh token |
| POST | `/logout/all` | Yes | Revoke all sessions |

**JWT tokens**: HS256, 15-min access tokens, 30-day refresh tokens with rotation.

**Account linking**: If OAuth email matches existing user, links to that account. Multiple auth methods per user. Cannot remove last method.

### Agents (`/agents/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List user's agents |
| POST | `/` | Create agent (starts background deployment) |
| GET | `/{id}` | Agent details |
| PATCH | `/{id}` | Update config (triggers redeploy if prompt/model changed) |
| DELETE | `/{id}` | Delete agent + destroy VM |
| GET | `/{id}/health` | Proxy health check to VM |
| GET | `/{id}/status` | Deployment progress (poll during creation) |
| POST | `/{id}/repair` | Retry failed deployment |
| POST | `/{id}/redeploy` | Push latest code to running VM |

### Chat (`/chat/`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/{agent_id}` | Send message -> SSE stream response |
| DELETE | `/{agent_id}` | Clear conversation history |
| GET | `/{agent_id}/pending` | Get pending proactive messages |

### Files (`/files/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/{agent_id}/{path}` | Proxy file download from agent VM |

### Users (`/users/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/me` | Current user profile |
| PATCH | `/me` | Update profile/preferences |
| GET | `/me/connections` | List linked auth methods |
| DELETE | `/me/connections/{id}` | Unlink auth method |
| POST | `/me/api-keys` | Add LibertAI API key |
| GET | `/me/api-keys` | List API keys (masked) |
| DELETE | `/me/api-keys/{id}` | Remove API key |

### Usage (`/usage/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Current usage summary |
| GET | `/history` | Daily breakdown |

## Chat Streaming Architecture

SSE (Server-Sent Events) over POST — same protocol the agent VMs already speak.

```
Client                       LiberClaw API                  Agent VM
  |                               |                            |
  | POST /api/v1/chat/{agent_id}  |                            |
  | Authorization: Bearer <jwt>   |                            |
  | {"message": "Hello"}          |                            |
  |------------------------------>|                            |
  |                               | POST /chat                 |
  |                               | Auth: Bearer <agent_token> |
  |                               | {"message":"Hello",        |
  |                               |  "chat_id":"{uid}:{aid}"}  |
  |                               |--------------------------->|
  |                               |                            |
  | data: {"type":"text",...}     | data: {"type":"text",...}   |
  |<------------------------------|<---------------------------|
  | data: {"type":"tool_use",...} | data: {"type":"tool_use"}   |
  |<------------------------------|<---------------------------|
  | data: {"type":"keepalive"}    | data: {"type":"keepalive"}  |
  |<------------------------------|<---------------------------|
  | data: {"type":"done"}         | data: {"type":"done"}       |
  |<------------------------------|<---------------------------|
```

The API server:
1. Validates JWT, looks up agent, verifies ownership
2. Decrypts the agent's Fernet-encrypted auth token
3. Generates scoped `chat_id` (`{user_id}:{agent_id}`) for per-user conversation isolation
4. Proxies SSE stream verbatim from agent VM to client
5. After `done` event, polls `/pending` for heartbeat/subagent results
6. Tracks usage

**SSE events** (unchanged from baal-agent): `text`, `tool_use`, `file`, `error`, `done`, `keepalive`

### Client-Side SSE

The Expo app consumes SSE via `fetch()` with `ReadableStream` (supported in Expo SDK 51+). `react-native-sse` as fallback. `useSSE` hook handles:
- Platform-appropriate transport selection
- Manual `data: {...}\n\n` parsing
- Keepalive timeout (60s inactivity = disconnect)
- Abort on unmount
- Error surfacing

On disconnect mid-stream: show partial response, "Connection lost" banner, user retries manually.

## Expo App Design

### Navigation

```
Root Layout (AuthProvider, QueryClientProvider)
  |
  |-- No token -> (auth)/login
  |     |-- OAuth -> (tabs)/
  |     |-- Magic link -> magic-link -> (tabs)/
  |     |-- Wallet -> (tabs)/
  |
  |-- Has token -> (tabs)/
        |-- Agents tab (dashboard)
        |     |-- Tap agent -> agent/[id]/chat
        |     |-- Create button -> agent/create
        |-- Chat tab (last active or picker)
        |-- Settings tab
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `AgentCard` | Dashboard card: status dot, name, model, age, action buttons |
| `ModelSelector` | Model cards for create wizard (qwen3-coder-next, glm-4.7) |
| `DeploymentProgress` | 6-step visual progress (mirrors bot's progress tracker) |
| `MessageBubble` | User/agent message with markdown rendering |
| `ToolIndicator` | Collapsible tool execution card (bash, web_fetch, etc.) |
| `StreamingText` | Animated text with cursor during SSE streaming |
| `ChatInput` | Input bar with send button, keyboard-aware |
| `MessageList` | Inverted FlatList for chat-style scrolling |
| `OAuthButton` | Google/GitHub sign-in |
| `WalletButton` | MetaMask/WalletConnect |
| `MagicLinkForm` | Email input + send link |

### State Management

- **Server state**: TanStack Query (agent list, account, deployment status polling)
- **Client state**: Zustand (chat messages per agent, streaming state, preferences)
- **Auth state**: React Context (controls entire nav tree)

### API Client

Thin `fetch`-based wrapper with:
- JWT auto-injection
- 401 -> refresh token -> retry
- `stream()` method returning raw `Response` for SSE consumption
- TypeScript types mirroring backend Pydantic models

## Configuration

### API Server (`LIBERCLAW_` prefix)

```
LIBERCLAW_DATABASE_URL=postgresql+asyncpg://localhost:5432/liberclaw
LIBERCLAW_JWT_SECRET=<random-secret>
LIBERCLAW_ENCRYPTION_KEY=<fernet-key>
LIBERCLAW_GOOGLE_CLIENT_ID=...
LIBERCLAW_GOOGLE_CLIENT_SECRET=...
LIBERCLAW_GITHUB_CLIENT_ID=...
LIBERCLAW_GITHUB_CLIENT_SECRET=...
LIBERCLAW_MAGIC_LINK_SECRET=<itsdangerous-key>
LIBERCLAW_RESEND_API_KEY=...
LIBERCLAW_ALEPH_PRIVATE_KEY=<hex-ethereum-key>
LIBERCLAW_ALEPH_SSH_PUBKEY=<ssh-pubkey>
LIBERCLAW_ALEPH_SSH_PRIVKEY_PATH=/path/to/key
LIBERCLAW_LIBERTAI_API_KEY=<default-key-for-free-tier>
LIBERCLAW_FRONTEND_URL=https://app.liberclaw.io
LIBERCLAW_API_URL=https://api.liberclaw.io
LIBERCLAW_CORS_ORIGINS=["https://app.liberclaw.io","http://localhost:19006"]
```

### pyproject.toml Updates

```toml
[project.optional-dependencies]
core = [
    "httpx>=0.27",
    "aleph-sdk-python[ethereum]",
    "eth_account",
    "aiosqlite>=0.20",
]
bot = ["baal[core]", "python-telegram-bot[ext]>=22.0"]
agent = ["fastapi>=0.109", "uvicorn>=0.27", "openai>=1.0", "httpx>=0.27", "aiosqlite>=0.20"]
api = [
    "baal[core]",
    "fastapi>=0.109", "uvicorn>=0.27",
    "sqlalchemy[asyncio]>=2.0", "asyncpg>=0.29", "alembic>=1.13",
    "python-jose[cryptography]>=3.3", "authlib>=1.3", "itsdangerous>=2.1",
    "web3>=6.0", "pydantic[email]>=2.0", "resend>=0.7", "httpx>=0.27",
]

[tool.hatch.build.targets.wheel]
packages = ["src/baal", "src/baal_agent", "src/baal_core", "src/liberclaw"]
```

## Implementation Steps

### Step 1: Extract Shared Core
- Create `src/baal_core/` with deployer, proxy, encryption, pool_manager, models
- Add re-export stubs in `src/baal/services/` for backwards compatibility
- Update pyproject.toml with `[core]` extra
- **Verify**: `python -m baal.main` starts, `pytest` passes

### Step 2: Database + Auth Foundation
- PostgreSQL + SQLAlchemy models + Alembic initial migration
- JWT creation/validation
- Magic link flow (simplest auth to test first)
- FastAPI app skeleton with CORS, `/api/v1/health`
- **Verify**: `uvicorn liberclaw.main:app` starts, magic link flow works via curl

### Step 3: Agent CRUD + Deployment
- Create/list/get/update/delete agent routes
- Background deployment via `baal_core.deployer`
- Deployment status polling endpoint
- VM pool integration for fast deployment
- **Verify**: Create agent via curl, deployment completes, health check passes

### Step 4: Chat Streaming
- SSE proxy from API to agent VMs via `baal_core.proxy`
- Chat history clear endpoint
- Pending messages endpoint
- Usage tracking + rate limiting
- **Verify**: `curl -N -X POST /api/v1/chat/{id}` streams SSE events

### Step 5: Full Auth
- Google + GitHub OAuth flows
- Web3 wallet challenge/verify
- Account linking (email match, multiple methods)
- User profile + connections management
- **Verify**: OAuth redirect works in browser, wallet verify works with test sig

### Step 6: Expo App Scaffold
- Initialize Expo project (Router, NativeWind, TypeScript)
- API client with JWT interceptor
- AuthProvider + login screen (magic link first)
- Tab navigation + agent list connected to real API
- **Verify**: `npx expo start`, login works, agents list loads

### Step 7: Chat + Agent Management
- Agent creation wizard (Name -> Model -> Confirm)
- DeploymentProgress with polling
- Chat screen with SSE streaming (useSSE hook)
- MessageBubble with markdown, ToolIndicator
- Agent detail + edit screens
- **Verify**: Create agent and chat with it from Expo app

### Step 8: Polish
- OAuth + wallet auth in Expo
- Settings screen (preferences, API keys, usage stats)
- File handling (downloads from agents)
- Offline indicators + reconnection
- Performance optimization
- **Verify**: Full flow on web + iOS simulator + Android emulator

## Key Design Decisions

1. **Separate products, shared infra** — LiberClaw and Baal bot are independent products with separate user bases, separate databases (PostgreSQL vs SQLite), but share the same Aleph Cloud deployer and agent VM code.

2. **SSE over WebSocket** — Agent VMs already speak SSE. SSE-to-SSE proxying is simpler. Chat is request-response (user message -> agent stream), which is a natural SSE fit. No upgrade handshake, works through proxies, HTTP/2 compatible.

3. **PostgreSQL for LiberClaw** — Web/mobile apps have higher concurrency requirements than a Telegram bot. PostgreSQL handles concurrent connections, has proper UUID support, and supports future scaling (connection pooling, read replicas).

4. **Expo for mobile + web** — Single TypeScript codebase for iOS, Android, and web. Native mobile feel (not a wrapped website). AI models generate excellent React/TypeScript code, important since another model is building the UI.

5. **JWT with refresh token rotation** — 15-min access tokens for API calls, 30-day refresh tokens stored in `sessions` table. Rotation detects token theft. No server-side access token storage (stateless validation).

6. **baal_core extraction** — Move shared code to a separate package rather than having LiberClaw import from `baal.services`. Cleaner dependency graph, no coupling between products.

7. **Chat ID scoping** — LiberClaw uses `{user_id}:{agent_id}` as the chat_id sent to agent VMs, giving each user their own conversation with each agent. Different from Telegram's approach (uses Telegram chat_id).
