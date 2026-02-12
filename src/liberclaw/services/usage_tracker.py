"""Daily usage tracking and quota enforcement."""

from __future__ import annotations

import uuid
from datetime import date, timezone, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from liberclaw.database.models import Agent, DailyUsage, UsageEvent


async def check_and_increment(
    db: AsyncSession,
    user_id: uuid.UUID,
    daily_limit: int,
) -> tuple[bool, int]:
    """Check daily limit and increment if allowed. Returns (allowed, remaining)."""
    today = date.today()

    result = await db.execute(
        select(DailyUsage).where(
            DailyUsage.user_id == user_id,
            DailyUsage.date == today,
        )
    )
    usage = result.scalar_one_or_none()

    if usage is None:
        usage = DailyUsage(user_id=user_id, date=today, message_count=0)
        db.add(usage)
        await db.flush()

    if usage.message_count >= daily_limit:
        return False, 0

    usage.message_count += 1
    remaining = daily_limit - usage.message_count
    return True, remaining


async def get_daily_usage(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Get today's message count for a user."""
    today = date.today()
    result = await db.execute(
        select(DailyUsage.message_count).where(
            DailyUsage.user_id == user_id,
            DailyUsage.date == today,
        )
    )
    count = result.scalar_one_or_none()
    return count or 0


async def get_agent_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Get the number of agents owned by a user."""
    result = await db.execute(
        select(func.count(Agent.id)).where(Agent.owner_id == user_id)
    )
    return result.scalar_one()


async def record_event(
    db: AsyncSession,
    user_id: uuid.UUID,
    event_type: str,
    agent_id: uuid.UUID | None = None,
    tokens_used: int = 0,
) -> None:
    """Record a usage event."""
    event = UsageEvent(
        user_id=user_id,
        agent_id=agent_id,
        event_type=event_type,
        tokens_used=tokens_used,
    )
    db.add(event)


async def get_usage_history(
    db: AsyncSession, user_id: uuid.UUID, days: int = 30
) -> list[dict]:
    """Get daily usage breakdown for the last N days."""
    result = await db.execute(
        select(DailyUsage)
        .where(DailyUsage.user_id == user_id)
        .order_by(DailyUsage.date.desc())
        .limit(days)
    )
    rows = result.scalars().all()
    return [{"date": r.date, "message_count": r.message_count} for r in rows]
