"""Baal bot entry point — wire handlers, initialize services, run polling."""

import logging

from telegram.ext import Application, CallbackQueryHandler, CommandHandler, MessageHandler, filters

from baal.config import Settings
from baal.database.db import Database
from baal.handlers.account import account_command, login_command, logout_command
from baal.handlers.chat import handle_message
from baal.handlers.commands import (
    build_create_conversation_handler,
    build_soul_conversation_handler,
    dashboard_command,
    delete_agent_callback,
    delete_cancelled_callback,
    delete_command,
    help_command,
    list_command,
    manage_command,
    pool_command,
    repair_command,
    soul_command,
    start_command,
    update_command,
    verbose_command,
)

from baal.services.deployer import AlephDeployer
from baal.services.pool_manager import VMPool
from baal.services.rate_limiter import RateLimiter

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def _send_pending_file(context, agent: dict, auth_token: str, content: str) -> None:
    """Download a file from an agent and send it to the owner via Telegram."""
    import io
    import json as _json

    from baal.services.proxy import download_agent_file

    try:
        meta = _json.loads(content)
    except (ValueError, TypeError):
        return
    file_path = meta.get("path", "")
    caption = meta.get("caption") or None
    if caption:
        caption = f"*{agent['name']}*: {caption}"

    file_result = await download_agent_file(agent["vm_url"], auth_token, file_path)
    if not file_result:
        return
    data, filename, is_photo = file_result
    try:
        if is_photo:
            await context.bot.send_photo(
                chat_id=agent["owner_id"],
                photo=io.BytesIO(data),
                caption=caption,
                parse_mode="Markdown",
            )
        else:
            await context.bot.send_document(
                chat_id=agent["owner_id"],
                document=io.BytesIO(data),
                filename=filename,
                caption=caption,
                parse_mode="Markdown",
            )
    except Exception as e:
        logger.debug(f"Failed to send file to {agent['owner_id']}: {e}")


async def _poll_pending_messages(context) -> None:
    """Background job: poll all running agents for pending messages and forward to owners."""
    db: Database = context.application.bot_data["db"]
    settings: Settings = context.application.bot_data["settings"]
    encryption_key = settings.bot_encryption_key

    try:
        agents = await db.list_running_agents()
    except Exception:
        return

    for agent in agents:
        try:
            from baal.services.encryption import decrypt
            from baal.services.proxy import get_pending_messages

            auth_token = decrypt(agent["auth_token"], encryption_key)
            pending = await get_pending_messages(agent["vm_url"], auth_token)
            for msg in pending:
                content = msg.get("content", "")
                if not content:
                    continue
                source = msg.get("source", "")

                # Handle file messages from subagents/heartbeat
                if source.endswith("_file"):
                    await _send_pending_file(
                        context, agent, auth_token, content
                    )
                    continue

                try:
                    await context.bot.send_message(
                        chat_id=agent["owner_id"],
                        text=f"*{agent['name']}*: {content}",
                        parse_mode="Markdown",
                    )
                except Exception:
                    # Fallback to plain text if Markdown fails
                    try:
                        await context.bot.send_message(
                            chat_id=agent["owner_id"],
                            text=f"{agent['name']}: {content}",
                        )
                    except Exception:
                        pass
        except Exception as e:
            logger.debug(f"Pending poll failed for agent {agent['id']}: {e}")


async def post_init(application: Application) -> None:
    settings: Settings = application.bot_data["settings"]
    db = Database(db_path=settings.db_path)
    await db.initialize()
    application.bot_data["db"] = db
    application.bot_data["rate_limiter"].db = db

    # Initialize VM pool for instant agent deployment
    if settings.pool_enabled:
        deployer = application.bot_data["deployer"]
        pool = VMPool(
            db_path=settings.pool_db_path,
            deployer=deployer,
            min_size=settings.pool_min_size,
            max_size=settings.pool_max_size,
            replenish_interval=settings.pool_replenish_interval,
            max_age_hours=settings.pool_max_age_hours,
        )
        await pool.initialize()
        await pool.start_replenisher()
        application.bot_data["vm_pool"] = pool
        logger.info(
            f"VM pool enabled (min={settings.pool_min_size}, max={settings.pool_max_size})"
        )

    # Poll all agents for pending messages every 30 seconds
    application.job_queue.run_repeating(
        _poll_pending_messages, interval=30, first=10
    )

    logger.info("Database initialized")


