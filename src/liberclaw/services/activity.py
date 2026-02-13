"""Activity event tracking and SSE broadcasting."""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections import deque

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from liberclaw.database.models import ActivityEvent

logger = logging.getLogger(__name__)


class ActivityBroadcaster:
    """In-memory pub/sub for public activity events.

    Holds a bounded deque of recent events. SSE consumers wait on the
    condition and read new events by tracking the last-seen sequence number.
    """

    def __init__(self, maxlen: int = 200):
        self._events: deque[dict] = deque(maxlen=maxlen)
        self._condition = asyncio.Condition()
        self._counter = 0

    async def push(self, event_dict: dict) -> None:
        async with self._condition:
            self._counter += 1
            event_dict["_seq"] = self._counter
            self._events.append(event_dict)
            self._condition.notify_all()

    async def subscribe(self, last_seq: int = 0):
        """Async generator yielding new events after last_seq."""
        # Yield backlog first
        for ev in list(self._events):
            if ev["_seq"] > last_seq:
                yield ev
                last_seq = ev["_seq"]

        # Then wait for new events
        while True:
            async with self._condition:
                await self._condition.wait()
                for ev in list(self._events):
                    if ev["_seq"] > last_seq:
                        yield ev
                        last_seq = ev["_seq"]

    def recent(self, limit: int = 50) -> list[dict]:
        """Get recent events (most recent last)."""
        items = list(self._events)
        return items[-limit:]


# Singleton
broadcaster = ActivityBroadcaster()


def _event_to_dict(event: ActivityEvent) -> dict:
    return {
        "id": str(event.id),
        "event_type": event.event_type,
        "metadata": event.metadata_json or {},
        "is_public": event.is_public,
        "created_at": event.created_at.isoformat(),
    }


async def emit_activity(
    db: AsyncSession,
    event_type: str,
    user_id: uuid.UUID | None = None,
    agent_id: uuid.UUID | None = None,
    metadata: dict | None = None,
    is_public: bool = False,
) -> ActivityEvent:
    """Record an activity event and broadcast if public."""
    event = ActivityEvent(
        user_id=user_id,
        agent_id=agent_id,
        event_type=event_type,
        metadata_json=metadata,
        is_public=is_public,
    )
    db.add(event)
    await db.flush()

    if is_public:
        await broadcaster.push(_event_to_dict(event))

    return event


async def get_user_activity(
    db: AsyncSession, user_id: uuid.UUID, limit: int = 50, offset: int = 0
) -> list[dict]:
    """Fetch paginated activity for a specific user."""
    result = await db.execute(
        select(ActivityEvent)
        .where(ActivityEvent.user_id == user_id)
        .order_by(ActivityEvent.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    events = result.scalars().all()
    return [_event_to_dict(e) for e in events]


async def get_public_activity(
    db: AsyncSession, limit: int = 50, offset: int = 0
) -> list[dict]:
    """Fetch paginated public activity."""
    result = await db.execute(
        select(ActivityEvent)
        .where(ActivityEvent.is_public.is_(True))
        .order_by(ActivityEvent.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    events = result.scalars().all()
    return [_event_to_dict(e) for e in events]
