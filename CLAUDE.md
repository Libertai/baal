# Baal

Telegram bot platform for creating and deploying AI agents on [Aleph Cloud](https://aleph.cloud) with [LibertAI](https://libertai.io) inference.

## Architecture

Two components in one repo:

- **baal** (`src/baal/`) — Telegram bot: control plane, message proxy, VM manager
- **baal-agent** (`src/baal_agent/`) — FastAPI template deployed to each Aleph Cloud VM

Flow: User creates agent via `/create` wizard -> bot provisions Aleph Cloud VM (credit PAYG) -> deploys agent code via SSH -> Caddy provides HTTPS via `*.2n6.me` -> deep link `t.me/baal_bot?start=agent_N` routes chat through bot to agent VM.

## Tech Stack

- Python 3.12+, managed with `uv`
- `python-telegram-bot[ext]` — async Telegram bot framework
- `aleph-sdk-python` — Aleph Cloud instance creation (credit-based payment)
- `openai` — LibertAI client (OpenAI-compatible API at `https://api.libertai.io/v1`)
- `fastapi` + `uvicorn` — agent HTTP server
- `aiosqlite` — async SQLite (WAL mode) for both bot and agent
- `pydantic-settings` — config from `.env`
- `httpx` — HTTP proxy (bot -> agent VMs)
- `cryptography` — Fernet encryption for API keys and auth tokens

## Project Layout

```
src/baal/
  main.py              # Entry point: wire handlers, post_init/post_shutdown, run_polling()
  config.py            # Settings via pydantic-settings (env_file=".env")
  database/db.py       # SQLite tables: users, agents, daily_usage
  handlers/
    commands.py        # /start, /help, /create wizard (ConversationHandler), /list, /delete, /manage
    chat.py            # Message routing + proxy to agent VMs, rate limiting
    account.py         # /login, /logout, /account
  services/
    deployer.py        # AlephDeployer: CRN discovery, instance creation, SSH deployment, Caddy setup
    proxy.py           # HTTP proxy: send_message(), health_check()
    encryption.py      # Fernet encrypt/decrypt
    rate_limiter.py    # Per-user daily message limits

src/baal_agent/
  main.py              # FastAPI app: POST /chat, GET /health, Bearer auth middleware
  config.py            # AgentSettings
  database.py          # Local SQLite conversation history
  inference.py         # AsyncOpenAI wrapper for LibertAI
```

## Running

```bash
uv pip install -e ".[bot]"
python -m baal.main
```

Agent (local testing): `uv pip install -e ".[agent]" && uvicorn baal_agent.main:app --port 8080`

## Configuration

All config via `.env` (see `.env.example`). Key vars: `TELEGRAM_BOT_TOKEN`, `LIBERTAI_API_KEY`, `ALEPH_PRIVATE_KEY`, `ALEPH_SSH_PUBKEY`, `ALEPH_SSH_PRIVKEY_PATH`, `BOT_ENCRYPTION_KEY`.

Project has its own SSH keypair at `.ssh/id_ed25519` (gitignored).

## Key Patterns

- **Shared state via `bot_data`**: `db`, `deployer`, `settings`, `rate_limiter` stored in `context.bot_data` dict
- **ConversationHandler** for `/create` wizard: NAME -> PROMPT -> MODEL (callback query) -> CONFIRM. `per_message=False`.
- **Background deployment**: `_deploy_agent_background()` runs as `context.application.create_task()`, sends Telegram status messages as it progresses
- **Bot-to-agent auth**: per-agent `secrets.token_urlsafe(32)` stored encrypted (Fernet), sent as `Authorization: Bearer` header, validated by agent middleware with `secrets.compare_digest`
- **SSH deployment**: `_safe_write_file_command()` uses base64 encoding to prevent injection when writing files via SSH
- **Agent code is inlined**: `deployer.py:_build_agent_files()` returns agent source as a dict of filename->content strings, written to VM via SSH

## Reference Repos

Patterns were lifted from:
- **libertai-telegram-agent** (`/home/jon/repos/libertai-telegram-agent/`) — bot wiring, DB layer, inference, handlers, rate limiter, encryption
- **aleph-marketplace** (`/home/jon/repos/aleph-marketplace/`) — Aleph Cloud deployer, CRN discovery, SSH executor, Caddy setup

## Available Models

Currently offering: `qwen3-coder-next`, `glm-4.7`. Default: `qwen3-coder-next`. Do NOT offer gemma.

## GitHub

Repo: https://github.com/Libertai/baal
