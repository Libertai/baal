# Baal - Implementation Plan

## Context

Baal is a Telegram bot platform that lets users create and deploy their own AI agents on Aleph Cloud with LibertAI inference. Inspired by TinyClaw/OpenClaw but built for the decentralized Aleph Cloud + LibertAI ecosystem.

**Core flow**: User talks to @baal_bot on Telegram -> creates an agent (name, system prompt, model) -> baal provisions an Aleph Cloud VM via the credit system -> deploys agent code via SSH -> user shares a deep link `t.me/baal_bot?start=agent_N` -> anyone clicking that link chats with the agent through the bot, which proxies messages to the VM.

Each agent runs on its own isolated VM for security (filesystem, actions, process isolation).

## Architecture

```
User/Visitor                    Agent Owner
     |                              |
     | t.me/baal_bot?start=42       | /create, /delete, /list
     v                              v
  ┌─────────────────────────────────────┐
  │           @baal_bot (Telegram)       │
  │                                      │
  │  Control Plane: agent CRUD, auth     │
  │  Message Proxy: route chat to VMs    │
  │  VM Manager: create/destroy VMs      │
  │                                      │
  │  SQLite: agents, users, deployments  │
  └──────────┬──────────────────────────┘
             │ HTTP POST /chat
             v
  ┌──────────────────┐  ┌──────────────────┐
  │  Agent VM #1     │  │  Agent VM #2     │
  │  (Aleph Cloud)   │  │  (Aleph Cloud)   │
  │                  │  │                  │
  │  FastAPI :8080   │  │  FastAPI :8080   │
  │  LibertAI client │  │  LibertAI client │
  │  Local SQLite    │  │  Local SQLite    │
  │  Conversation    │  │  Conversation    │
  │  history + state │  │  history + state │
  └──────────────────┘  └──────────────────┘
             │
             v
     LibertAI API (https://api.libertai.io/v1)
```

**Two components:**
1. **baal** — The Telegram bot (control plane + message proxy + VM manager)
2. **baal-agent** — Template code deployed to each Aleph Cloud VM

## Tech Stack

- **Python 3.12+**, managed with `uv`
- `python-telegram-bot[ext]>=22.0` — Telegram bot framework (async)
- `openai>=1.0` — LibertAI API client (OpenAI-compatible)
- `aiosqlite>=0.20` — Async SQLite (both bot and agent)
- `pydantic-settings>=2.0` — Config management
- `httpx>=0.27` — HTTP client (proxying messages to agents)
- `fastapi>=0.109` — Agent HTTP server
- `uvicorn>=0.27` — ASGI server for agent
- `aleph-sdk-python` — Instance creation via Aleph Cloud SDK
- `eth_account` — Ethereum account for Aleph Cloud auth

## Project Structure

```
baal/
  pyproject.toml
  .env.example
  .gitignore
  docs/plans/
    initial-architecture.md      # This file
  src/
    baal/
      __init__.py
      main.py                    # Entry point, wire handlers, run_polling()
      config.py                  # Settings via pydantic-settings
      database/
        __init__.py
        db.py                    # SQLite: users, agents, deployments
      handlers/
        __init__.py
        commands.py              # /start, /help, /create, /list, /delete
        chat.py                  # Message routing + proxy to agent VMs
        account.py               # /login, /logout, /account
      services/
        __init__.py
        deployer.py              # Aleph Cloud instance creation + SSH deployment
        proxy.py                 # HTTP proxy: forward messages to agent VMs
        encryption.py            # Fernet encrypt/decrypt for API keys
        rate_limiter.py          # Per-user daily message limits
    baal_agent/
      __init__.py
      main.py                    # FastAPI app (deployed to each VM)
      config.py                  # Agent settings (system_prompt, model, etc.)
      database.py                # Local SQLite for conversation history
      inference.py               # LibertAI client
```

## Implementation Steps

