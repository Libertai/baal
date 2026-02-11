"""HTTP proxy — forwards chat messages from the bot to agent VMs."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator

import httpx

logger = logging.getLogger(__name__)

# Timeout configuration for SSE streaming to agent VMs.
# - connect: 10s to establish TCP connection
# - read: 180s between chunks (agent tool execution can be slow, but not *this* slow)
# - write: 10s to send the request body
# - pool: 10s to acquire a connection from the pool
_STREAM_TIMEOUT = httpx.Timeout(connect=10.0, read=180.0, write=10.0, pool=10.0)

# Maximum retries for transient connection failures
_MAX_RETRIES = 2
_RETRY_DELAY = 1.0  # seconds


async def stream_messages(
    agent_url: str, auth_token: str, message: str, chat_id: str
) -> AsyncGenerator[dict, None]:
    """Stream SSE events from an agent VM. Yields parsed event dicts.

    Handles connection drops gracefully by catching partial-read errors
    and yielding an error event instead of crashing. Retries on transient
    connection failures (connection reset, DNS, etc.) up to _MAX_RETRIES.
    """
    import asyncio

    last_error: Exception | None = None

    for attempt in range(_MAX_RETRIES + 1):
        if attempt > 0:
            logger.info(
                f"Retrying agent connection (attempt {attempt + 1}/{_MAX_RETRIES + 1})"
            )
            await asyncio.sleep(_RETRY_DELAY * attempt)

        try:
            async with httpx.AsyncClient(timeout=_STREAM_TIMEOUT) as client:
                async with client.stream(
                    "POST",
                    f"{agent_url}/chat",
                    json={"message": message, "chat_id": chat_id},
                    headers={"Authorization": f"Bearer {auth_token}"},
                ) as resp:
                    resp.raise_for_status()
                    got_any_event = False
                    try:
                        async for line in resp.aiter_lines():
                            if line.startswith("data: "):
                                try:
                                    event = json.loads(line[6:])
                                    if event.get("type") == "keepalive":
                                        continue  # Swallow keepalive, don't forward
                                    got_any_event = True
                                    yield event
                                    if event.get("type") == "done":
                                        return
                                except json.JSONDecodeError:
                                    logger.warning(f"Malformed SSE data: {line}")
                    except httpx.RemoteProtocolError as e:
                        # "peer closed connection without sending complete message body"
                        # This is the specific error we're targeting.
                        logger.warning(
                            f"Connection dropped mid-stream (got events: {got_any_event}): {e}"
                        )
                        if got_any_event:
                            # We already yielded partial results; emit error + done
                            yield {"type": "error", "content": "Connection to agent lost mid-response."}
                            yield {"type": "done"}
                            return
                        # No events yet — worth retrying
                        last_error = e
                        continue
                    except httpx.ReadTimeout as e:
                        logger.warning(f"Read timeout on SSE stream: {e}")
                        if got_any_event:
                            yield {"type": "error", "content": "Agent stopped responding."}
                            yield {"type": "done"}
                            return
                        last_error = e
                        continue

                    # Stream ended without a "done" event (connection closed cleanly
                    # but the agent didn't send the terminator)
                    if got_any_event:
                        logger.info("SSE stream ended without 'done' event")
                        yield {"type": "done"}
                    return

        except httpx.ConnectError as e:
            logger.warning(f"Connection failed to {agent_url}: {e}")
            last_error = e
            continue
        except httpx.ConnectTimeout as e:
            logger.warning(f"Connection timed out to {agent_url}: {e}")
            last_error = e
            continue
        except httpx.HTTPStatusError as e:
            # Non-retryable: 401, 404, 500, etc.
            logger.error(f"Agent returned HTTP {e.response.status_code}: {e}")
            yield {"type": "error", "content": f"Agent error (HTTP {e.response.status_code})."}
            yield {"type": "done"}
            return
        except httpx.ReadTimeout as e:
            # Timeout before any response body arrived
            logger.warning(f"Read timeout waiting for agent response: {e}")
            last_error = e
            continue

    # All retries exhausted
    logger.error(f"All {_MAX_RETRIES + 1} attempts failed for {agent_url}: {last_error}")
    yield {"type": "error", "content": "Could not connect to agent after multiple attempts."}
    yield {"type": "done"}


async def health_check(agent_url: str) -> bool:
    """Check if an agent VM is reachable."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{agent_url}/health")
            return resp.status_code == 200
    except Exception:
        return False


_IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".gif", ".webp"})
_TELEGRAM_PHOTO_MAX = 10 * 1024 * 1024  # 10 MB

_FILE_TIMEOUT = httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=10.0)


async def download_agent_file(
    agent_url: str, auth_token: str, file_path: str
) -> tuple[bytes, str, bool] | None:
    """Download a file from an agent VM's /files/ endpoint.

    Returns:
        (file_bytes, filename, is_photo) on success, or None on failure.
    """
    try:
        async with httpx.AsyncClient(timeout=_FILE_TIMEOUT) as client:
            resp = await client.get(
                f"{agent_url}/files/{file_path}",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            resp.raise_for_status()
            data = resp.content
            filename = file_path.rsplit("/", 1)[-1] if "/" in file_path else file_path
            ext = ("." + filename.rsplit(".", 1)[-1]).lower() if "." in filename else ""
            is_photo = ext in _IMAGE_EXTENSIONS and len(data) <= _TELEGRAM_PHOTO_MAX
            return data, filename, is_photo
    except Exception as e:
        logger.error(f"Failed to download file {file_path} from {agent_url}: {e}")
        return None


async def get_pending_messages(agent_url: str, auth_token: str) -> list[dict]:
    """Fetch pending proactive messages from an agent."""
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
            resp = await client.get(
                f"{agent_url}/pending",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            resp.raise_for_status()
            return resp.json().get("messages", [])
    except (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError) as e:
        logger.debug(f"Failed to fetch pending messages: {e}")
        return []
