"""Telegram command handlers: /start, /help, /create, /list, /delete, /manage."""

from __future__ import annotations

import logging
import secrets

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from baal.database.db import Database
from baal.services.deployer import AlephDeployer
from baal.services.encryption import encrypt

logger = logging.getLogger(__name__)

# ConversationHandler states for /create wizard
NAME, PROMPT, MODEL, CONFIRM = range(4)

AVAILABLE_MODELS = {
    "qwen3-coder-next": "Qwen 3 Coder Next",
    "glm-4.7": "GLM 4.7",
}


def _get_db(context: ContextTypes.DEFAULT_TYPE) -> Database:
    return context.bot_data["db"]


def _get_deployer(context: ContextTypes.DEFAULT_TYPE) -> AlephDeployer:
    return context.bot_data["deployer"]


# ── /start ─────────────────────────────────────────────────────────────

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start [agent_id]. Enter chat mode or show welcome."""
    db = _get_db(context)
    await db.ensure_user(update.effective_user.id)

    args = context.args
    if args:
        # Deep link: t.me/baal_bot?start=agent_42  ->  args = ["agent_42"]
        raw = args[0]
        agent_id_str = raw.removeprefix("agent_")
        try:
            agent_id = int(agent_id_str)
        except ValueError:
            await update.message.reply_text("Invalid agent link.")
            return

        agent = await db.get_agent(agent_id)
        if not agent or not agent["is_active"]:
            await update.message.reply_text("This agent doesn't exist or has been removed.")
            return

        if agent["deployment_status"] != "running":
            await update.message.reply_text(
                f"Agent \"{agent['name']}\" is not ready yet (status: {agent['deployment_status']})."
            )
            return

        context.user_data["current_agent_id"] = agent_id
        await update.message.reply_text(
            f"You're now chatting with **{agent['name']}**.\n"
            f"Just type a message to talk.\n"
            f"Use /manage to return to the main menu.",
            parse_mode="Markdown",
        )
        return

    # No args — welcome message
    await update.message.reply_text(
        "Welcome to **Baal** — create and deploy AI agents on Aleph Cloud.\n\n"
        "Commands:\n"
        "/create — Create a new agent\n"
        "/list — List your agents\n"
        "/delete — Delete an agent\n"
        "/account — Check your account\n"
        "/help — Show this help\n\n"
        "To chat with an existing agent, use a deep link like:\n"
        "`t.me/baal_bot?start=agent_1`",
        parse_mode="Markdown",
    )


# ── /help ──────────────────────────────────────────────────────────────

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "**Baal Bot Commands**\n\n"
        "/create — Create a new AI agent\n"
        "/list — List your agents with status\n"
        "/delete <id> — Delete an agent and destroy its VM\n"
        "/manage — Exit chat mode, return to control plane\n"
        "/verbose — Toggle tool call visibility\n"
        "/login <api\\_key> — Connect your LibertAI account\n"
        "/logout — Disconnect your LibertAI account\n"
        "/account — Check account status and balance\n"
        "/help — Show this message",
        parse_mode="Markdown",
    )


# ── /verbose ───────────────────────────────────────────────────────────

async def verbose_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Toggle tool visibility for the user."""
    db = _get_db(context)
    telegram_id = update.effective_user.id
    await db.ensure_user(telegram_id)
    current = await db.get_user_show_tools(telegram_id)
    new_value = not current
    await db.set_user_show_tools(telegram_id, new_value)
    state = "ON" if new_value else "OFF"
    await update.message.reply_text(f"Tool visibility: {state}")


# ── /manage ────────────────────────────────────────────────────────────

