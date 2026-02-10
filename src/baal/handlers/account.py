"""Handlers for /login, /logout, and /account commands."""

from __future__ import annotations

import httpx
from telegram import Update
from telegram.ext import ContextTypes

from baal.database.db import Database
from baal.services.encryption import decrypt, encrypt


async def _validate_api_key(api_base_url: str, api_key: str) -> float | None:
    """Validate API key by checking credit balance. Returns balance or None."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{api_base_url}/credits/balance",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if response.status_code == 200:
                return response.json()["balance"]
            return None
    except Exception:
        return None


async def login_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /login <api_key>."""
    if not context.args:
        await update.message.reply_text(
            "Usage: /login <api_key>\n\n"
            "Get your API key from https://libertai.io and send it here.\n"
            "Your message will be deleted immediately for security."
        )
        return

    api_key = context.args[0]

    # Delete the message containing the key ASAP
    try:
        await update.message.delete()
    except Exception:
        pass

    db: Database = context.bot_data["db"]
    settings = context.bot_data["settings"]
    encryption_key = settings.bot_encryption_key
    user_id = update.effective_user.id
    chat_id = update.effective_chat.id

    balance = await _validate_api_key(settings.libertai_api_base_url, api_key)
    if balance is None:
        await context.bot.send_message(
            chat_id=chat_id,
            text="Invalid API key. Please check your key and try again.",
        )
        return

    await db.ensure_user(user_id)
    encrypted = encrypt(api_key, encryption_key)
    await db.set_user_api_key(user_id, encrypted)

    await context.bot.send_message(
        chat_id=chat_id,
        text=f"API key connected! Balance: {balance} credits.",
    )


async def logout_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /logout."""
    db: Database = context.bot_data["db"]
    user_id = update.effective_user.id
    await db.ensure_user(user_id)
    await db.set_user_api_key(user_id, None)
    await update.message.reply_text("Logged out. Your API key has been removed.")


async def account_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Display rich account dashboard."""
    from datetime import datetime, timezone, timedelta
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup

    db: Database = context.bot_data["db"]
    settings = context.bot_data["settings"]
    encryption_key = settings.bot_encryption_key
    user_id = update.effective_user.id

    user = await db.ensure_user(user_id)
    agents = await db.list_agents(user_id)

    # Count agent statuses
    status_counts = {"running": 0, "deploying": 0, "failed": 0, "stopped": 0}
    for agent in agents:
        status = agent["deployment_status"]
        if status in status_counts:
            status_counts[status] += 1

    max_agents = getattr(settings, "max_agents_per_user", 3)

    if user["api_key"]:
        # Connected account dashboard
        api_key = decrypt(user["api_key"], encryption_key)
        balance = await _validate_api_key(settings.libertai_api_base_url, api_key)

        # Mask API key (show last 6 chars)
        masked_key = f"****...{api_key[-6:]}" if len(api_key) > 6 else "****"

        keyboard = [
            [
                InlineKeyboardButton("🚪 Logout", callback_data="account_logout"),
                InlineKeyboardButton("📋 My Agents", callback_data="quick_list"),
            ],
            [
                InlineKeyboardButton("🔄 Refresh", callback_data="account_refresh"),
            ],
        ]

        balance_text = f"{balance:.2f} credits" if balance is not None else "Unable to fetch"

        message = (
            f"💳 *Account Dashboard*\n\n"
            f"*Account Type*\n"
            f"✨ Connected • Balance: {balance_text}\n"
            f"API Key: `{masked_key}`\n\n"
            f"*Your Agents*\n"
            f"{len(agents)}/{max_agents} slots • "
            f"🟢 {status_counts['running']} running • "
            f"🟡 {status_counts['deploying']} deploying • "
            f"🔴 {status_counts['failed']} failed"
        )

        await update.message.reply_text(
            message,
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard),
        )
    else:
        # Free tier dashboard
        usage = await db.get_daily_usage(user_id)
        current = usage["message_count"]
        limit = 50  # Default free tier limit

        # Calculate reset time
        now = datetime.now(timezone.utc)
        tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        delta = tomorrow - now
        hours = int(delta.total_seconds() // 3600)
        minutes = int((delta.total_seconds() % 3600) // 60)

        keyboard = [
            [
                InlineKeyboardButton("🔑 Connect API Key", callback_data="account_login"),
                InlineKeyboardButton("📋 My Agents", callback_data="quick_list"),
            ],
        ]

        message = (
            f"💳 *Account Dashboard*\n\n"
            f"*Account Type*\n"
            f"🆓 Free Tier • {current}/{limit} messages today\n"
            f"Resets in {hours}h {minutes}m\n\n"
            f"*Your Agents*\n"
            f"{len(agents)}/{max_agents} slots • "
            f"🟢 {status_counts['running']} running • "
            f"🟡 {status_counts['deploying']} deploying • "
            f"🔴 {status_counts['failed']} failed\n\n"
            f"*Upgrade*\n"
            f"Connect your LibertAI API key for unlimited messages"
        )

        await update.message.reply_text(
            message,
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard),
        )
