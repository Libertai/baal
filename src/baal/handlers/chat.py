"""Chat handler — routes incoming messages to the correct agent VM via proxy."""

from __future__ import annotations

import logging

from telegram import Update
from telegram.constants import ChatAction
from telegram.error import BadRequest
from telegram.ext import ContextTypes

from baal.database.db import Database
from baal.services.encryption import decrypt
from baal.services.proxy import download_agent_file, get_pending_messages, stream_messages
from baal.services.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

TELEGRAM_MAX_MESSAGE_LENGTH = 4096


async def _send_one(update: Update, text: str, parse_mode: str | None = None) -> None:
    """Send a single message. If parse_mode fails, retry as plain text."""
    try:
        await update.message.reply_text(text, parse_mode=parse_mode)
    except BadRequest as e:
        if "parse entities" in str(e).lower() or "can't find end" in str(e).lower():
            await update.message.reply_text(text)
        else:
            raise


async def _split_and_send(
    update: Update,
    text: str,
    parse_mode: str | None = None,
) -> None:
    """Send a message, splitting into chunks if it exceeds Telegram's limit.

    If parse_mode is set and Telegram rejects the formatting, falls back
    to plain text automatically.
    """
    if len(text) <= TELEGRAM_MAX_MESSAGE_LENGTH:
        await _send_one(update, text, parse_mode=parse_mode)
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
        await _send_one(update, chunk, parse_mode=parse_mode)


async def _handle_pending_file(
    update: Update,
    agent_url: str,
    auth_token: str,
    agent_name: str,
    content: str,
) -> None:
    """Download and send a file from a pending message."""
    import io
    import json

    try:
        meta = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return
    file_path = meta.get("path", "")
    caption = meta.get("caption") or None
    if caption:
        caption = f"*{agent_name}*: {caption}"

    file_result = await download_agent_file(agent_url, auth_token, file_path)
    if file_result:
        data, filename, is_photo = file_result
        if is_photo:
            await update.message.reply_photo(
                io.BytesIO(data), caption=caption, parse_mode="Markdown",
            )
        else:
            await update.message.reply_document(
                io.BytesIO(data), filename=filename,
                caption=caption, parse_mode="Markdown",
            )
    else:
        await update.message.reply_text("(Failed to download file from agent)")


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
            from datetime import datetime, timezone, timedelta
            from telegram import InlineKeyboardButton, InlineKeyboardMarkup

            # Calculate time until midnight UTC
            now = datetime.now(timezone.utc)
            tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            delta = tomorrow - now
            hours = int(delta.total_seconds() // 3600)
            minutes = int((delta.total_seconds() % 3600) // 60)

            usage = await db.get_daily_usage(telegram_id)
            current = usage["message_count"]
            limit = rate_limiter._daily_messages

            keyboard = [
                [
                    InlineKeyboardButton("🔑 Connect API Key", callback_data="quick_login"),
                    InlineKeyboardButton("💳 View Account", callback_data="quick_account"),
                ],
            ]

            await update.message.reply_text(
                f"⚠️ *Daily Limit Reached*\n\n"
                f"You've used {current}/{limit} free messages today.\n"
                f"Resets in {hours}h {minutes}m (00:00 UTC)\n\n"
                f"Connect your LibertAI API key for unlimited messages.",
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup(keyboard),
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
                await _split_and_send(
                    update,
                    f"*{agent_name}*: {event['content']}",
                    parse_mode="Markdown",
                )
                # Keep typing indicator alive for next iteration
                await update.message.chat.send_action(ChatAction.TYPING)

            elif event_type == "error":
                error_text = event.get("content", "Something went wrong")
                await _split_and_send(update, f"Warning: {error_text}")

            elif event_type == "file":
                file_result = await download_agent_file(
                    agent["vm_url"], auth_token, event.get("path", "")
                )
                if file_result:
                    import io
                    data, filename, is_photo = file_result
                    caption = event.get("caption") or None
                    if caption:
                        caption = f"*{agent_name}*: {caption}"
                    if is_photo:
                        await update.message.reply_photo(
                            io.BytesIO(data), caption=caption, parse_mode="Markdown",
                        )
                    else:
                        await update.message.reply_document(
                            io.BytesIO(data), filename=filename,
                            caption=caption, parse_mode="Markdown",
                        )
                else:
                    await update.message.reply_text("(Failed to download file from agent)")
                await update.message.chat.send_action(ChatAction.TYPING)

            elif event_type == "tool_use" and show_tools:
                await update.message.reply_text(f"\u2699\ufe0f {event['name']}")
                await update.message.chat.send_action(ChatAction.TYPING)

            elif event_type == "done":
                break

        # Check for pending messages from heartbeat/subagents
        try:
            pending = await get_pending_messages(agent["vm_url"], auth_token)
            for msg in pending:
                source = msg.get("source", "")
                if source.endswith("_file"):
                    await _handle_pending_file(
                        update, agent["vm_url"], auth_token, agent_name, msg["content"]
                    )
                else:
                    await _split_and_send(
                        update,
                        f"*{agent_name}*: {msg['content']}",
                        parse_mode="Markdown",
                    )
        except Exception:
            pass  # Non-critical

        # Add persistent navigation on first interaction
        interaction_count = context.user_data.get(f"agent_{agent_id}_interactions", 0)
        if interaction_count == 0:
            from telegram import InlineKeyboardButton, InlineKeyboardMarkup

            # Check current tool visibility setting
            tool_emoji = "👁️" if show_tools else "🙈"
            tool_text = "Hide Tools" if show_tools else "Show Tools"

            nav_keyboard = InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("🏠 Main Menu", callback_data="nav_main"),
                    InlineKeyboardButton("📋 My Agents", callback_data="nav_list"),
                ],
                [
                    InlineKeyboardButton("⚙️ Account", callback_data="nav_account"),
                    InlineKeyboardButton(f"{tool_emoji} {tool_text}", callback_data="toggle_tools"),
                ],
            ])
            # Just show the navigation buttons without extra text
            await update.message.reply_text(
                ".",  # Telegram requires some text, use minimal
                reply_markup=nav_keyboard,
            )

        context.user_data[f"agent_{agent_id}_interactions"] = interaction_count + 1

    except Exception as e:
        logger.error(f"Proxy error for agent {agent_id}: {type(e).__name__}: {e}", exc_info=True)
        await update.message.reply_text(
            "Sorry, something went wrong while talking to the agent. Please try again in a moment."
        )