async def manage_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Exit chat mode."""
    agent_id = context.user_data.pop("current_agent_id", None)
    if agent_id:
        await update.message.reply_text("Left agent chat. You're back in the control plane.")
    else:
        await update.message.reply_text("You're already in the control plane.")


# ── /list ──────────────────────────────────────────────────────────────

async def list_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db = _get_db(context)
    user_id = update.effective_user.id
    agents = await db.list_agents(user_id)

    if not agents:
        await update.message.reply_text("You have no agents. Use /create to make one.")
        return

    lines = ["**Your Agents:**\n"]
    for a in agents:
        status_emoji = {
            "running": "🟢",
            "deploying": "🟡",
            "pending": "⏳",
            "failed": "🔴",
            "stopped": "⚫",
        }.get(a["deployment_status"], "❓")
        lines.append(
            f"{status_emoji} **{a['name']}** (ID: {a['id']})\n"
            f"   Model: `{a['model']}` | Status: {a['deployment_status']}\n"
            f"   Link: `t.me/baal_bot?start=agent_{a['id']}`"
        )

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


# ── /delete ────────────────────────────────────────────────────────────

async def delete_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db = _get_db(context)
    deployer = _get_deployer(context)
    user_id = update.effective_user.id

    if not context.args:
        await update.message.reply_text("Usage: /delete <agent_id>")
        return

    try:
        agent_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text("Agent ID must be a number.")
        return

    agent = await db.get_agent(agent_id)
    if not agent or agent["owner_id"] != user_id or not agent["is_active"]:
        await update.message.reply_text("Agent not found or you don't own it.")
        return

    await update.message.reply_text(f"Deleting agent \"{agent['name']}\"...")

    # Destroy Aleph Cloud instance if it exists
    if agent["instance_hash"]:
        result = await deployer.destroy_instance(agent["instance_hash"])
        if result["status"] != "success":
            logger.warning(f"Instance deletion issue for {agent['instance_hash']}: {result}")

    await db.delete_agent(agent_id)

    # Clear chat mode if user was chatting with this agent
    if context.user_data.get("current_agent_id") == agent_id:
        context.user_data.pop("current_agent_id", None)

    await update.message.reply_text(f"Agent \"{agent['name']}\" deleted.")


# ── /repair ────────────────────────────────────────────────────────────

async def repair_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Retry deployment for a failed agent."""
    db = _get_db(context)
    deployer = _get_deployer(context)
    user_id = update.effective_user.id

    if not context.args:
        await update.message.reply_text("Usage: /repair <agent_id>")
        return

    try:
        agent_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text("Agent ID must be a number.")
        return

    agent = await db.get_agent(agent_id)
    if not agent or agent["owner_id"] != user_id:
        await update.message.reply_text("Agent not found or you don't own it.")
        return

    if agent["deployment_status"] not in ("failed", "deploying"):
        await update.message.reply_text(f"Agent \"{agent['name']}\" is already deployed (status: {agent['deployment_status']}).")
        return

    if not agent["instance_hash"]:
        await update.message.reply_text("No instance hash found. Please delete and recreate the agent.")
        return

    await update.message.reply_text(f"Repairing agent \"{agent['name']}\"...\nChecking VM allocation...")

    # Get CRN URL from database or try to find it
    crn_url = agent.get("crn_url")
    if not crn_url:
        await update.message.reply_text("No CRN URL found. Cannot repair.")
        return

    # Check allocation
    instance_hash = agent["instance_hash"]
    alloc = await deployer.wait_for_allocation(instance_hash, crn_url, retries=3, delay=5)

    if not alloc:
        await update.message.reply_text("VM not allocated yet. Wait a bit and try /repair again.")
        return

    vm_ip = alloc["vm_ipv4"]
    ssh_port = alloc["ssh_port"]
    await update.message.reply_text(f"VM found at {vm_ip}:{ssh_port}\nRetrying SSH deployment...")

    # Get agent config
    user = await db.get_user(user_id)
    libertai_api_key = user.get("api_key") if user else None
    if not libertai_api_key:
        settings = _get_settings(context)
        libertai_api_key = settings.libertai_api_key

    # Retry deployment
    deploy_result = await deployer.deploy_agent(
        vm_ip=vm_ip,
        ssh_port=ssh_port,
        agent_name=agent["name"],
        system_prompt=agent["system_prompt"],
        model=agent["model"],
        libertai_api_key=libertai_api_key,
        agent_secret=agent["auth_token"],
        instance_hash=instance_hash,
        owner_chat_id=str(user_id),
    )

    if deploy_result["status"] != "success":
        await db.update_agent_deployment(agent_id, deployment_status="failed")
        await update.message.reply_text(f"Repair failed: {deploy_result.get('error', 'unknown')}")
        return

    vm_url = deploy_result["vm_url"]
    await db.update_agent_deployment(
        agent_id,
        deployment_status="deployed",
        vm_ipv6=vm_ip,
        vm_url=vm_url,
    )

    deep_link = f"https://t.me/{context.bot.username}?start=agent_{agent_id}"
    await update.message.reply_text(
        f"✅ Agent \"{agent['name']}\" repaired!\n\n"
        f"🌐 URL: {vm_url}\n"
        f"💬 Chat: {deep_link}"
    )


