"""Local conversation history database for a single agent."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import aiosqlite


class AgentDatabase:
    """Async SQLite wrapper for per-agent conversation history."""

    def __init__(self, db_path: str = "agent.db") -> None:
        self.db_path = db_path
        self._db: aiosqlite.Connection | None = None

    async def initialize(self) -> None:
        self._db = await aiosqlite.connect(self.db_path)
        self._db.row_factory = aiosqlite.Row
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._db.executescript("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT,
                tool_calls TEXT,
                tool_call_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_messages_chat
                ON messages (chat_id, created_at);
        """)

    async def close(self) -> None:
        if self._db is not None:
            await self._db.close()
            self._db = None

    @property
    def db(self) -> aiosqlite.Connection:
        if self._db is None:
            raise RuntimeError("Database not initialized")
        return self._db

    async def add_message(
        self,
        chat_id: str,
        role: str,
        content: str | None,
        *,
        tool_calls: list[dict] | None = None,
        tool_call_id: str | None = None,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        tc_json = json.dumps(tool_calls) if tool_calls else None
        await self.db.execute(
            "INSERT INTO messages (chat_id, role, content, tool_calls, tool_call_id, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (chat_id, role, content, tc_json, tool_call_id, now),
        )
        await self.db.commit()

    async def get_history(self, chat_id: str, limit: int = 50) -> list[dict]:
        cursor = await self.db.execute(
            "SELECT role, content, tool_calls, tool_call_id "
            "FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?",
            (chat_id, limit),
        )
        rows = await cursor.fetchall()
        messages = []
        for r in reversed(rows):
            msg: dict = {"role": r["role"]}
            if r["content"] is not None:
                msg["content"] = r["content"]
            if r["tool_calls"]:
                msg["tool_calls"] = json.loads(r["tool_calls"])
            if r["tool_call_id"]:
                msg["tool_call_id"] = r["tool_call_id"]
            messages.append(msg)
        return messages
