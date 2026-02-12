# Baal / LiberClaw

Platform for creating and deploying AI agents on [Aleph Cloud](https://aleph.cloud) with [LibertAI](https://libertai.io) inference.

Two frontends share the same agent infrastructure:
- **Baal** — Telegram bot (`@baal_bot`)
- **LiberClaw** — Web and mobile app (Expo)

```
Expo App (web/iOS/Android)          Telegram Bot (@baal_bot)
         |                                |
         v                                v
   LiberClaw API (FastAPI)       Baal Bot (python-telegram-bot)
         |                                |
         +------ baal_core (shared) ------+
         |   deployer, proxy, encryption  |
         v                                v
           Agent VMs (baal-agent on Aleph Cloud)
                      |
                      v
              LibertAI API (inference)
```

Each agent runs on its own isolated Aleph Cloud VM with its own conversation history, system prompt, persistent memory, and tools (bash, file I/O, web fetch, subagent spawning).

## Components

| Component | Location | Description |
|-----------|----------|-------------|
| **baal_core** | `src/baal_core/` | Shared infrastructure: VM deployer, HTTP proxy, encryption, pool manager |
| **baal** | `src/baal/` | Telegram bot: agent CRUD, message proxy, VM lifecycle |
| **baal-agent** | `src/baal_agent/` | FastAPI agent deployed to each VM: chat, tools, memory, skills |
| **liberclaw** | `src/liberclaw/` | Web API: auth (JWT, OAuth, magic link, wallet), agent management, chat proxy |
| **Expo app** | `apps/liberclaw/` | Cross-platform frontend: React Native + Expo Router + NativeWind |

## Setup

Requires Python 3.12+ and [uv](https://docs.astral.sh/uv/).

### Telegram Bot

```bash
git clone git@github.com:Libertai/baal.git && cd baal
uv pip install -e ".[bot]"
cp .env.example .env   # Fill in bot vars
python -m baal.main
```

### LiberClaw (API + Frontend)

```bash
# Install Python API dependencies
uv pip install -e ".[api]"

# Start PostgreSQL
docker compose up -d                    # Port 5433

# Run database migrations
alembic upgrade head

# Start API server
uvicorn liberclaw.main:app --reload     # http://localhost:8000
```

```bash
# In a separate terminal — start the Expo app
cd apps/liberclaw
npm install
npx expo start                          # http://localhost:8081 (web)
```

### Agent (local testing)

```bash
uv pip install -e ".[agent]"
AGENT_NAME=test SYSTEM_PROMPT="Be helpful" MODEL=qwen3-coder-next \
  LIBERTAI_API_KEY=xxx AGENT_SECRET=test WORKSPACE_PATH=/tmp/baal-workspace \
  uvicorn baal_agent.main:app --port 8080
```

## Configuration

All config via `.env`. Bot vars are unprefixed, LiberClaw vars use the `LIBERCLAW_` prefix so they don't conflict.

### Bot

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | From [@BotFather](https://t.me/BotFather) |
| `LIBERTAI_API_KEY` | Default key for free-tier users |
| `ALEPH_PRIVATE_KEY` | Hex-encoded ETH private key for Aleph Cloud |
| `ALEPH_SSH_PUBKEY` | SSH public key injected into VMs |
| `ALEPH_SSH_PRIVKEY_PATH` | Path to matching private key |
| `BOT_ENCRYPTION_KEY` | Fernet key for encrypting secrets at rest |

### LiberClaw API

| Variable | Description |
|----------|-------------|
| `LIBERCLAW_DATABASE_URL` | PostgreSQL connection string |
| `LIBERCLAW_JWT_SECRET` | Secret for signing JWT tokens |
| `LIBERCLAW_ENCRYPTION_KEY` | Fernet key for encrypting API keys |
| `LIBERCLAW_MAGIC_LINK_SECRET` | Secret for signing magic link tokens |
| `LIBERCLAW_RESEND_API_KEY` | [Resend](https://resend.com) API key for sending emails |
| `LIBERCLAW_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `LIBERCLAW_GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `LIBERCLAW_GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `LIBERCLAW_GITHUB_CLIENT_SECRET` | GitHub OAuth client secret |
| `LIBERCLAW_FRONTEND_URL` | Frontend URL for redirects (default `http://localhost:8081`) |
| `LIBERCLAW_CORS_ORIGINS` | Allowed CORS origins (JSON list) |

Generate secrets:
```bash
# Fernet encryption key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# JWT / magic link secret
openssl rand -hex 32
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/create` | Create a new agent (guided wizard) |
| `/list` | List your agents with deployment status |
| `/delete <id>` | Delete an agent and destroy its VM |
| `/manage` | Exit agent chat, return to control plane |
| `/login <key>` | Connect your LibertAI API key |
| `/logout` | Disconnect your API key |
| `/account` | Check account status and balance |
| `/help` | Show available commands |

## API Endpoints

Interactive docs at `http://localhost:8000/docs` when running locally.

| Group | Endpoints | Description |
|-------|-----------|-------------|
| **Auth** | `POST /api/v1/auth/login/email`, `verify-magic-link`, `refresh`, `logout`, OAuth callbacks, wallet challenge/verify | Multi-method authentication |
| **Agents** | `GET/POST /api/v1/agents/`, `GET/PATCH/DELETE /{id}`, `health`, `status`, `repair`, `redeploy` | Agent CRUD + deployment |
| **Chat** | `POST /api/v1/chat/{id}` (SSE), `DELETE`, `GET /pending` | Real-time streaming chat |
| **Files** | `GET /api/v1/files/{agent_id}/{path}` | Download files from agent VMs |
| **Users** | `GET/PATCH /api/v1/users/me`, connections, API keys | Profile and account management |
| **Usage** | `GET /api/v1/usage/`, `/history` | Usage stats and daily breakdown |

## How It Works

1. **Create**: User configures an agent (name, system prompt, model) via Telegram bot or web app
2. **Deploy**: A VM is provisioned on Aleph Cloud, agent code is deployed via SSH, Caddy provides HTTPS via `*.2n6.me`
3. **Chat**: Messages are proxied through the bot or API to the agent VM as SSE streams
4. **Tools**: Agents can execute bash commands, read/write files, fetch web pages, and spawn subagents
5. **Memory**: Agents maintain persistent memory across conversations via file-based storage
6. **Delete**: Tearing down an agent destroys the VM and stops billing

## Security

- **Bot-to-agent auth**: Each agent gets a unique shared secret, stored encrypted (Fernet), sent as `Authorization: Bearer` on every request
- **LiberClaw auth**: JWT with token rotation, multiple sign-in methods (email magic link, Google/GitHub OAuth, Web3 wallet)
- **Transport encryption**: Caddy on each VM provides automatic HTTPS via Let's Encrypt
- **User API keys**: Encrypted at rest with Fernet
- **Agent sandboxing**: Bash safety guards block dangerous commands; each agent runs on an isolated VM

## Available Models

| Model | Context Window |
|-------|---------------|
| `qwen3-coder-next` (default) | 98K tokens |
| `glm-4.7` | 128K tokens |

## License

See [LICENSE](LICENSE).