async def post_shutdown(application: Application) -> None:
    pool = application.bot_data.get("vm_pool")
    if pool:
        await pool.close()
        logger.info("VM pool closed")

    db = application.bot_data.get("db")
    if db:
        await db.close()
    logger.info("Database closed")


async def handle_callback_query(update, context) -> None:
    """Central router for all inline keyboard callbacks."""
    from telegram import Update
    from telegram.ext import ContextTypes

    query = update.callback_query
    data = query.data

    # Helper to call command functions from callback queries
    # Commands expect update.message, but in callbacks it's update.callback_query.message
    def make_command_update(original_update):
        """Create an update object suitable for command handlers."""
        cmd_update = Update(
            update_id=original_update.update_id,
            message=original_update.callback_query.message,
            callback_query=original_update.callback_query,
        )
        cmd_update._effective_user = original_update.effective_user
        cmd_update._effective_chat = original_update.effective_chat
        return cmd_update

    # Route to appropriate handler based on callback_data prefix
    # Note: quick_create is handled by the ConversationHandler entry point

    if data.startswith("quick_list"):
        await query.answer()
        cmd_update = make_command_update(update)
        await list_command(cmd_update, context)

    elif data.startswith("quick_account"):
        await query.answer()
        cmd_update = make_command_update(update)
        await account_command(cmd_update, context)

    elif data.startswith("quick_help"):
        await query.answer()
        cmd_update = make_command_update(update)
        await help_command(cmd_update, context)

    elif data.startswith("quick_login"):
        await query.answer()
        await query.message.reply_text(
            "To connect your LibertAI API key:\n\n"
            "Use the command:\n"
            "`/login YOUR_API_KEY`\n\n"
            "Get your API key at: https://libertai.io",
            parse_mode="Markdown"
        )

    elif data.startswith("chat_agent:"):
        agent_id = int(data.split(":")[-1])
        context.user_data["current_agent_id"] = agent_id
        await query.answer()

        db = context.bot_data["db"]
        agent = await db.get_agent(agent_id)
        if agent:
            await query.message.reply_text(
                f"You're now chatting with **{agent['name']}**.\n"
                f"Just type a message to talk.\n"
                f"Use /manage to return to the main menu.",
                parse_mode="Markdown",
            )

    elif data.startswith("delete_confirm:"):
        await delete_agent_callback(update, context)

    elif data.startswith("delete_confirmed:"):
        await delete_agent_callback(update, context)

    elif data == "delete_cancelled":
        await delete_cancelled_callback(update, context)

    elif data.startswith("update_agent:"):
        agent_id = int(data.split(":")[-1])
        context.args = [str(agent_id)]
        await query.answer()
        cmd_update = make_command_update(update)
        await update_command(cmd_update, context)

    elif data.startswith("retry_deploy:") or data.startswith("repair_agent:"):
        agent_id = int(data.split(":")[-1])
        context.args = [str(agent_id)]
        await query.answer()
        cmd_update = make_command_update(update)
        await repair_command(cmd_update, context)

    elif data.startswith("refresh_status:"):
        agent_id = int(data.split(":")[-1])
        db = context.bot_data["db"]
        agent = await db.get_agent(agent_id)
        if agent:
            await query.answer(f"Status: {agent['deployment_status']}")

    elif data.startswith("soul_agent:"):
        # Show soul for specific agent
        agent_id = int(data.split(":")[-1])
        context.args = [str(agent_id)]
        await query.answer()
        cmd_update = make_command_update(update)
        await soul_command(cmd_update, context)

    elif data.startswith("nav_"):
        # Handle persistent navigation
        nav_target = data.split("_")[-1]
        await query.answer()
        cmd_update = make_command_update(update)

        if nav_target == "main":
            await start_command(cmd_update, context)
        elif nav_target == "list":
            await list_command(cmd_update, context)
        elif nav_target == "account":
            await account_command(cmd_update, context)

    elif data == "dashboard_refresh":
        await query.answer("Refreshing...")
        cmd_update = make_command_update(update)
        await dashboard_command(cmd_update, context)

    elif data == "account_refresh":
        await query.answer("Refreshing...")
        cmd_update = make_command_update(update)
        await account_command(cmd_update, context)

    elif data == "account_logout":
        await query.answer()
        cmd_update = make_command_update(update)
        await logout_command(cmd_update, context)

    elif data == "account_login":
        await query.answer()
        await query.message.reply_text(
            "To connect your LibertAI API key:\n\n"
            "Use the command:\n"
            "`/login YOUR_API_KEY`\n\n"
            "Get your API key at: https://libertai.io",
            parse_mode="Markdown"
        )

    elif data == "toggle_tools":
        db = context.bot_data["db"]
        user_id = update.effective_user.id

        # Get current setting
        current = await db.get_user_show_tools(user_id)
        # Toggle it
        new_setting = not current
        await db.set_user_show_tools(user_id, new_setting)

        # Show feedback
        status = "visible" if new_setting else "hidden"
        await query.answer(f"Tool calls now {status}")

        # Update the button text
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup
        tool_emoji = "👁️" if new_setting else "🙈"
        tool_text = "Hide Tools" if new_setting else "Show Tools"

        updated_keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("🏠 Main Menu", callback_data="nav_main"),
                InlineKeyboardButton("📋 My Agents", callback_data="nav_list"),
            ],
            [
                InlineKeyboardButton("⚙️ Account", callback_data="nav_account"),
                InlineKeyboardButton(f"{tool_emoji} {tool_text}", callback_data="toggle_tools"),
            ],
        ])

        try:
            await query.edit_message_reply_markup(reply_markup=updated_keyboard)
        except Exception:
            pass  # Message might be too old to edit

    else:
        await query.answer("Unknown action")


