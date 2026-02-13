"""Activity feed routes — public SSE stream + REST endpoints."""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from liberclaw.auth.dependencies import get_current_user
from liberclaw.database.models import User
from liberclaw.database.session import get_db
from liberclaw.services.activity import (
    broadcaster,
    get_public_activity,
    get_user_activity,
)

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("/stream")
async def activity_stream():
    """SSE stream of public activity events. No auth required."""

    async def event_generator():
        try:
            async for event in broadcaster.subscribe():
                data = {k: v for k, v in event.items() if k != "_seq"}
                yield f"data: {json.dumps(data)}\n\n"
        except asyncio.CancelledError:
            return

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/public")
async def public_activity(
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Paginated public activity. No auth required."""
    events = await get_public_activity(db, limit=limit, offset=offset)
    return {"events": events}


@router.get("/me")
async def my_activity(
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Paginated activity for the current user."""
    events = await get_user_activity(db, user.id, limit=limit, offset=offset)
    return {"events": events}
