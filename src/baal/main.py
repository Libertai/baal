"""Baal bot entry point — wire handlers, initialize services, run polling."""

import logging

from telegram.ext import Application, CommandHandler, MessageHandler, filters

from baal.config import Settings
from baal.database.db import Database
from baal.handlers.account import account_command, login_command, logout_command
from baal.handlers.chat import handle_message
from baal.handlers.commands import (
    build_create_conversation_handler,
    delete_command,
    help_command,
    list_command,
    manage_command,
    repair_command,
    start_command,
    verbose_command,
)
from baal.services.deployer import AlephDeployer
from baal.services.rate_limiter import RateLimiter

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def post_init(application: Application) -> None:
    settings: Settings = application.bot_data["settings"]
    db = Database(db_path=settings.db_path)
    await db.initialize()
    application.bot_data["db"] = db
    application.bot_data["rate_limiter"].db = db
    logger.info("Database initialized")


async def post_shutdown(application: Application) -> None:
    db = application.bot_data.get("db")
    if db:
        await db.close()
    logger.info("Database closed")


def create_application(settings: Settings | None = None) -> Application:
    if settings is None:
        settings = Settings()

    app = (
        Application.builder()
        .token(settings.telegram_bot_token)
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
    app.add_handler(CommandHandler("manage", manage_command))
    app.add_handler(CommandHandler("login", login_command))
    app.add_handler(CommandHandler("logout", logout_command))
    app.add_handler(CommandHandler("account", account_command))
    app.add_handler(CommandHandler("verbose", verbose_command))

    # Generic text message handler (chat routing)
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    return app


def main():
    app = create_application()
    logger.info("Starting Baal bot...")
    app.run_polling()


if __name__ == "__main__":
    main()