### Step 1: Project Scaffolding
- `pyproject.toml` with two extras: `[bot]` and `[agent]`
- `.env.example` with required vars: `TELEGRAM_BOT_TOKEN`, `LIBERTAI_API_KEY`, `ALEPH_PRIVATE_KEY`, `ALEPH_SSH_PUBKEY`, `ALEPH_SSH_PRIVKEY_PATH`, `BOT_ENCRYPTION_KEY`
- `src/baal/config.py` — Settings class via pydantic-settings

### Step 2: Agent Template (baal-agent)
Self-contained FastAPI app deployed to each VM:
- `POST /chat {message, chat_id}` -> `{response}` — proxied chat
- `GET /health` -> `{status, agent_name}` — health check
- Auth middleware: validates `Authorization: Bearer <secret>` on all endpoints except `/health`
- Local SQLite conversation history per chat_id
- LibertAI inference via AsyncOpenAI

### Step 3: Bot Database Layer
SQLite tables: `users`, `agents`, `daily_usage`

```sql
CREATE TABLE agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL REFERENCES users(telegram_id),
    name TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    model TEXT DEFAULT 'hermes-3-8b-tee',
    is_active BOOLEAN DEFAULT 1,
    instance_hash TEXT,
    vm_ipv6 TEXT,
    vm_url TEXT,
    crn_url TEXT,
    auth_token TEXT,            -- encrypted shared secret
    deployment_status TEXT DEFAULT 'pending',
    created_at TEXT, updated_at TEXT
);
```

### Step 4: Aleph Cloud Deployer
`AlephDeployer` class:
1. `create_instance(agent_name)` — Create VM via SDK with credit payment, auto-select CRN
2. `wait_for_allocation(hash, crn_url)` — Poll CRN + scheduler for VM IP (12 retries, 10s apart)
3. `deploy_agent(vm_ip, ssh_port, ...)` — SSH in, install deps, write code via base64, systemd service, Caddy reverse proxy with 2n6.me HTTPS
4. `destroy_instance(hash)` — SDK forget/delete

### Step 5: Telegram Command Handlers
- `/start [agent_id]` — Deep link enters chat mode; no args shows welcome
- `/create` — Multi-step ConversationHandler wizard (name -> prompt -> model -> confirm)
- `/list` — Show user's agents with deployment status
- `/delete <id>` — Destroy VM + soft-delete agent
- `/manage` — Exit chat mode
- `/help` — Command listing

### Step 6: Chat Handler + Proxy
- Check `context.user_data["current_agent_id"]`
- Rate limit free-tier users
- Proxy message to agent VM via HTTP POST
- Split long responses for Telegram's 4096 char limit

### Step 7: Main Entry Point
- Wire all handlers
- `post_init`: initialize DB, deployer
- `app.run_polling()`

### Step 8: Account Handlers
- `/login <api_key>` — Validate via `/credits/balance`, encrypt + store
- `/logout` — Clear stored key
- `/account` — Show status + balance

## Security: Bot-to-Agent HTTP

**Two layers:**

### 1. Authentication — Shared secret per agent
- On deploy, bot generates `secrets.token_urlsafe(32)` per agent
- Stored encrypted (Fernet) in bot's SQLite
- Deployed to agent's `.env` as `AGENT_SECRET`
- Bot sends `Authorization: Bearer {secret}` on every proxied request
- Agent middleware validates — rejects with 401 if wrong

### 2. Encryption — Caddy reverse proxy
- Caddy on each VM provides automatic HTTPS via Let's Encrypt
- Agent FastAPI listens on `localhost:8080` only (not exposed)
- Caddy proxies `https://{hash}.2n6.me -> localhost:8080`
- Bot communicates only via HTTPS URL

## Key Design Decisions

1. **Instances (VMs) over Programs** — Full VMs give agents filesystem access and process isolation
2. **One Telegram bot, deep-link routing** — Single @baal_bot, agents via `t.me/baal_bot?start=agent_N`
3. **Credit system (PAYG)** — `Payment(type=PaymentType.credit)`, bot operator pays via wallet
4. **SSH deployment** — SSH into fresh VM, install deps, copy code, start service
5. **Agent as HTTP server** — Each agent exposes POST `/chat`, bot proxies requests
6. **Async background deployment** — `/create` returns immediately, deployment runs as background task with Telegram status updates
