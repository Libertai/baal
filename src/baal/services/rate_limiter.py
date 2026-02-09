"""Rate limiter for free-tier users."""

from __future__ import annotations

from baal.database.db import Database


class RateLimiter:
    """Enforces per-user daily message limits."""

    def __init__(self, db: Database | None, daily_messages: int = 50) -> None:
        self._db = db
        self._daily_messages = daily_messages

    @property
    def db(self) -> Database:
        if self._db is None:
            raise RuntimeError("RateLimiter database not set")
        return self._db

    @db.setter
    def db(self, value: Database) -> None:
        self._db = value

    async def check_and_increment(self, telegram_id: int) -> tuple[bool, int]:
        """Check limit, increment if allowed. Returns (allowed, remaining)."""
        usage = await self.db.get_daily_usage(telegram_id)
        current = usage["message_count"]
        if current >= self._daily_messages:
            return False, 0
        await self.db.increment_usage(telegram_id)
        return True, self._daily_messages - current - 1
