"""Chat handler — routes incoming messages to the correct agent VM via proxy."""

from __future__ import annotations

import logging

from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import ContextTypes

from baal.database.db import Database
from baal.services.encryption import decrypt
from baal.services.proxy import stream_messages
from baal.services.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

TELEGRAM_MAX_MESSAGE_LENGTH = 4096


async def _split_and_send(update: Update, text: str) -> None:
    """Send a message, splitting into chunks if it exceeds Telegram's limit."""
    if len(text) <= TELEGRAM_MAX_MESSAGE_LENGTH:
        await update.message.reply_text(text)
        return

    chunks: list[str] = []
    while text:
        if len(text) <= TELEGRAM_MAX_MESSAGE_LENGTH:
            chunks.append(text)
            break
        split_at = text.rfind("\n\n", 0, TELEGRAM_MAX_MESSAGE_LENGTH)
        if split_at == -1:
            split_at = text.rfind("\n", 0, TELEGRAM_MAX_MESSAGE_LENGTH)
        if split_at == -1:
            split_at = TELEGRAM_MAX_MESSAGE_LENGTH
        chunks.append(text[:split_at])
        text = text[split_at:].lstrip()

    for chunk in chunks:
        await update.message.reply_text(chunk)


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Route a text message to the correct agent VM or prompt user."""
    if not update.message or not update.effective_user:
        return

    agent_id = context.user_data.get("current_agent_id")
    if not agent_id:
        await update.message.reply_text(
            "You're not chatting with any agent.\n"
            "Use a deep link like `t.me/baal_bot?start=agent_1` to start,\n"
            "or use /create to make your own agent.",
            parse_mode="Markdown",
        )
        return

    db: Database = context.bot_data["db"]
    settings = context.bot_data["settings"]
    rate_limiter: RateLimiter = context.bot_data["rate_limiter"]
    encryption_key = settings.bot_encryption_key
    telegram_id = update.effective_user.id

    await db.ensure_user(telegram_id)

    # Rate limit check for free-tier users
    user = await db.get_user(telegram_id)
    is_connected = user and user["api_key"]
    if not is_connected:
        allowed, remaining = await rate_limiter.check_and_increment(telegram_id)
        if not allowed:
            await update.message.reply_text(
                "You've reached your daily message limit.\n"
                "Come back tomorrow, or connect your own API key with /login."
            )
            return

    # Look up agent
    agent = await db.get_agent(agent_id)
    if not agent or not agent["is_active"]:
        context.user_data.pop("current_agent_id", None)
        await update.message.reply_text("This agent no longer exists.")
        return

    if agent["deployment_status"] != "running" or not agent["vm_url"]:
        await update.message.reply_text(
            f"Agent \"{agent['name']}\" is not ready (status: {agent['deployment_status']})."
        )
        return

    if not agent["auth_token"]:
        await update.message.reply_text("Agent configuration error. Please contact the agent owner.")
        return

    auth_token = decrypt(agent["auth_token"], encryption_key)
    agent_name = agent["name"]
    show_tools = await db.get_user_show_tools(telegram_id)

    # Send typing indicator
    await update.message.chat.send_action(ChatAction.TYPING)

    # Stream messages from the agent VM
    chat_id = str(update.effective_chat.id)
    try:
        async for event in stream_messages(
            agent_url=agent["vm_url"],
            auth_token=auth_token,
            message=update.message.text,
            chat_id=chat_id,
        ):
            event_type = event.get("type")

            if event_type == "text":
                await _split_and_send(update, f"*{agent_name}*: {event['content']}")
                # Keep typing indicator alive for next iteration
                await update.message.chat.send_action(ChatAction.TYPING)

            elif event_type == "tool_use" and show_tools:
                await update.message.reply_text(f"\u2699\ufe0f {event['name']}")
                await update.message.chat.send_action(ChatAction.TYPING)

            elif event_type == "done":
                break

    except Exception as e:
        logger.error(f"Proxy error for agent {agent_id}: {e}")
        await update.message.reply_text(
            "Sorry, couldn't reach the agent right now. Please try again in a moment."
        )
