# Baal

Telegram bot platform for creating and deploying AI agents on [Aleph Cloud](https://aleph.cloud) with [LibertAI](https://libertai.io) inference.

## Architecture

Two components in one repo:

- **baal** (`src/baal/`) — Telegram bot: control plane, message proxy, VM manager
- **baal-agent** (`src/baal_agent/`) — FastAPI agent deployed to each Aleph Cloud VM

Flow: User creates agent via `/create` wizard -> bot provisions Aleph Cloud VM (credit PAYG) -> deploys agent code via tar-over-SSH -> Caddy provides HTTPS via `*.2n6.me` -> deep link `t.me/baal_bot?start=agent_N` routes chat through bot to agent VM.

## Tech Stack

- Python 3.12+, managed with `uv`
- `python-telegram-bot[ext]` — async Telegram bot framework
- `aleph-sdk-python` — Aleph Cloud instance creation (credit-based payment)
- `openai` — LibertAI client (OpenAI-compatible API at `https://api.libertai.io/v1`)
- `fastapi` + `uvicorn` — agent HTTP server
- `aiosqlite` — async SQLite (WAL mode) for both bot and agent
- `pydantic-settings` — config from `.env`
- `httpx` — HTTP proxy (bot -> agent VMs), web_fetch tool
- `cryptography` — Fernet encryption for API keys and auth tokens

## Project Layout

```
src/baal/
  main.py              # Entry point: wire handlers, post_init/post_shutdown, run_polling()
  config.py            # Settings via pydantic-settings (env_file=".env")
  database/db.py       # SQLite tables: users, agents, daily_usage
  handlers/
    commands.py        # /start, /help, /create wizard (ConversationHandler), /list, /delete, /manage
    chat.py            # Message routing + proxy to agent VMs, rate limiting, pending message forwarding
    account.py         # /login, /logout, /account
  services/
    deployer.py        # AlephDeployer: CRN discovery, instance creation, tar-over-SSH deployment, Caddy setup
    proxy.py           # HTTP proxy: stream_messages(), health_check(), get_pending_messages()
    encryption.py      # Fernet encrypt/decrypt
    rate_limiter.py    # Per-user daily message limits

src/baal_agent/
  main.py              # FastAPI app: POST /chat, DELETE /chat/{id}, GET /pending, GET /health
                       # Heartbeat loop, subagent spawning, reusable _run_agent_turn()
  config.py            # AgentSettings (workspace_path, owner_chat_id, heartbeat_interval, context budget)
  compaction.py        # Token-aware context management: estimate_tokens(), maybe_compact()
  context.py           # Context builder: assembles system prompt from memory + skills + identity (date-only timestamp for prefix caching)
  database.py          # SQLite: conversation history + pending_messages + compact_history()
  inference.py         # AsyncOpenAI wrapper for LibertAI
  tools.py             # Tool definitions + executors: bash (with safety guards), read/write/edit_file,
                       # list_dir, web_fetch, web_search (optional), spawn
  workspace/           # Template files deployed to each VM
    memory/
      MEMORY.md        # Agent's persistent long-term memory
    skills/
      web-research/SKILL.md
      memory-management/SKILL.md
      weather/SKILL.md
```

## Running

```bash
uv pip install -e ".[bot]"
python -m baal.main
```

Agent (local testing):
```bash
uv pip install -e ".[agent]"
AGENT_NAME=test SYSTEM_PROMPT="Be helpful" MODEL=qwen3-coder-next \
  LIBERTAI_API_KEY=xxx AGENT_SECRET=test WORKSPACE_PATH=/tmp/baal-workspace \
  uvicorn baal_agent.main:app --port 8080
```

## Configuration

All config via `.env` (see `.env.example`). Key vars: `TELEGRAM_BOT_TOKEN`, `LIBERTAI_API_KEY`, `ALEPH_PRIVATE_KEY`, `ALEPH_SSH_PUBKEY`, `ALEPH_SSH_PRIVKEY_PATH`, `BOT_ENCRYPTION_KEY`.

Agent-specific vars (written to VM `.env` by deployer): `AGENT_NAME`, `SYSTEM_PROMPT`, `MODEL`, `AGENT_SECRET`, `WORKSPACE_PATH`, `OWNER_CHAT_ID`, `HEARTBEAT_INTERVAL`.

Context budget vars (optional, have sensible defaults): `MAX_CONTEXT_TOKENS` (0=auto-detect from model), `GENERATION_RESERVE` (4096), `COMPACTION_KEEP_MESSAGES` (20).

Optional: `BRAVE_API_KEY` enables the `web_search` tool (Brave Search API).

Project has its own SSH keypair at `.ssh/id_ed25519` (gitignored).

## Key Patterns

### Bot-side

- **Shared state via `bot_data`**: `db`, `deployer`, `settings`, `rate_limiter` stored in `context.bot_data` dict
- **ConversationHandler** for `/create` wizard: NAME -> PROMPT -> MODEL (callback query) -> CONFIRM. `per_message=False`.
- **Background deployment**: `_deploy_agent_background()` runs as `context.application.create_task()`, sends Telegram status messages as it progresses
- **Bot-to-agent auth**: per-agent `secrets.token_urlsafe(32)` stored encrypted (Fernet), sent as `Authorization: Bearer` header, validated by agent middleware with `secrets.compare_digest`
- **Tar-over-SSH deployment**: `_ssh_pipe_tar()` pipes `tar czf` through SSH to deploy the entire `src/baal_agent/` package (including workspace templates) — no inline code duplication
- **Pending message forwarding**: After each chat stream, bot checks `GET /pending` on the agent for heartbeat/subagent results

### Agent-side

- **Context builder** (`context.py`): `build_system_prompt()` assembles identity + user instructions + memory + skills summary + memory system instructions. Uses date-only timestamp (`%Y-%m-%d`) to keep the system prompt stable across turns for vLLM prefix caching.
- **Context compaction** (`compaction.py`): Token-aware history management. `maybe_compact()` estimates token usage (chars/4 heuristic), and when over budget summarizes old messages via an LLM call (reusing the cached system prompt prefix), replaces them with a user+assistant summary pair in the DB, keeps recent messages intact. Model context sizes: qwen3-coder-next=98K, glm-4.7=128K.
- **Memory system**: File-based persistent memory at `workspace/memory/MEMORY.md` (long-term) + `workspace/memory/YYYY-MM-DD.md` (daily notes). Agent reads/writes via file tools.
- **Skills system**: Markdown files at `workspace/skills/*/SKILL.md`. Summaries loaded into context; full content read on-demand by agent.
- **Bash safety guards**: Regex deny patterns block dangerous commands (`rm -rf /`, `shutdown`, fork bombs, `systemctl stop baal-agent`, etc.) before execution
- **Reusable agentic loop**: `_run_agent_turn()` handles message -> tool loop -> response. Used by `/chat` endpoint, heartbeat, and subagents.
- **Heartbeat service**: Background asyncio task runs every `heartbeat_interval` seconds. Reads `workspace/HEARTBEAT.md`, runs agent if actionable content found, stores results as pending messages.
- **Subagent spawning**: `spawn` tool creates background `asyncio.Task` running `_run_agent_turn()` with restricted tools (no spawn). Results stored in `pending_messages` table.
- **Pending messages**: `pending_messages` SQLite table + `GET /pending` endpoint. Heartbeat and subagent results queued here for bot to poll.
- **SSE error handling**: `/chat` stream wraps agentic loop in try/except, yields `{"type": "error"}` events on failure
- **History compaction in DB** (`database.py`): `compact_history()` deletes old messages, inserts a summary user+assistant pair with timestamps ordered before the kept messages. Compaction only runs at the start of a turn, not mid-loop.

### Tools

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

## Reference Repos

Patterns were lifted from:
- **nanobot** (`/home/jon/repos/nanobot/`) — context builder, memory system, skills, heartbeat, subagents, bash safety, web tools
- **libertai-telegram-agent** (`/home/jon/repos/libertai-telegram-agent/`) — bot wiring, DB layer, inference, handlers, rate limiter, encryption
- **aleph-marketplace** (`/home/jon/repos/aleph-marketplace/`) — Aleph Cloud deployer, CRN discovery, SSH executor, Caddy setup

## Available Models

Currently offering: `qwen3-coder-next`, `glm-4.7`. Default: `qwen3-coder-next`. Do NOT offer gemma.

## GitHub

Repo: https://github.com/Libertai/baal
