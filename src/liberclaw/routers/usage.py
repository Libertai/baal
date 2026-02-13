"""Usage tracking routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from liberclaw.auth.dependencies import get_current_user, get_settings
from liberclaw.database.models import User
from liberclaw.database.session import get_db
from liberclaw.schemas.usage import UsageDay, UsageHistory, UsageSummary
from liberclaw.services.usage_tracker import get_agent_count, get_daily_usage, get_usage_history

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("/", response_model=UsageSummary)
async def get_usage_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current usage summary."""
    settings = get_settings()
    daily_used = await get_daily_usage(db, user.id)
    agent_count = await get_agent_count(db, user.id)

    daily_limit = settings.daily_message_limit(user.tier)
    agent_limit = settings.agent_limit(user.tier)

    return UsageSummary(
        daily_messages_used=daily_used,
        daily_messages_limit=daily_limit,
        agent_count=agent_count,
        agent_limit=agent_limit,
        tier=user.tier,
    )


@router.get("/history", response_model=UsageHistory)
async def get_history(
    days: int = Query(default=30, ge=1, le=90),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get daily usage breakdown."""
    history = await get_usage_history(db, user.id, days)
    return UsageHistory(
        days=[UsageDay(date=d["date"], message_count=d["message_count"]) for d in history]
    )
