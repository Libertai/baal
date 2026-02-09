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
    """Handle /account."""
    db: Database = context.bot_data["db"]
    settings = context.bot_data["settings"]
    encryption_key = settings.bot_encryption_key
    user_id = update.effective_user.id

    user = await db.ensure_user(user_id)

    if user["api_key"]:
        api_key = decrypt(user["api_key"], encryption_key)
        balance = await _validate_api_key(settings.libertai_api_base_url, api_key)
        if balance is not None:
            await update.message.reply_text(
                f"Connected with API key.\n"
                f"Balance: {balance} credits.\n\n"
                f"Use /logout to disconnect."
            )
        else:
            await update.message.reply_text(
                "Connected with API key, but could not fetch balance.\n"
                "Your key may have expired. Use /logout and /login to reconnect."
            )
    else:
        usage = await db.get_daily_usage(user_id)
        agents = await db.list_agents(user_id)
        await update.message.reply_text(
            f"Free tier account.\n"
            f"Today's usage: {usage['message_count']} messages.\n"
            f"Active agents: {len(agents)}\n\n"
            f"Use /login <api_key> to connect your LibertAI account."
        )
