# Baal

Telegram bot platform for creating and deploying AI agents on [Aleph Cloud](https://aleph.cloud) with [LibertAI](https://libertai.io) inference.

Users talk to `@baal_bot` on Telegram, create an agent (name, system prompt, model), and Baal provisions an isolated Aleph Cloud VM, deploys the agent code via SSH, and hands back a shareable deep link. Anyone clicking `t.me/baal_bot?start=agent_N` chats with that agent through the bot, which proxies messages to the VM.

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
             │ HTTPS POST /chat
             v
  ┌──────────────────┐  ┌──────────────────┐
  │  Agent VM #1     │  │  Agent VM #2     │
  │  (Aleph Cloud)   │  │  (Aleph Cloud)   │
  │                  │  │                  │
  │  FastAPI :8080   │  │  FastAPI :8080   │
  │  LibertAI client │  │  LibertAI client │
  │  Local SQLite    │  │  Local SQLite    │
  └──────────────────┘  └──────────────────┘
             │
             v
     LibertAI API (https://api.libertai.io/v1)
```

## Components

| Component | Description |
|-----------|-------------|
| **baal** (`src/baal/`) | Telegram bot — control plane, message proxy, VM manager |
| **baal-agent** (`src/baal_agent/`) | FastAPI template deployed to each Aleph Cloud VM |

## Setup

Requires Python 3.12+.

```bash
# Clone
git clone git@github.com:Libertai/baal.git && cd baal

# Install (bot)
pip install -e ".[bot]"

# Or install (agent, for local testing)
pip install -e ".[agent]"
```

### Configuration

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | From [@BotFather](https://t.me/BotFather) |
| `LIBERTAI_API_KEY` | Bot operator's default key for free-tier users |
| `ALEPH_PRIVATE_KEY` | Hex-encoded ETH private key for Aleph Cloud instance creation |
| `ALEPH_SSH_PUBKEY` | SSH public key injected into VMs |
| `ALEPH_SSH_PRIVKEY_PATH` | Path to matching SSH private key (default `~/.ssh/id_rsa`) |
| `BOT_ENCRYPTION_KEY` | Fernet key for encrypting user API keys at rest |

Generate the encryption key:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## Running

```bash
python -m baal.main
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

## How It Works

1. **Create**: `/create` walks through name, system prompt, and model selection
2. **Deploy**: Baal creates an Aleph Cloud VM (credit-based PAYG), SSHes in, installs the agent code, sets up Caddy for HTTPS via `*.2n6.me`
3. **Share**: Get a deep link like `t.me/baal_bot?start=agent_42`
4. **Chat**: Messages are proxied from Telegram through the bot to the agent VM and back
5. **Delete**: `/delete <id>` tears down the VM and stops billing

Each agent runs on its own isolated VM with its own conversation history, system prompt, and model.

## Security

- **Bot-to-agent auth**: Each agent gets a unique `secrets.token_urlsafe(32)` shared secret, stored encrypted (Fernet) in the bot's DB and deployed as `AGENT_SECRET`. The bot sends `Authorization: Bearer <secret>` on every proxied request; the agent rejects anything else with 401.
- **Transport encryption**: Caddy on each VM provides automatic HTTPS via Let's Encrypt. The agent's FastAPI server only listens on `localhost:8080`.
- **User API keys**: Encrypted at rest with Fernet. The `/login` message containing the key is deleted immediately.

## Docs

- [Architecture & implementation plan](docs/plans/initial-architecture.md)
