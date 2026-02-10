# src/baal/handlers/error_handlers.py

from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup

ERROR_CONTEXT = {
    "instance_creation": {
        "title": "Instance Creation Failed",
        "causes": [
            "• Aleph Cloud API temporarily unavailable",
            "• Insufficient credit balance",
            "• Network connectivity issue",
        ],
        "recovery": "Try again in a few minutes, or check Aleph Cloud status.",
    },
    "allocation_timeout": {
        "title": "VM Allocation Timeout",
        "causes": [
            "• VM still starting (may take 5-10 minutes)",
            "• CRN node overloaded",
            "• Instance request queued",
        ],
        "recovery": "Wait a few minutes, then use /repair <agent_id> to retry.",
    },
    "ssh_deployment": {
        "title": "SSH Deployment Failed",
        "causes": [
            "• VM still starting (wait 2-3 minutes)",
            "• Network firewall blocking SSH",
            "• SSH key authentication failed",
        ],
        "recovery": "Use /repair <agent_id> to retry SSH deployment.",
    },
    "health_check": {
        "title": "Health Check Failed",
        "causes": [
            "• Agent service not started yet",
            "• Port configuration issue",
            "• Agent crashed during startup",
        ],
        "recovery": "Check agent logs or use /repair <agent_id>.",
    },
    "unexpected_error": {
        "title": "Deployment Failed",
        "causes": ["• An unexpected error occurred"],
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
    """Send a context-rich error message with recovery options."""

    ctx = ERROR_CONTEXT.get(error_type, ERROR_CONTEXT["unexpected_error"])

    keyboard = [
        [
            InlineKeyboardButton("🔄 Retry", callback_data=f"retry_deploy:{agent_id}"),
            InlineKeyboardButton("🗑️ Delete", callback_data=f"delete_confirm:{agent_id}"),
        ],
    ]

    message = (
        f"❌ *{ctx['title']}*\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Error Details:\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
    )

    if details:
        # Escape markdown special characters in error details
        safe_details = details[:200].replace('\\', '\\\\').replace('`', '\\`').replace('*', '\\*').replace('_', '\\_')
        message += f"`{safe_details}`\n\n"

    message += (
        f"Possible causes:\n"
        + "\n".join(ctx['causes']) + "\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Recovery Options:\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"{ctx['recovery']}\n\n"
        f"Or use: `/repair {agent_id}`"
    )

    await bot.send_message(
        chat_id=chat_id,
        text=message,
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )
