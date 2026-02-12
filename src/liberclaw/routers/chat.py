"""Chat routes — SSE streaming proxy to agent VMs."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from baal_core.encryption import decrypt
from baal_core.proxy import get_pending_messages
from liberclaw.auth.dependencies import get_current_user, get_settings
from liberclaw.database.models import User
from liberclaw.database.session import get_db
from liberclaw.schemas.chat import ChatMessageRequest
from liberclaw.services.agent_manager import get_agent
from liberclaw.services.chat_proxy import proxy_chat_stream
from liberclaw.services.usage_tracker import check_and_increment

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/{agent_id}")
async def send_message(
    agent_id: uuid.UUID,
    body: ChatMessageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message to an agent and stream the response via SSE."""
    settings = get_settings()

    agent = await get_agent(db, agent_id, user.id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.deployment_status != "running" or not agent.vm_url:
        raise HTTPException(status_code=400, detail="Agent is not running")

    # Rate limiting
    allowed, remaining = await check_and_increment(
        db, user.id, settings.free_tier_daily_messages
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Daily message limit reached",
        )

    # Decrypt agent auth token
    auth_token = decrypt(agent.auth_token, settings.encryption_key)
    chat_id = f"{user.id}:{agent.id}"

    return StreamingResponse(
        proxy_chat_stream(agent.vm_url, auth_token, body.message, chat_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.delete("/{agent_id}", status_code=204)
async def clear_chat(
    agent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear conversation history for an agent."""
    settings = get_settings()

    agent = await get_agent(db, agent_id, user.id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if not agent.vm_url:
        raise HTTPException(status_code=400, detail="Agent has no VM")

    auth_token = decrypt(agent.auth_token, settings.encryption_key)
    chat_id = f"{user.id}:{agent.id}"

    import httpx
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.delete(
                f"{agent.vm_url}/chat/{chat_id}",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            resp.raise_for_status()
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to clear chat on agent VM")


@router.get("/{agent_id}/pending")
async def get_pending(
    agent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get pending proactive messages from an agent."""
    settings = get_settings()

    agent = await get_agent(db, agent_id, user.id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if not agent.vm_url:
        return {"messages": []}

    auth_token = decrypt(agent.auth_token, settings.encryption_key)
    messages = await get_pending_messages(agent.vm_url, auth_token)
    return {"messages": messages}
