"""Re-export from baal_core for backwards compatibility."""

from baal_core.proxy import (
    download_agent_file,
    get_pending_messages,
    health_check,
    send_chat_message,
    stream_messages,
)

__all__ = [
    "download_agent_file",
    "get_pending_messages",
    "health_check",
    "send_chat_message",
    "stream_messages",
]
