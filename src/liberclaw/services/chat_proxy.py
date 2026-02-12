"""SSE streaming proxy — forwards chat from API to agent VMs."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator

from baal_core.proxy import get_pending_messages, stream_messages

logger = logging.getLogger(__name__)


async def proxy_chat_stream(
    agent_url: str,
    auth_token: str,
    message: str,
    chat_id: str,
) -> AsyncGenerator[str, None]:
    """Proxy SSE events from an agent VM, yielding formatted SSE lines.

    Translates the agent's JSON events into SSE text format for the client.
    After the main stream completes, checks for pending proactive messages
    and yields those as additional events.
    """
    async for event in stream_messages(agent_url, auth_token, message, chat_id):
        yield f"data: {json.dumps(event)}\n\n"

        if event.get("type") == "done":
            # Check for pending messages after completion
            try:
                pending = await get_pending_messages(agent_url, auth_token)
                for msg in pending:
                    yield f"data: {json.dumps(msg)}\n\n"
            except Exception as e:
                logger.debug(f"Failed to fetch pending messages: {e}")
            return

    # Stream ended without done event
    yield f"data: {json.dumps({'type': 'done'})}\n\n"
