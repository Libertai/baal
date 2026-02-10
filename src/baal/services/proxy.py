"""HTTP proxy — forwards chat messages from the bot to agent VMs."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator

import httpx

logger = logging.getLogger(__name__)


async def stream_messages(
    agent_url: str, auth_token: str, message: str, chat_id: str
) -> AsyncGenerator[dict, None]:
    """Stream SSE events from an agent VM. Yields parsed event dicts."""
    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=10.0)) as client:
        async with client.stream(
            "POST",
            f"{agent_url}/chat",
            json={"message": message, "chat_id": chat_id},
            headers={"Authorization": f"Bearer {auth_token}"},
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    try:
                        event = json.loads(line[6:])
                        yield event
                    except json.JSONDecodeError:
                        logger.warning(f"Malformed SSE data: {line}")


async def health_check(agent_url: str) -> bool:
    """Check if an agent VM is reachable."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{agent_url}/health")
            return resp.status_code == 200
    except Exception:
        return False


async def get_pending_messages(agent_url: str, auth_token: str) -> list[dict]:
    """Fetch pending proactive messages from an agent."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{agent_url}/pending",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json().get("messages", [])
