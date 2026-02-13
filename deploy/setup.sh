#!/usr/bin/env bash
set -euo pipefail

# LiberClaw server bootstrap script
# Run on a fresh Aleph Cloud VM (Debian/Ubuntu)
# Usage: ssh -A root@<VM_IP> 'bash -s' < deploy/setup.sh

REPO_DIR="/root/liberclaw"
REPO_URL="git@github.com:Libertai/baal.git"
BRANCH="liberclaw"
PG_USER="liberclaw"
PG_DB="liberclaw"
# URL-safe password (no special chars that break connection strings)
PG_PASS="$(openssl rand -hex 24)"

echo "=== LiberClaw Server Setup ==="

# ── 1. System packages ──────────────────────────────────────────────

echo "--- Installing system packages ---"
apt-get update
apt-get install -y curl gnupg2 lsb-release git build-essential libpq-dev

# Node.js 22 (nodesource)
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi
echo "Node: $(node --version)"

# Python 3.12
if ! command -v python3.12 &>/dev/null; then
    apt-get install -y python3.12 python3.12-venv python3.12-dev
fi

# uv (Python package manager)
if ! command -v uv &>/dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

# PostgreSQL 16
if ! command -v pg_isready &>/dev/null; then
    sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
    apt-get update
    apt-get install -y postgresql-16
fi
systemctl enable --now postgresql

# Caddy
if ! command -v caddy &>/dev/null; then
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update
    apt-get install -y caddy
fi

# ── 2. Clone repo ───────────────────────────────────────────────────

echo "--- Cloning repository ---"
mkdir -p ~/.ssh
ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null
if [ ! -d "$REPO_DIR" ]; then
    git clone -b "$BRANCH" "$REPO_URL" "$REPO_DIR"
else
    cd "$REPO_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
fi

# ── 3. PostgreSQL setup ─────────────────────────────────────────────

echo "--- Setting up PostgreSQL ---"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$PG_USER'" | grep -q 1; then
    sudo -u postgres psql -c "CREATE USER $PG_USER WITH PASSWORD '$PG_PASS';"
    echo "Created PostgreSQL user: $PG_USER"
else
    sudo -u postgres psql -c "ALTER USER $PG_USER WITH PASSWORD '$PG_PASS';"
    echo "Updated PostgreSQL user password"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$PG_DB'" | grep -q 1; then
    sudo -u postgres psql -c "CREATE DATABASE $PG_DB OWNER $PG_USER;"
    echo "Created database: $PG_DB"
else
    echo "Database $PG_DB already exists"
fi

echo ""
echo ">>> PostgreSQL password for .env: $PG_PASS"
echo ">>> Connection string: postgresql+asyncpg://$PG_USER:$PG_PASS@localhost/$PG_DB"
echo ""

# ── 4. Python environment ───────────────────────────────────────────

echo "--- Setting up Python environment ---"
cd "$REPO_DIR"
export PATH="$HOME/.local/bin:$PATH"
if [ ! -d ".venv" ]; then
    uv venv --python 3.12
fi
uv pip install -e ".[api]"

# ── 5. Database migrations ──────────────────────────────────────────

echo "--- Running database migrations ---"
# alembic.ini has the dev URL; override for production
sed -i "s|sqlalchemy.url = .*|sqlalchemy.url = postgresql+asyncpg://$PG_USER:$PG_PASS@localhost/$PG_DB|" "$REPO_DIR/alembic.ini"
.venv/bin/alembic upgrade head

# ── 6. Build landing site ───────────────────────────────────────────

echo "--- Building landing site ---"
cd "$REPO_DIR/sites/landing"
npm ci
npm run build

# ── 7. Build Expo web app ───────────────────────────────────────────

echo "--- Building Expo web app ---"
cd "$REPO_DIR/apps/liberclaw"
npm ci
EXPO_PUBLIC_API_URL=https://api.liberclaw.ai/api/v1 npx expo export --platform web

# ── 8. Install Caddy config ─────────────────────────────────────────

echo "--- Configuring Caddy ---"
# Copy (not symlink) because Caddy runs as caddy user and can't traverse /root/
cp "$REPO_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
chmod 644 /etc/caddy/Caddyfile
# Allow caddy user to read static files under /root/
chmod 711 /root
chmod -R o+rX "$REPO_DIR/sites/landing/dist" "$REPO_DIR/apps/liberclaw/dist"
systemctl enable caddy

# ── 9. Install API systemd service ──────────────────────────────────

echo "--- Installing API service ---"
cp "$REPO_DIR/deploy/liberclaw-api.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable liberclaw-api

# ── 10. Generate .env from template ─────────────────────────────────

echo "--- Generating .env ---"
if [ ! -f "$REPO_DIR/.env" ]; then
    cp "$REPO_DIR/deploy/.env.production" "$REPO_DIR/.env"
    sed -i "s|CHANGE_ME|$PG_PASS|" "$REPO_DIR/.env"
    JWT_SECRET=$(.venv/bin/python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    ENC_KEY=$(.venv/bin/python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    MAGIC_SECRET=$(.venv/bin/python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    sed -i "s|^LIBERCLAW_JWT_SECRET=$|LIBERCLAW_JWT_SECRET=$JWT_SECRET|" "$REPO_DIR/.env"
    sed -i "s|^LIBERCLAW_ENCRYPTION_KEY=$|LIBERCLAW_ENCRYPTION_KEY=$ENC_KEY|" "$REPO_DIR/.env"
    sed -i "s|^LIBERCLAW_MAGIC_LINK_SECRET=$|LIBERCLAW_MAGIC_LINK_SECRET=$MAGIC_SECRET|" "$REPO_DIR/.env"
    echo "Generated .env with secrets (fill in OAuth and Aleph keys manually)"
else
    echo ".env already exists, skipping"
fi

# ── 11. Start services ──────────────────────────────────────────────

echo "--- Starting services ---"
systemctl start caddy
systemctl start liberclaw-api

echo ""
echo "=== Setup complete ==="
echo ""
echo "Verify:"
echo "  curl https://liberclaw.ai"
echo "  curl https://api.liberclaw.ai/api/v1/health"
echo "  curl https://app.liberclaw.ai"
echo ""
echo "Remaining manual steps:"
echo "  - Fill in OAuth credentials and Aleph keys in $REPO_DIR/.env"
echo "  - Restart API after .env changes: systemctl restart liberclaw-api"