def create_application(settings: Settings | None = None) -> Application:
    if settings is None:
        settings = Settings()

    app = (
        Application.builder()
        .token(settings.telegram_bot_token)
        .concurrent_updates(True)
        .post_init(post_init)
        .post_shutdown(post_shutdown)
        .build()
    )

    app.bot_data["settings"] = settings
    app.bot_data["deployer"] = AlephDeployer(
        private_key=settings.aleph_private_key,
        ssh_pubkey=settings.aleph_ssh_pubkey,
        ssh_privkey_path=settings.aleph_ssh_privkey_path,
    )
    app.bot_data["rate_limiter"] = RateLimiter(
        db=None,  # Set in post_init
        daily_messages=settings.free_tier_daily_messages,
    )

    # /create wizard (ConversationHandler — must be added before generic message handler)
    app.add_handler(build_create_conversation_handler())

    # Command handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("list", list_command))
    app.add_handler(CommandHandler("delete", delete_command))
    app.add_handler(CommandHandler("repair", repair_command))
    app.add_handler(CommandHandler("update", update_command))
    app.add_handler(CommandHandler("manage", manage_command))
    app.add_handler(CommandHandler("login", login_command))
    app.add_handler(CommandHandler("logout", logout_command))
    app.add_handler(CommandHandler("account", account_command))
    app.add_handler(CommandHandler("verbose", verbose_command))
    app.add_handler(CommandHandler("dashboard", dashboard_command))
    app.add_handler(CommandHandler("pool", pool_command))
    app.add_handler(CommandHandler("soul", soul_command))

    # /soul edit wizard (ConversationHandler)
    app.add_handler(build_soul_conversation_handler())

    # Callback query handler (inline keyboards)
    app.add_handler(CallbackQueryHandler(handle_callback_query))

    # Generic text message handler (chat routing)
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    return app


def main():
    app = create_application()
    logger.info("Starting Baal bot...")
    app.run_polling()


if __name__ == "__main__":
    main()
