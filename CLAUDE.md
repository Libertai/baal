# Baal / LiberClaw

Platform for creating and deploying AI agents on [Aleph Cloud](https://aleph.cloud) with [LibertAI](https://libertai.io) inference. Two frontends — a Telegram bot (Baal) and a web/mobile app (LiberClaw) — share the same agent infrastructure.

## Architecture

```
Expo App (web/iOS/Android)          Telegram Bot
         |                                |
         v                                v
   LiberClaw API (FastAPI)       Baal Bot (python-telegram-bot)
         |                                |
         +------ baal_core (shared) ------+
         |   deployer, proxy, encryption  |
         |   pool_manager, models         |
         v                                v
           Agent VMs (baal-agent on Aleph Cloud)
                      |
                      v
              LibertAI API (inference)
```

Four packages in one monorepo:

| Package | Location | Description |
|---------|----------|-------------|
| **baal_core** | `src/baal_core/` | Shared infrastructure: deployer, proxy, encryption, pool manager, models |
| **baal** | `src/baal/` | Telegram bot: control plane, message proxy, VM manager |
| **baal-agent** | `src/baal_agent/` | FastAPI agent deployed to each Aleph Cloud VM |
| **liberclaw** | `src/liberclaw/` | FastAPI web API: auth, agent CRUD, chat proxy, usage tracking |

Expo app (TypeScript/React Native) at `apps/liberclaw/`.

## Tech Stack

**Python (backend)**:
- Python 3.12+, managed with `uv`
- `fastapi` + `uvicorn` — API servers (liberclaw + baal-agent)
- `sqlalchemy[asyncio]` + `asyncpg` + `alembic` — PostgreSQL ORM + migrations (liberclaw)
- `aiosqlite` — SQLite (bot + agent)
- `python-telegram-bot[ext]` — Telegram bot framework
- `aleph-sdk-python` — Aleph Cloud VM provisioning
- `openai` — LibertAI client (OpenAI-compatible)
- `httpx` — HTTP proxy, SSE streaming
- `cryptography` — Fernet encryption
- `python-jose` — JWT tokens
- `authlib` — OAuth (Google/GitHub)
- `itsdangerous` — magic link tokens
- `web3` — wallet signature verification
- `pydantic-settings` — config from `.env`

**TypeScript (frontend)**:
- Expo SDK 52 + Expo Router (file-based routing)
- NativeWind v4 (Tailwind CSS for React Native)
- TanStack Query (server state)
- Zustand (client state)
- SSE streaming via fetch ReadableStream

## Project Layout

```
src/baal_core/
  deployer.py          # AlephDeployer: CRN discovery, instance creation, SSH deployment, Caddy
  proxy.py             # HTTP proxy: stream_messages(), health_check(), get_pending_messages()
  encryption.py        # Fernet encrypt/decrypt
  pool_manager.py      # VMPool: warm VM pool for instant deployment
  models.py            # Shared constants: AVAILABLE_MODELS, DEFAULT_MODEL, VMInfo, DeploymentResult

src/baal/
  main.py              # Bot entry point: handlers, post_init/post_shutdown, run_polling()
  config.py            # Settings (env_file=".env")
  database/db.py       # SQLite: users, agents, daily_usage
  handlers/
    commands.py        # /start, /help, /create wizard, /list, /delete, /manage
    chat.py            # Message routing + proxy to agent VMs
    account.py         # /login, /logout, /account
  services/            # Re-export stubs → baal_core.*

src/baal_agent/
  main.py              # FastAPI: POST /chat, DELETE /chat/{id}, GET /pending, GET /health
  config.py            # AgentSettings
  compaction.py        # Token-aware context management
  context.py           # System prompt builder (memory + skills + identity)
  database.py          # SQLite: conversation history + pending_messages
  inference.py         # AsyncOpenAI wrapper for LibertAI
  tools.py             # bash, read/write/edit_file, list_dir, web_fetch, web_search, spawn
  workspace/           # Template files deployed to each VM

src/liberclaw/
  main.py              # FastAPI app with lifespan, CORS, router mounting
  config.py            # LiberClawSettings (env_prefix=LIBERCLAW_)
  database/
    models.py          # SQLAlchemy ORM: User, Agent, Session, ApiKey, etc. (12 tables)
    session.py         # Async engine + session factory
    migrations/        # Alembic (PostgreSQL)
  auth/
    dependencies.py    # get_current_user, get_optional_user (FastAPI Depends)
    jwt.py             # Access/refresh token creation + validation (HS256)
    magic_link.py      # Token generation + verification (itsdangerous)
    oauth.py           # Google + GitHub OAuth (authlib)
    wallet.py          # Web3 wallet challenge-response
  routers/
    auth.py            # /api/v1/auth/* — login, OAuth, wallet, refresh, logout
    agents.py          # /api/v1/agents/* — CRUD, deploy, health, repair, redeploy
    chat.py            # /api/v1/chat/* — SSE streaming proxy, history clear, pending
    files.py           # /api/v1/files/* — proxy downloads from agent VMs
    users.py           # /api/v1/users/* — profile, connections, API keys
    usage.py           # /api/v1/usage/* — stats, history
    health.py          # /api/v1/health
  services/
    agent_manager.py   # Agent CRUD + deployment orchestration (uses baal_core.deployer)
    chat_proxy.py      # SSE streaming proxy (uses baal_core.proxy)
    email.py           # Magic link emails (Resend)
    usage_tracker.py   # Daily usage tracking + quota enforcement
  schemas/             # Pydantic request/response models

apps/liberclaw/
  app/                 # Expo Router screens
    (auth)/            # Login, magic link verification
    (tabs)/            # Agents dashboard, chat, settings
    agent/             # Create, detail, chat, edit
  components/          # UI, chat, agent, auth, layout components
  lib/
    api/               # HTTP client, typed API calls, SSE streaming
    auth/              # AuthProvider, secure token storage
    hooks/             # useAgents, useChat, useSSE, useDeployment
    store/             # Zustand: chat messages, preferences
```

## Running

### Telegram Bot
```bash
uv pip install -e ".[bot]"
python -m baal.main
```

### LiberClaw API
```bash
uv pip install -e ".[api]"
docker compose up -d                    # PostgreSQL on port 5433
alembic upgrade head                    # Run migrations
uvicorn liberclaw.main:app --reload     # http://localhost:8000
```

### Expo App
```bash
cd apps/liberclaw
npm install
npx expo start                          # http://localhost:8081
```

### Agent (local testing)
```bash
uv pip install -e ".[agent]"
AGENT_NAME=test SYSTEM_PROMPT="Be helpful" MODEL=qwen3-coder-next \
  LIBERTAI_API_KEY=xxx AGENT_SECRET=test WORKSPACE_PATH=/tmp/baal-workspace \
  uvicorn baal_agent.main:app --port 8080
```

## Configuration

All config via `.env`. Bot vars are unprefixed, LiberClaw vars use `LIBERCLAW_` prefix.

### Bot vars
`TELEGRAM_BOT_TOKEN`, `LIBERTAI_API_KEY`, `ALEPH_PRIVATE_KEY`, `ALEPH_SSH_PUBKEY`, `ALEPH_SSH_PRIVKEY_PATH`, `BOT_ENCRYPTION_KEY`

### LiberClaw vars
`LIBERCLAW_DATABASE_URL`, `LIBERCLAW_JWT_SECRET`, `LIBERCLAW_ENCRYPTION_KEY`, `LIBERCLAW_MAGIC_LINK_SECRET`, `LIBERCLAW_RESEND_API_KEY`, `LIBERCLAW_GOOGLE_CLIENT_ID/SECRET`, `LIBERCLAW_GITHUB_CLIENT_ID/SECRET`, `LIBERCLAW_FRONTEND_URL`, `LIBERCLAW_CORS_ORIGINS`

### Agent vars (written to VM `.env` by deployer)
`AGENT_NAME`, `SYSTEM_PROMPT`, `MODEL`, `AGENT_SECRET`, `WORKSPACE_PATH`, `OWNER_CHAT_ID`, `HEARTBEAT_INTERVAL`

Optional: `BRAVE_API_KEY` enables the `web_search` tool. Project SSH keypair at `.ssh/id_ed25519` (gitignored).

## Key Patterns

### Shared Core (baal_core)

- **AlephDeployer**: CRN discovery (scored by load), instance creation with retry (up to 5 CRNs), tar-over-SSH deployment, Caddy HTTPS setup. Blacklists failed CRNs for 10 min.
- **VMPool**: Maintains warm pre-provisioned VMs for instant deployment. Background replenisher keeps pool at min_size. Statuses: provisioning → warm → claimed → deployed.
- **Proxy**: SSE streaming with retry, health checks, file downloads, pending message polling.

### Bot (baal)

- **Shared state via `bot_data`**: `db`, `deployer`, `settings`, `rate_limiter` stored in `context.bot_data` dict
- **ConversationHandler** for `/create` wizard: NAME → PROMPT → MODEL → CONFIRM. `per_message=False`.
- **Background deployment**: runs as `context.application.create_task()`, sends Telegram status updates
- **Bot-to-agent auth**: per-agent `secrets.token_urlsafe(32)` encrypted with Fernet, sent as `Authorization: Bearer`
- **Re-export stubs**: `src/baal/services/*.py` re-export from `baal_core` for backward compatibility

### LiberClaw API (liberclaw)

- **Auth**: JWT HS256 (15-min access, 30-day refresh with rotation), magic links (itsdangerous, SHA-256 hash in DB), Google/GitHub OAuth (authlib), Web3 wallet (challenge-response with ecrecover). Account linking by email.
- **Agent deployment**: Background tasks via `asyncio.create_task()`, status polling endpoint for frontend progress tracking
- **Chat streaming**: SSE-over-POST proxy. Translates JWT auth to per-agent Bearer tokens, forwards events verbatim. Event types: text, tool_use, file, error, done, keepalive.
- **Database**: PostgreSQL via SQLAlchemy async ORM. 12 tables. Alembic for migrations.

### Agent (baal_agent)

- **Context builder**: Assembles system prompt from identity + memory + skills. Date-only timestamp for vLLM prefix caching.
- **Context compaction**: Token-aware (chars/4 heuristic). Summarizes old messages via LLM, keeps recent intact.
- **Memory system**: File-based at `workspace/memory/MEMORY.md` (long-term) + daily notes.
- **Skills system**: Markdown files at `workspace/skills/*/SKILL.md`. Summaries in context, full on-demand.
- **Bash safety guards**: Regex deny patterns block dangerous commands before execution.
- **Heartbeat + subagents**: Background tasks, results queued as pending messages.

### Agent Tools

| Tool | Description |
|------|-------------|
| `bash` | Shell execution with safety deny patterns, timeout, truncation |
| `read_file` | Read file with line numbers, offset/limit support |
| `write_file` | Write file, create parent dirs |
| `edit_file` | Find-and-replace (first occurrence) |
| `list_dir` | List directory with `[dir]`/`[file]` prefixes |
| `web_fetch` | Fetch URL, strip HTML, truncate at 50K chars |
| `web_search` | Brave Search API (only if `BRAVE_API_KEY` set) |
| `spawn` | Background subagent (restricted tools, max 15 iterations) |

## Deployment

### Telegram Bot (Baal)
Runs on a separate Aleph Cloud instance. See memory notes for details.

### LiberClaw (web + API)
Single Aleph Cloud VM serving three domains via Caddy with auto Let's Encrypt:

| Domain | Service | Source |
|--------|---------|--------|
| `liberclaw.ai` | Static landing site | `sites/landing/dist/` |
| `api.liberclaw.ai` | FastAPI reverse proxy | uvicorn on localhost:8000 |
| `app.liberclaw.ai` | Expo web SPA | `apps/liberclaw/dist/` |

**Server:** `/root/liberclaw/` — git clone of the repo (`liberclaw` branch)
**Config:** `/root/liberclaw/.env` (from `deploy/.env.production` template)
**Services:** `caddy`, `liberclaw-api` (systemd), `postgresql` (16)

**Deploy files** (`deploy/`):
- `setup.sh` — Full bootstrap for a fresh VM (`ssh -A root@<IP> 'bash -s' < deploy/setup.sh`)
- `Caddyfile` — Copied to `/etc/caddy/Caddyfile` (not symlinked; Caddy runs as `caddy` user)
- `liberclaw-api.service` — systemd unit for uvicorn
- `.env.production` — Template with all env vars

**Update workflow:**
```bash
ssh -A root@<VM_IP>
cd /root/liberclaw && git pull
# If frontend changed:
cd sites/landing && npm run build
cd /root/liberclaw/apps/liberclaw && npx expo export --platform web
# If Caddyfile changed:
cp deploy/Caddyfile /etc/caddy/Caddyfile && systemctl reload caddy
# If backend changed:
systemctl restart liberclaw-api
```

**Notes:**
- Caddy needs `chmod 711 /root` + `o+rX` on dist dirs to serve static files
- PostgreSQL password must be URL-safe (use `openssl rand -hex 24`, not `-base64`)
- `alembic.ini` has the dev DB URL (port 5433); production overrides it in `setup.sh`

## Available Models

Currently offering: `qwen3-coder-next`, `glm-4.7`. Default: `qwen3-coder-next`. Do NOT offer gemma.

## GitHub

Repo: https://github.com/Libertai/baal