# ── /create wizard ─────────────────────────────────────────────────────

async def create_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Entry point for /create wizard."""
    db = _get_db(context)
    settings = context.bot_data["settings"]
    user_id = update.effective_user.id
    await db.ensure_user(user_id)

    count = await db.count_agents(user_id)
    if count >= settings.max_agents_per_user:
        await update.message.reply_text(
            f"You've reached the limit of {settings.max_agents_per_user} agents."
        )
        return ConversationHandler.END

    await update.message.reply_text(
        "Let's create a new agent!\n\n"
        "**Step 1/3:** What should your agent be named?"
        ,
        parse_mode="Markdown",
    )
    return NAME


async def create_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Receive agent name."""
    name = update.message.text.strip()
    if not name or len(name) > 64:
        await update.message.reply_text("Name must be 1-64 characters. Try again.")
        return NAME

    context.user_data["create_name"] = name
    await update.message.reply_text(
        f"Agent name: **{name}**\n\n"
        "**Step 2/3:** What system prompt should your agent use?\n"
        "This tells the AI how to behave.",
        parse_mode="Markdown",
    )
    return PROMPT


async def create_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Receive system prompt."""
    prompt = update.message.text.strip()
    if not prompt:
        await update.message.reply_text("System prompt cannot be empty. Try again.")
        return PROMPT

    context.user_data["create_prompt"] = prompt

    keyboard = [
        [InlineKeyboardButton(display, callback_data=f"create_model:{model_id}")]
        for model_id, display in AVAILABLE_MODELS.items()
    ]
    await update.message.reply_text(
        "**Step 3/3:** Choose a model:",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode="Markdown",
    )
    return MODEL


async def create_model_callback(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    """Receive model selection via inline keyboard."""
    query = update.callback_query
    await query.answer()

    model_id = query.data.removeprefix("create_model:")
    if model_id not in AVAILABLE_MODELS:
        await query.edit_message_text("Invalid model. Try /create again.")
        return ConversationHandler.END

    context.user_data["create_model"] = model_id

    name = context.user_data["create_name"]
    prompt = context.user_data["create_prompt"]
    model_name = AVAILABLE_MODELS[model_id]

    await query.edit_message_text(
        f"**Ready to create:**\n\n"
        f"Name: {name}\n"
        f"Model: {model_name}\n"
        f"System prompt: {prompt[:200]}{'...' if len(prompt) > 200 else ''}\n\n"
        "Send /confirm to deploy, or /cancel to abort.",
        parse_mode="Markdown",
    )
    return CONFIRM


async def create_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Confirm and kick off deployment."""
    db = _get_db(context)
    deployer = _get_deployer(context)
    settings = context.bot_data["settings"]
    encryption_key = settings.bot_encryption_key
    user_id = update.effective_user.id

    name = context.user_data.pop("create_name")
    system_prompt = context.user_data.pop("create_prompt")
    model = context.user_data.pop("create_model")

    # Determine which LibertAI API key to use
    user = await db.get_user(user_id)
    if user and user["api_key"]:
        from baal.services.encryption import decrypt
        libertai_key = decrypt(user["api_key"], encryption_key)
    else:
        libertai_key = settings.libertai_api_key

    # Generate auth token for bot<->agent communication
    agent_secret = secrets.token_urlsafe(32)
    encrypted_secret = encrypt(agent_secret, encryption_key)

    # Create agent record
    agent = await db.create_agent(
        owner_id=user_id,
        name=name,
        system_prompt=system_prompt,
        model=model,
    )
    await db.update_agent_deployment(agent["id"], auth_token=encrypted_secret)

    await update.message.reply_text(
        f"Agent \"{name}\" created (ID: {agent['id']}).\n"
        f"Starting deployment to Aleph Cloud... This may take a few minutes."
    )

    # Run deployment as a background task
    context.application.create_task(
        _deploy_agent_background(
            context.application,
            update.effective_chat.id,
            agent["id"],
            name,
            system_prompt,
            model,
            libertai_key,
            agent_secret,
        )
    )

    return ConversationHandler.END


