"""HTTP proxy — forwards chat messages from the bot to agent VMs."""

from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)


async def send_message(
    agent_url: str, auth_token: str, message: str, chat_id: str
) -> str:
    """POST a chat message to an agent VM and return the response text."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{agent_url}/chat",
            json={"message": message, "chat_id": chat_id},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()["response"]


async def health_check(agent_url: str) -> bool:
    """Check if an agent VM is reachable."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{agent_url}/health")
            return resp.status_code == 200
    except Exception:
        return False
