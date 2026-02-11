"""Database layer for the Baal bot — users, agents, deployments, usage."""

from __future__ import annotations

from datetime import date, datetime, timezone

import aiosqlite


class Database:
    """Async SQLite database wrapper for the Baal control plane."""

    def __init__(self, db_path: str = "baal.db") -> None:
        self.db_path = db_path
        self._db: aiosqlite.Connection | None = None

    async def initialize(self) -> None:
        self._db = await aiosqlite.connect(self.db_path)
        self._db.row_factory = aiosqlite.Row
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._create_tables()

    async def close(self) -> None:
        if self._db is not None:
            await self._db.close()
            self._db = None

    @property
    def db(self) -> aiosqlite.Connection:
        if self._db is None:
            raise RuntimeError("Database is not initialized. Call initialize() first.")
        return self._db

    async def _create_tables(self) -> None:
        await self.db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                telegram_id INTEGER PRIMARY KEY,
                api_key TEXT,
                show_tools BOOLEAN DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS agents (
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
                auth_token TEXT,
                deployment_status TEXT DEFAULT 'pending',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_agents_owner
                ON agents (owner_id);

            CREATE TABLE IF NOT EXISTS daily_usage (
                telegram_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                message_count INTEGER DEFAULT 0,
                PRIMARY KEY (telegram_id, date)
            );

            CREATE TABLE IF NOT EXISTS deployment_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id INTEGER NOT NULL REFERENCES agents(id),
                status TEXT NOT NULL,
                step TEXT,
                error_message TEXT,
                duration_seconds INTEGER,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_deployment_history_agent
                ON deployment_history (agent_id, created_at DESC);
        """)

    # ── Generic helpers ────────────────────────────────────────────────

    async def fetch_all(self, query: str, params: tuple = ()) -> list[dict]:
        cursor = await self.db.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    async def fetch_one(self, query: str, params: tuple = ()) -> dict | None:
        cursor = await self.db.execute(query, params)
        row = await cursor.fetchone()
        return dict(row) if row is not None else None

    # ── User methods ───────────────────────────────────────────────────

    async def ensure_user(self, telegram_id: int) -> dict:
        user = await self.get_user(telegram_id)
        if user is not None:
            return user
        now = datetime.now(timezone.utc).isoformat()
        await self.db.execute(
            "INSERT OR IGNORE INTO users (telegram_id, created_at) VALUES (?, ?)",
            (telegram_id, now),
        )
        await self.db.commit()
        return await self.get_user(telegram_id)  # type: ignore[return-value]

    async def get_user(self, telegram_id: int) -> dict | None:
        return await self.fetch_one(
            "SELECT * FROM users WHERE telegram_id = ?", (telegram_id,)
        )

    async def set_user_api_key(self, telegram_id: int, api_key: str | None) -> None:
        await self.db.execute(
            "UPDATE users SET api_key = ? WHERE telegram_id = ?",
            (api_key, telegram_id),
        )
        await self.db.commit()

    async def get_user_show_tools(self, telegram_id: int) -> bool:
        row = await self.fetch_one(
            "SELECT show_tools FROM users WHERE telegram_id = ?", (telegram_id,)
        )
        return bool(row["show_tools"]) if row else True

    async def set_user_show_tools(self, telegram_id: int, show: bool) -> None:
        await self.db.execute(
            "UPDATE users SET show_tools = ? WHERE telegram_id = ?",
            (1 if show else 0, telegram_id),
        )
        await self.db.commit()

    # ── Agent methods ──────────────────────────────────────────────────

    async def create_agent(
        self,
        owner_id: int,
        name: str,
        system_prompt: str,
        model: str = "hermes-3-8b-tee",
    ) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        cursor = await self.db.execute(
            """INSERT INTO agents (owner_id, name, system_prompt, model, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (owner_id, name, system_prompt, model, now, now),
        )
        await self.db.commit()
        return await self.get_agent(cursor.lastrowid)  # type: ignore[return-value]

    async def get_agent(self, agent_id: int) -> dict | None:
        return await self.fetch_one("SELECT * FROM agents WHERE id = ?", (agent_id,))

    async def list_agents(self, owner_id: int) -> list[dict]:
        return await self.fetch_all(
            "SELECT * FROM agents WHERE owner_id = ? AND is_active = 1 ORDER BY id",
            (owner_id,),
        )

    async def list_running_agents(self) -> list[dict]:
        """Return all running agents across all users (for pending message polling)."""
        return await self.fetch_all(
            "SELECT * FROM agents WHERE is_active = 1 AND deployment_status = 'running' AND vm_url IS NOT NULL AND auth_token IS NOT NULL ORDER BY id",
        )

    async def update_agent_deployment(
        self,
        agent_id: int,
        *,
        instance_hash: str | None = None,
        vm_ipv6: str | None = None,
        vm_url: str | None = None,
        crn_url: str | None = None,
        auth_token: str | None = None,
        deployment_status: str | None = None,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        sets: list[str] = ["updated_at = ?"]
        params: list = [now]
        if instance_hash is not None:
            sets.append("instance_hash = ?")
            params.append(instance_hash)
        if vm_ipv6 is not None:
            sets.append("vm_ipv6 = ?")
            params.append(vm_ipv6)
        if vm_url is not None:
            sets.append("vm_url = ?")
            params.append(vm_url)
        if crn_url is not None:
            sets.append("crn_url = ?")
            params.append(crn_url)
        if auth_token is not None:
            sets.append("auth_token = ?")
            params.append(auth_token)
        if deployment_status is not None:
            sets.append("deployment_status = ?")
            params.append(deployment_status)
        params.append(agent_id)
        await self.db.execute(
            f"UPDATE agents SET {', '.join(sets)} WHERE id = ?", tuple(params)
        )
        await self.db.commit()

    async def delete_agent(self, agent_id: int) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self.db.execute(
            "UPDATE agents SET is_active = 0, deployment_status = 'stopped', updated_at = ? WHERE id = ?",
            (now, agent_id),
        )
        await self.db.commit()

    async def count_agents(self, owner_id: int) -> int:
        row = await self.fetch_one(
            "SELECT COUNT(*) as cnt FROM agents WHERE owner_id = ? AND is_active = 1",
            (owner_id,),
        )
        return row["cnt"] if row else 0

    # ── Daily usage ────────────────────────────────────────────────────

    async def get_daily_usage(self, telegram_id: int) -> dict:
        today = date.today().isoformat()
        row = await self.fetch_one(
            "SELECT message_count FROM daily_usage WHERE telegram_id = ? AND date = ?",
            (telegram_id, today),
        )
        if row is not None:
            return row
        return {"message_count": 0}

    async def increment_usage(self, telegram_id: int) -> None:
        today = date.today().isoformat()
        await self.db.execute(
            """INSERT INTO daily_usage (telegram_id, date, message_count)
                   VALUES (?, ?, 1)
               ON CONFLICT(telegram_id, date)
                   DO UPDATE SET message_count = message_count + 1""",
            (telegram_id, today),
        )
        await self.db.commit()

    # ── Deployment history methods ─────────────────────────────────────

    async def log_deployment_event(
        self,
        agent_id: int,
        status: str,
        step: str | None = None,
        error_message: str | None = None,
        duration_seconds: int | None = None,
    ) -> None:
        """Log a deployment event to history."""
        now = datetime.now(timezone.utc).isoformat()
        await self.db.execute(
            """INSERT INTO deployment_history
               (agent_id, status, step, error_message, duration_seconds, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (agent_id, status, step, error_message, duration_seconds, now),
        )
        await self.db.commit()

    async def get_deployment_history(self, agent_id: int, limit: int = 10) -> list[dict]:
        """Get deployment history for an agent."""
        return await self.fetch_all(
            """SELECT * FROM deployment_history
               WHERE agent_id = ?
               ORDER BY created_at DESC
               LIMIT ?""",
            (agent_id, limit),
        )
