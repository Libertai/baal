# src/baal/handlers/error_handlers.py

import html as html_mod

from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.constants import ParseMode

ERROR_CONTEXT = {
    "instance_creation": {
        "title": "Instance Creation Failed",
        "causes": [
            "Aleph Cloud API temporarily unavailable",
            "Insufficient credit balance",
            "Network connectivity issue",
        ],
        "recovery": "Try again in a few minutes, or check Aleph Cloud status.",
    },
    "allocation_timeout": {
        "title": "VM Allocation Timeout",
        "causes": [
            "VM still starting (may take 5-10 minutes)",
            "CRN node overloaded",
            "Instance request queued",
        ],
        "recovery": "Wait a few minutes, then use /repair &lt;agent_id&gt; to retry.",
    },
    "ssh_deployment": {
        "title": "SSH Deployment Failed",
        "causes": [
            "VM still starting (wait 2-3 minutes)",
            "Network firewall blocking SSH",
            "SSH key authentication failed",
        ],
        "recovery": "Use /repair &lt;agent_id&gt; to retry SSH deployment.",
    },
    "health_check": {
        "title": "Health Check Failed",
        "causes": [
            "Agent service not started yet",
            "Port configuration issue",
            "Agent crashed during startup",
        ],
        "recovery": "Check agent logs or use /repair &lt;agent_id&gt;.",
    },
    "unexpected_error": {
        "title": "Deployment Failed",
        "causes": ["An unexpected error occurred"],
        "recovery": "Try deleting and recreating the agent, or contact support.",
    },
}


async def send_deployment_error(
    bot: Bot,
    chat_id: int,
    agent_id: int,
    error_type: str,
    details: str = "",
) -> None:
    """Send a context-rich error message with recovery options.

    Uses HTML parse mode so that dynamic error details can be safely escaped
    with html.escape(), avoiding the fragile Markdown escaping that breaks
    on backticks, asterisks, underscores, etc. in error strings.
    """

    ctx = ERROR_CONTEXT.get(error_type, ERROR_CONTEXT["unexpected_error"])

    keyboard = [
        [
            InlineKeyboardButton("Retry", callback_data=f"retry_deploy:{agent_id}"),
            InlineKeyboardButton("Delete", callback_data=f"delete_confirm:{agent_id}"),
        ],
    ]

    causes_html = "\n".join(f"  - {c}" for c in ctx["causes"])

    # Safely escape dynamic error details for HTML
    safe_details = ""
    if details:
        safe_details = (
            "\n<b>Error Details:</b>\n"
            f"<code>{html_mod.escape(details[:200])}</code>\n"
        )

    message = (
        f"<b>{ctx['title']}</b>\n"
        f"{safe_details}\n"
        f"<b>Possible causes:</b>\n"
        f"{causes_html}\n\n"
        f"<b>Recovery:</b>\n"
        f"{ctx['recovery']}\n\n"
        f"Or use: <code>/repair {agent_id}</code>"
    )

    await bot.send_message(
        chat_id=chat_id,
        text=message,
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(keyboard),
    )