async def create_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Cancel agent creation."""
    context.user_data.pop("create_name", None)
    context.user_data.pop("create_prompt", None)
    context.user_data.pop("create_model", None)
    await update.message.reply_text("Agent creation cancelled.")
    return ConversationHandler.END


# ── Background deployment task ─────────────────────────────────────────

async def _deploy_agent_background(
    application,
    chat_id: int,
    agent_id: int,
    name: str,
    system_prompt: str,
    model: str,
    libertai_api_key: str,
    agent_secret: str,
) -> None:
    """Run the full deployment flow in the background, sending status updates."""
    db: Database = application.bot_data["db"]
    deployer: AlephDeployer = application.bot_data["deployer"]
    bot = application.bot

    async def status(text: str) -> None:
        await bot.send_message(chat_id=chat_id, text=text)

    try:
        # Step 1: Create Aleph Cloud instance
        await db.update_agent_deployment(agent_id, deployment_status="deploying")
        await status("Creating Aleph Cloud VM instance...")

        result = await deployer.create_instance(name)
        if result["status"] != "success":
            await db.update_agent_deployment(agent_id, deployment_status="failed")
            await status(f"Instance creation failed: {result.get('error', 'unknown')}")
            return

        instance_hash = result["instance_hash"]
        crn_url = result["crn_url"]
        await db.update_agent_deployment(
            agent_id,
            instance_hash=instance_hash,
            crn_url=crn_url,
        )
        await status(f"Instance created: `{instance_hash[:16]}...`\nWaiting for VM to start...")

        # Step 2: Wait for allocation
        alloc = await deployer.wait_for_allocation(instance_hash, crn_url)
        if not alloc:
            await db.update_agent_deployment(agent_id, deployment_status="failed")
            await status("VM allocation timed out. The instance may still start later.")
            return

        vm_ip = alloc["vm_ipv4"]
        ssh_port = alloc["ssh_port"]
        await status(f"VM allocated. Deploying agent code via SSH...")

        # Step 3: SSH deploy
        deploy_result = await deployer.deploy_agent(
            vm_ip=vm_ip,
            ssh_port=ssh_port,
            agent_name=name,
            system_prompt=system_prompt,
            model=model,
            libertai_api_key=libertai_api_key,
            agent_secret=agent_secret,
            instance_hash=instance_hash,
            owner_chat_id=str(chat_id),
        )

        if deploy_result["status"] != "success":
            await db.update_agent_deployment(agent_id, deployment_status="failed")
            await status(f"Deployment failed: {deploy_result.get('error', 'unknown')}")
            return

        vm_url = deploy_result["vm_url"]
        await db.update_agent_deployment(
            agent_id,
            vm_url=vm_url,
            vm_ipv6=vm_ip,
            deployment_status="running",
        )

        await status(
            f"Agent \"{name}\" is live!\n\n"
            f"Share this link to let anyone chat with your agent:\n"
            f"`t.me/baal_bot?start=agent_{agent_id}`"
        )

    except Exception as e:
        logger.error(f"Background deployment error for agent {agent_id}: {e}", exc_info=True)
        await db.update_agent_deployment(agent_id, deployment_status="failed")
        await status(f"Deployment failed with an unexpected error: {e}")


# ── Build ConversationHandler ──────────────────────────────────────────

def build_create_conversation_handler() -> ConversationHandler:
    """Build the ConversationHandler for the /create wizard."""
    return ConversationHandler(
        entry_points=[CommandHandler("create", create_start)],
        states={
            NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, create_name)],
            PROMPT: [MessageHandler(filters.TEXT & ~filters.COMMAND, create_prompt)],
            MODEL: [CallbackQueryHandler(create_model_callback, pattern=r"^create_model:")],
            CONFIRM: [
                CommandHandler("confirm", create_confirm),
                CommandHandler("cancel", create_cancel),
            ],
        },
        fallbacks=[CommandHandler("cancel", create_cancel)],
        per_message=False,
    )
