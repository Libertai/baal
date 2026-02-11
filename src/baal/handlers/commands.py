"""Telegram command handlers: /start, /help, /create, /list, /delete, /manage."""

from __future__ import annotations

import html as html_mod
import logging
import secrets

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
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
from baal.services.encryption import decrypt, encrypt

logger = logging.getLogger(__name__)

# ConversationHandler states for /create wizard
NAME, PROMPT, MODEL, CONFIRM = range(4)

AVAILABLE_MODELS = {
    "qwen3-coder-next": {
        "name": "Qwen 3 Coder Next",
        "emoji": "✨",
        "description": "Latest coding model",
        "best_for": "Code generation, debugging, technical tasks",
        "context": "96K tokens",
        "speed": "Fast",
        "badges": ["Recommended"],
    },
    "glm-4.7": {
        "name": "GLM 4.7",
        "emoji": "💬",
        "description": "General-purpose chat",
        "best_for": "Conversations, research, creative writing",
        "context": "128K tokens",
        "speed": "Moderate",
        "badges": ["Great for long documents"],
    },
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

        if agent["deployment_status"] not in ("deployed", "running"):
            await update.message.reply_text(
                f"Agent \"{agent['name']}\" is not ready yet (status: {agent['deployment_status']})."
            )
            return

        context.user_data["current_agent_id"] = agent_id
        safe_name = html_mod.escape(agent["name"])
        await update.message.reply_text(
            f"You're now chatting with <b>{safe_name}</b>.\n"
            f"Just type a message to talk.\n"
            f"Use /manage to return to the main menu.",
            parse_mode=ParseMode.HTML,
        )
        return

    # No args — enhanced welcome message with inline keyboard
    from .ui_utils import get_quick_actions_keyboard

    await update.message.reply_text(
        "🤖 *Welcome to Baal*\n\n"
        "Deploy AI agents on Aleph Cloud with LibertAI inference.\n\n"
        "Choose an action below:",
        parse_mode="Markdown",
        reply_markup=get_quick_actions_keyboard(),
    )


# ── /help ──────────────────────────────────────────────────────────────

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show comprehensive help with examples and links."""
    keyboard = [
        [
            InlineKeyboardButton("📚 Documentation", url="https://github.com/Libertai/baal"),
            InlineKeyboardButton("💬 Support", url="https://t.me/libertai"),
        ],
        [
            InlineKeyboardButton("🐛 Report Issue", url="https://github.com/Libertai/baal/issues"),
        ],
    ]

    message = (
        f"ℹ️ *Baal Help*\n\n"
        f"*Quick Start*\n"
        f"1. Create an agent with /create\n"
        f"2. Wait 3-5 minutes for deployment\n"
        f"3. Click the deep link to chat\n\n"
        f"*Main Commands*\n"
        f"/create - Create a new agent\n"
        f"/list - View your agents\n"
        f"/account - Check usage & balance\n"
        f"/manage - Exit chat mode\n\n"
        f"*Account*\n"
        f"/login `<key>` - Connect LibertAI API key\n"
        f"/logout - Disconnect account\n"
        f"/verbose - Toggle tool visibility\n\n"
        f"*Advanced*\n"
        f"/repair `<id>` - Retry failed deployment\n"
        f"/delete `<id>` - Delete agent"
    )

    await update.message.reply_text(
        message,
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(keyboard),
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


# ── /pool ──────────────────────────────────────────────────────────────

async def pool_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show VM pool status."""
    pool = context.bot_data.get("vm_pool")
    if not pool:
        await update.message.reply_text("VM pool is not enabled.")
        return

    stats = await pool.get_stats()

    text = (
        "<b>VM Pool Status</b>\n\n"
        f"Available: {stats.get('warm', 0)}\n"
        f"Provisioning: {stats.get('provisioning', 0)}\n"
        f"Claimed: {stats.get('claimed', 0)}\n"
        f"Deployed: {stats.get('deployed', 0)}\n"
        f"Failed: {stats.get('failed', 0)}\n"
        f"─────────────\n"
        f"Total: {stats.get('total', 0)}"
    )

    await update.message.reply_text(text, parse_mode=ParseMode.HTML)


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
    """Display interactive agent list with action buttons."""
    from .ui_utils import STATUS_EMOJIS, format_age

    db = _get_db(context)
    settings = context.bot_data["settings"]
    user_id = update.effective_user.id
    agents = await db.list_agents(user_id)

    count = len(agents)
    max_agents = getattr(settings, "max_agents_per_user", 3)

    if not agents:
        keyboard = [[InlineKeyboardButton("➕ Create Your First Agent", callback_data="quick_create")]]
        await update.message.reply_text(
            "📋 *Your Agents*\n\n"
            "You have no agents yet.\n"
            "Create one to get started!",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard),
        )
        return

    # Send header
    header = f"<b>Your Agents</b> ({count}/{max_agents} slots used)"
    await update.message.reply_text(header, parse_mode=ParseMode.HTML)

    # Send card for each agent
    for a in agents:
        status_emoji = STATUS_EMOJIS.get(a["deployment_status"], "❓")
        status_text = a["deployment_status"].title()
        age_str = format_age(a["created_at"])
        safe_name = html_mod.escape(a["name"])

        card_text = (
            f"{status_emoji} <b>{safe_name}</b>\n"
            f"<code>{html_mod.escape(a['model'])}</code> - {status_text} - {age_str}"
        )

        # Build action buttons based on status
        buttons = []
        if a["deployment_status"] == "running":
            buttons.append([
                InlineKeyboardButton("💬 Chat", callback_data=f"chat_agent:{a['id']}"),
                InlineKeyboardButton("🔄 Update", callback_data=f"update_agent:{a['id']}"),
                InlineKeyboardButton("🗑️ Delete", callback_data=f"delete_confirm:{a['id']}"),
            ])
        elif a["deployment_status"] == "deploying":
            buttons.append([
                InlineKeyboardButton("🔄 Refresh", callback_data=f"refresh_status:{a['id']}"),
                InlineKeyboardButton("🗑️ Delete", callback_data=f"delete_confirm:{a['id']}"),
            ])
        elif a["deployment_status"] == "failed":
            buttons.append([
                InlineKeyboardButton("🔄 Repair", callback_data=f"repair_agent:{a['id']}"),
                InlineKeyboardButton("🗑️ Delete", callback_data=f"delete_confirm:{a['id']}"),
            ])
        else:
            buttons.append([
                InlineKeyboardButton("🗑️ Delete", callback_data=f"delete_confirm:{a['id']}"),
            ])

        await update.message.reply_text(
            card_text,
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup(buttons),
        )

    # Add "Create New" button if slots available
    if count < max_agents:
        remaining = max_agents - count
        keyboard = [[InlineKeyboardButton(
            f"➕ Create New Agent ({remaining} slot{'s' if remaining != 1 else ''} remaining)",
            callback_data="quick_create"
        )]]
        await update.message.reply_text(
            "Want to create another agent?",
            reply_markup=InlineKeyboardMarkup(keyboard),
        )


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
        # Clean up pool entry if this VM came from the pool
        pool = context.bot_data.get("vm_pool")
        if pool:
            await pool.remove_by_instance(agent["instance_hash"])

    await db.delete_agent(agent_id)

    # Clear chat mode if user was chatting with this agent
    if context.user_data.get("current_agent_id") == agent_id:
        context.user_data.pop("current_agent_id", None)

    await update.message.reply_text(f"Agent \"{agent['name']}\" deleted.")


async def delete_agent_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle inline delete button with two-step confirmation."""
    query = update.callback_query
    await query.answer()

    agent_id = int(query.data.split(":")[-1])

    db = _get_db(context)
    user_id = update.effective_user.id

    agent = await db.get_agent(agent_id)
    if not agent or agent["owner_id"] != user_id:
        await query.edit_message_text("❌ Agent not found or you don't own it.")
        return

    # Check if this is confirmation or initial request
    if query.data.startswith("delete_confirmed:"):
        # Actually delete
        deployer = _get_deployer(context)

        if agent["instance_hash"]:
            try:
                result = await deployer.destroy_instance(agent["instance_hash"])
                if result["status"] != "success":
                    logger.warning(f"Instance deletion issue: {result}")
            except Exception as e:
                logger.warning(f"Error destroying instance: {e}")
            # Clean up pool entry if this VM came from the pool
            pool = context.bot_data.get("vm_pool")
            if pool:
                await pool.remove_by_instance(agent["instance_hash"])

        await db.delete_agent(agent_id)

        if context.user_data.get("current_agent_id") == agent_id:
            context.user_data.pop("current_agent_id", None)

        await query.edit_message_text(
            f"✅ Agent \"{agent['name']}\" has been deleted.\n\n"
            f"VM destroyed and slot freed."
        )
    else:
        # Show confirmation dialog
        keyboard = [
            [
                InlineKeyboardButton("⚠️ Yes, Delete", callback_data=f"delete_confirmed:{agent_id}"),
                InlineKeyboardButton("❌ Cancel", callback_data="delete_cancelled"),
            ],
        ]

        safe_name = html_mod.escape(agent["name"])
        safe_model = html_mod.escape(agent["model"])
        safe_status = html_mod.escape(agent["deployment_status"])

        await query.edit_message_text(
            f"<b>Delete Agent?</b>\n\n"
            f"Agent: {safe_name}\n"
            f"Model: <code>{safe_model}</code>\n"
            f"Status: {safe_status}\n\n"
            f"This will:\n"
            f"  - Stop the agent permanently\n"
            f"  - Destroy the VM instance\n"
            f"  - Delete all conversation history\n"
            f"  - Free up 1 agent slot\n\n"
            f"<b>This action cannot be undone.</b>",
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup(keyboard),
        )


async def delete_cancelled_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle delete cancellation."""
    query = update.callback_query
    await query.answer("Deletion cancelled")
    await query.edit_message_text("Deletion cancelled.")


# ── /update ────────────────────────────────────────────────────────────

async def update_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Redeploy agent code to a running VM (push latest code without recreating the instance)."""
    db = _get_db(context)
    deployer = _get_deployer(context)
    user_id = update.effective_user.id

    if not context.args:
        # Show agent picker for running agents
        agents = await db.list_agents(user_id)
        running = [a for a in agents if a["deployment_status"] == "running"]
        if not running:
            await update.message.reply_text("No running agents to update.")
            return
        keyboard = [
            [InlineKeyboardButton(f"{a['name']} (#{a['id']})", callback_data=f"update_agent:{a['id']}")]
            for a in running
        ]
        await update.message.reply_text(
            "Select an agent to update:",
            reply_markup=InlineKeyboardMarkup(keyboard),
        )
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

    if agent["deployment_status"] != "running":
        await update.message.reply_text(
            f"Agent is not running (status: {agent['deployment_status']}). Use /repair instead."
        )
        return

    if not agent["instance_hash"] or not agent["crn_url"]:
        await update.message.reply_text("Missing instance info. Use /repair instead.")
        return

    await update.message.reply_text(f"Updating agent \"{agent['name']}\"...\nLooking up VM allocation...")

    # Find the VM's SSH details from the CRN
    alloc = await deployer.wait_for_allocation(agent["instance_hash"], agent["crn_url"], retries=3, delay=5)
    if not alloc:
        await update.message.reply_text("Could not reach the VM. It may have been deallocated. Try /repair.")
        return

    vm_ip = alloc["vm_ipv4"]
    ssh_port = alloc["ssh_port"]
    await update.message.reply_text(f"VM found at {vm_ip}:{ssh_port}\nDeploying latest code...")

    # Get agent config for .env
    settings = context.bot_data["settings"]
    encryption_key = settings.bot_encryption_key
    user = await db.get_user(user_id)
    if user and user["api_key"]:
        libertai_key = decrypt(user["api_key"], encryption_key)
    else:
        libertai_key = settings.libertai_api_key

    agent_secret = decrypt(agent["auth_token"], encryption_key)

    deploy_result = await deployer.deploy_agent(
        vm_ip=vm_ip,
        ssh_port=ssh_port,
        agent_name=agent["name"],
        system_prompt=agent["system_prompt"],
        model=agent["model"],
        libertai_api_key=libertai_key,
        agent_secret=agent_secret,
        instance_hash=agent["instance_hash"],
        owner_chat_id=str(user_id),
    )

    if deploy_result["status"] != "success":
        await update.message.reply_text(f"Update failed: {deploy_result.get('error', 'unknown')}")
        return

    await update.message.reply_text(f"Agent \"{agent['name']}\" updated successfully.")


# ── /repair ────────────────────────────────────────────────────────────

async def repair_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Retry deployment for a failed agent."""
    db = _get_db(context)
    deployer = _get_deployer(context)
    user_id = update.effective_user.id

    if not context.args:
        # Show agent picker for failed/deploying agents
        agents = await db.list_agents(user_id)
        repairable = [a for a in agents if a["deployment_status"] in ("failed", "deploying")]
        if not repairable:
            await update.message.reply_text("No agents need repair.")
            return
        keyboard = [
            [InlineKeyboardButton(f"{a['name']} (#{a['id']})", callback_data=f"repair_agent:{a['id']}")]
            for a in repairable
        ]
        await update.message.reply_text(
            "Select an agent to repair:",
            reply_markup=InlineKeyboardMarkup(keyboard),
        )
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

    instance_hash = agent["instance_hash"]
    crn_url = agent.get("crn_url")

    # If no CRN URL stored (e.g., instance created but all CRN starts failed),
    # try to start the instance on a fresh CRN
    if not crn_url:
        await update.message.reply_text("No CRN assigned. Trying to find one...")
        crns = await deployer.get_available_crns()
        if not crns:
            await update.message.reply_text("No CRNs available. Try again later.")
            return

        # Try up to 3 CRNs
        started = False
        for candidate in crns[:3]:
            candidate_url = candidate["url"]
            if not candidate_url.startswith("http"):
                candidate_url = f"https://{candidate_url}"
            candidate_url = candidate_url.rstrip("/")

            try:
                from aleph.sdk.client.vm_client import VmClient
                import asyncio

                async with VmClient(deployer._account, candidate_url) as vm_client:
                    status_code, _ = await asyncio.wait_for(
                        vm_client.start_instance(instance_hash),
                        timeout=30.0,
                    )
                    if status_code == 200:
                        crn_url = candidate_url
                        await db.update_agent_deployment(agent_id, crn_url=crn_url)
                        await update.message.reply_text(f"Instance started on CRN {candidate['name']}")
                        started = True
                        break
            except Exception as e:
                logger.warning(f"CRN {candidate['name']} failed during repair: {e}")
                continue

        if not started:
            await update.message.reply_text(
                "Could not start instance on any CRN.\n"
                "Try /repair again later, or /delete and recreate the agent."
            )
            return

    # Check allocation
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
        libertai_api_key = context.bot_data["settings"].libertai_api_key

    # Decrypt agent secret (stored encrypted in DB)
    encryption_key = context.bot_data["settings"].bot_encryption_key
    agent_secret = decrypt(agent["auth_token"], encryption_key)

    # Retry deployment
    deploy_result = await deployer.deploy_agent(
        vm_ip=vm_ip,
        ssh_port=ssh_port,
        agent_name=agent["name"],
        system_prompt=agent["system_prompt"],
        model=agent["model"],
        libertai_api_key=libertai_api_key,
        agent_secret=agent_secret,
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
        deployment_status="running",
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
    # Exit chat mode if currently chatting with an agent
    context.user_data.pop("current_agent_id", None)

    # Handle both command and callback query
    if update.callback_query:
        await update.callback_query.answer()
        message = update.callback_query.message
    else:
        message = update.message

    db = _get_db(context)
    settings = context.bot_data["settings"]
    user_id = update.effective_user.id
    await db.ensure_user(user_id)

    count = await db.count_agents(user_id)
    if count >= settings.max_agents_per_user:
        await message.reply_text(
            f"You've reached the limit of {settings.max_agents_per_user} agents."
        )
        return ConversationHandler.END

    await message.reply_text(
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
    safe_name = html_mod.escape(name)
    await update.message.reply_text(
        f"Agent name: <b>{safe_name}</b>\n\n"
        "<b>Step 2/3:</b> What system prompt should your agent use?\n"
        "This tells the AI how to behave.",
        parse_mode=ParseMode.HTML,
    )
    return PROMPT


async def create_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Receive system prompt and show enhanced model selection."""
    from .ui_utils import format_section

    prompt = update.message.text.strip()
    if not prompt:
        await update.message.reply_text("System prompt cannot be empty. Try again.")
        return PROMPT

    context.user_data["create_prompt"] = prompt

    # Build detailed model selection
    lines = ["🤖 *Step 3/3: Choose a Model*\n"]
    keyboard = []

    for model_id, info in AVAILABLE_MODELS.items():
        keyboard.append([
            InlineKeyboardButton(
                f"{info['emoji']} {info['name']}",
                callback_data=f"create_model:{model_id}"
            )
        ])

        lines.append(
            f"\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"*{info['emoji']} {info['name']}*\n"
            f"{info['description']}\n\n"
            f"• Best for: {info['best_for']}\n"
            f"• Context: {info['context']}\n"
            f"• Speed: {info['speed']}\n"
        )

        if info.get("badges"):
            lines.append(f"• {' • '.join(info['badges'])}\n")

    await update.message.reply_text(
        "\n".join(lines),
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode="Markdown",
    )
    return MODEL


async def create_model_callback(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    """Handle model selection with enhanced confirmation preview."""
    query = update.callback_query
    await query.answer()

    model_id = query.data.removeprefix("create_model:")
    if model_id not in AVAILABLE_MODELS:
        await query.edit_message_text("Invalid model. Try /create again.")
        return ConversationHandler.END

    context.user_data["create_model"] = model_id

    name = context.user_data["create_name"]
    prompt = context.user_data["create_prompt"]
    model_info = AVAILABLE_MODELS.get(model_id, {})
    model_name = model_info.get("name", model_id)

    # Show full configuration preview
    keyboard = [
        [
            InlineKeyboardButton("✅ Confirm & Deploy", callback_data="create_confirm"),
            InlineKeyboardButton("❌ Cancel", callback_data="create_cancel"),
        ],
    ]

    # Truncate prompt for display (show more than before)
    prompt_display = prompt if len(prompt) <= 800 else prompt[:797] + "..."

    safe_name = html_mod.escape(name)
    safe_model = html_mod.escape(model_name)
    safe_prompt = html_mod.escape(prompt_display)

    await query.edit_message_text(
        f"<b>Review Your Agent</b>\n\n"
        f"<b>Name:</b> {safe_name}\n"
        f"<b>Model:</b> {safe_model}\n\n"
        f"<b>System Prompt:</b>\n<code>{safe_prompt}</code>\n\n"
        f"<b>Deployment Details:</b>\n"
        f"  - Platform: Aleph Cloud\n"
        f"  - Payment: PAYG (credit-based)\n"
        f"  - Setup time: ~3-5 minutes\n"
        f"  - HTTPS: Auto-configured\n\n"
        f"Ready to deploy?",
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(keyboard),
    )
    return CONFIRM


async def create_confirm_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle inline confirmation button."""
    query = update.callback_query
    await query.answer()

    # Reuse the existing create_confirm logic but with callback query
    # We need to set update.message to query.message for compatibility
    original_message = update.message
    update._unfreeze()
    update.message = query.message
    update._freeze()

    result = await create_confirm(update, context)

    # Restore original message
    update._unfreeze()
    update.message = original_message
    update._freeze()

    return result


async def create_cancel_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle inline cancel button."""
    query = update.callback_query
    await query.answer("Creation cancelled")

    context.user_data.pop("create_name", None)
    context.user_data.pop("create_prompt", None)
    context.user_data.pop("create_model", None)

    await query.edit_message_text("Agent creation cancelled.")
    return ConversationHandler.END


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

    # Try fast path: claim a pre-provisioned VM from the pool
    pool = context.bot_data.get("vm_pool")
    pooled_vm = await pool.claim() if pool else None

    if pooled_vm:
        # Fast path: Deploy to pre-provisioned VM (~10-15 seconds)
        await update.message.reply_text(
            f"Agent \"{name}\" created (ID: {agent['id']}).\n"
            f"Deploying to pre-provisioned VM... This takes ~15 seconds."
        )

        context.application.create_task(
            _deploy_agent_fast(
                context.application,
                update.effective_chat.id,
                agent["id"],
                name,
                system_prompt,
                model,
                libertai_key,
                agent_secret,
                pooled_vm,
            )
        )
    else:
        # Slow path: Full provisioning (~2-3 minutes)
        await update.message.reply_text(
            f"Agent \"{name}\" created (ID: {agent['id']}).\n"
            f"Starting deployment to Aleph Cloud... This may take a few minutes."
        )

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


async def create_exit_silently(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Exit wizard silently when user switches to another action."""
    # Clean up user data
    context.user_data.pop("create_name", None)
    context.user_data.pop("create_prompt", None)
    context.user_data.pop("create_model", None)
    # Exit without message since they're doing something else
    return ConversationHandler.END


# ── Fast deployment (pre-provisioned VM) ───────────────────────────────

async def _deploy_agent_fast(
    application,
    chat_id: int,
    agent_id: int,
    name: str,
    system_prompt: str,
    model: str,
    libertai_api_key: str,
    agent_secret: str,
    pooled_vm,
) -> None:
    """Deploy agent to a pre-provisioned VM from the pool (~10-15 seconds)."""
    import time as _time

    from .error_handlers import send_deployment_error

    db: Database = application.bot_data["db"]
    deployer: AlephDeployer = application.bot_data["deployer"]
    pool = application.bot_data.get("vm_pool")
    bot = application.bot

    deploy_start = _time.monotonic()
    deployed = False  # Track whether VM was successfully deployed

    try:
        await db.update_agent_deployment(
            agent_id,
            deployment_status="deploying",
            instance_hash=pooled_vm.instance_hash,
            crn_url=pooled_vm.crn_url,
        )

        # Deploy agent code via SSH (VM already running!)
        deploy_result = await deployer.deploy_agent(
            vm_ip=pooled_vm.vm_ip,
            ssh_port=pooled_vm.ssh_port,
            agent_name=name,
            system_prompt=system_prompt,
            model=model,
            libertai_api_key=libertai_api_key,
            agent_secret=agent_secret,
            instance_hash=pooled_vm.instance_hash,
            owner_chat_id=str(chat_id),
        )

        if deploy_result["status"] != "success":
            # Release VM back to pool for reuse
            if pool:
                await pool.release(pooled_vm.id)
            await db.update_agent_deployment(agent_id, deployment_status="failed")
            await send_deployment_error(
                bot, chat_id, agent_id, "ssh_deployment",
                deploy_result.get("error", "SSH deployment failed")
            )
            duration = int(_time.monotonic() - deploy_start)
            await db.log_deployment_event(
                agent_id, "failed", "ssh_deployment",
                deploy_result.get("error"), duration,
            )
            return

        vm_url = deploy_result["vm_url"]

        # Mark pool VM as deployed
        deployed = True
        if pool:
            await pool.mark_deployed(pooled_vm.id, agent_id)

        # Update database
        await db.update_agent_deployment(
            agent_id,
            vm_url=vm_url,
            vm_ipv6=pooled_vm.vm_ip,
            deployment_status="running",
        )

        # Log successful deployment
        duration = int(_time.monotonic() - deploy_start)
        await db.log_deployment_event(agent_id, "success", duration_seconds=duration)
        logger.info(f"Fast deployment of agent {agent_id} completed in {duration}s")

        # Send deep link message
        bot_username = (await bot.get_me()).username
        deep_link = f"https://t.me/{bot_username}?start=agent_{agent_id}"
        await bot.send_message(
            chat_id=chat_id,
            text=(
                f"<b>Your agent is ready!</b>\n\n"
                f"Deployed in {duration} seconds.\n"
                f"Click here to start chatting:\n{deep_link}"
            ),
            parse_mode=ParseMode.HTML,
        )

    except Exception as e:
        logger.error(f"Fast deployment error for agent {agent_id}: {e}", exc_info=True)
        # Only release VM back to pool if it wasn't already deployed
        if pool and not deployed:
            await pool.release(pooled_vm.id)
        if not deployed:
            await db.update_agent_deployment(agent_id, deployment_status="failed")
        await send_deployment_error(
            bot, chat_id, agent_id, "unexpected_error", str(e)
        )
        duration = int(_time.monotonic() - deploy_start)
        await db.log_deployment_event(
            agent_id, "failed", "unexpected_error", str(e), duration,
        )


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
    """Run the full deployment flow in the background with live progress updates."""
    import time as _time

    from .deployment_progress import DeploymentProgress
    from .error_handlers import send_deployment_error

    db: Database = application.bot_data["db"]
    deployer: AlephDeployer = application.bot_data["deployer"]
    bot = application.bot

    deploy_start = _time.monotonic()

    # Initialize progress tracker
    progress = DeploymentProgress(bot, chat_id, name)
    await progress.init()

    try:
        # Step 1: Create Aleph Cloud instance
        await db.update_agent_deployment(agent_id, deployment_status="deploying")
        await progress.update("instance", "in_progress")

        result = await deployer.create_instance(name)
        if result["status"] != "success":
            # Even on failure, save the instance_hash if one was created
            # (allows /repair to retry CRN start later)
            partial_hash = result.get("instance_hash")
            if partial_hash:
                await db.update_agent_deployment(
                    agent_id,
                    instance_hash=partial_hash,
                    deployment_status="failed",
                )
                logger.info(
                    f"Instance {partial_hash} created but CRN start failed; "
                    f"saved for /repair"
                )
            else:
                await db.update_agent_deployment(agent_id, deployment_status="failed")

            await progress.update("instance", "failed")
            await send_deployment_error(
                bot, chat_id, agent_id, "instance_creation",
                result.get("error", "Unknown error")
            )
            duration = int(_time.monotonic() - deploy_start)
            await db.log_deployment_event(
                agent_id, "failed", "instance_creation",
                result.get("error"), duration,
            )
            return

        instance_hash = result["instance_hash"]
        crn_url = result["crn_url"]
        await db.update_agent_deployment(
            agent_id,
            instance_hash=instance_hash,
            crn_url=crn_url,
        )

        # Step 2: Verify message on network
        await progress.update("verify", "in_progress")
        # Note: Verification happens inside create_instance, just marking as done
        await progress.update("verify", "success")

        # Step 3: Wait for allocation
        await progress.update("allocation", "in_progress")
        alloc = await deployer.wait_for_allocation(instance_hash, crn_url)
        if not alloc:
            await progress.update("allocation", "failed")
            await db.update_agent_deployment(agent_id, deployment_status="failed")
            await send_deployment_error(
                bot, chat_id, agent_id, "allocation_timeout",
                f"VM allocation timed out for {instance_hash}"
            )
            duration = int(_time.monotonic() - deploy_start)
            await db.log_deployment_event(
                agent_id, "failed", "allocation_timeout",
                f"VM not allocated after polling", duration,
            )
            return

        vm_ip = alloc["vm_ipv4"]
        ssh_port = alloc["ssh_port"]

        # Step 4: Deploy via SSH
        await progress.update("ssh", "in_progress")
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
            await progress.update("ssh", "failed")
            await db.update_agent_deployment(agent_id, deployment_status="failed")
            await send_deployment_error(
                bot, chat_id, agent_id, "ssh_deployment",
                deploy_result.get("error", "SSH deployment failed")
            )
            duration = int(_time.monotonic() - deploy_start)
            await db.log_deployment_event(
                agent_id, "failed", "ssh_deployment",
                deploy_result.get("error"), duration,
            )
            return

        vm_url = deploy_result["vm_url"]

        # Step 5: Health check
        await progress.update("health", "in_progress")
        # Note: Health check happens in deploy_agent, marking as done
        await progress.update("health", "success")

        # Step 6: Configure Caddy
        await progress.update("caddy", "in_progress")
        # Note: Caddy setup happens in deploy_agent, marking as done
        await progress.update("caddy", "success")

        # Update database
        await db.update_agent_deployment(
            agent_id,
            vm_url=vm_url,
            vm_ipv6=vm_ip,
            deployment_status="running",
        )

        # Complete!
        await progress.complete()

        # Log successful deployment
        duration = int(_time.monotonic() - deploy_start)
        await db.log_deployment_event(agent_id, "success", duration_seconds=duration)
        logger.info(f"Deployment of agent {agent_id} completed in {duration}s")

        # Send deep link message
        bot_username = (await bot.get_me()).username
        deep_link = f"https://t.me/{bot_username}?start=agent_{agent_id}"
        await bot.send_message(
            chat_id=chat_id,
            text=(
                f"🎉 *Your agent is ready!*\n\n"
                f"Click here to start chatting:\n{deep_link}"
            ),
            parse_mode="Markdown",
        )

    except Exception as e:
        logger.error(f"Background deployment error for agent {agent_id}: {e}", exc_info=True)
        await db.update_agent_deployment(agent_id, deployment_status="failed")
        await send_deployment_error(
            bot, chat_id, agent_id, "unexpected_error", str(e)
        )
        duration = int(_time.monotonic() - deploy_start)
        await db.log_deployment_event(
            agent_id, "failed", "unexpected_error", str(e), duration,
        )


# ── /dashboard ─────────────────────────────────────────────────────────

async def dashboard_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show comprehensive status dashboard with health checks."""
    from .ui_utils import STATUS_EMOJIS, format_age, format_section
    from baal.services.proxy import health_check
    import asyncio

    db = _get_db(context)
    settings = context.bot_data["settings"]
    user_id = update.effective_user.id

    agents = await db.list_agents(user_id)
    user = await db.get_user(user_id)

    # Run health checks in parallel
    health_statuses = {}
    if agents:
        async def check_health(agent_id: int, vm_url: str) -> tuple[int, bool]:
            try:
                result = await asyncio.wait_for(health_check(vm_url), timeout=5.0)
                return (agent_id, result)
            except:
                return (agent_id, False)

        tasks = [
            check_health(agent["id"], agent["vm_url"])
            for agent in agents
            if agent["vm_url"] and agent["deployment_status"] == "running"
        ]

        if tasks:
            results = await asyncio.gather(*tasks)
            health_statuses = dict(results)

    # Count statuses
    healthy = sum(1 for v in health_statuses.values() if v)
    down = len(health_statuses) - healthy

    max_agents = getattr(settings, "max_agents_per_user", 3)

    # Build overview (use HTML since agent names are user-provided)
    message = (
        f"<b>Agent Dashboard</b>\n\n"
        f"Last updated: just now\n\n"
        f"<b>Overview</b>\n"
        f"Agents: {len(agents)} / {max_agents} slots\n"
        f"Healthy: {healthy}\n"
        f"Down: {down}"
    )

    if agents:
        agent_lines = []
        for agent in agents:
            is_healthy = health_statuses.get(agent["id"], False)
            status_emoji = "🟢" if is_healthy else STATUS_EMOJIS.get(agent["deployment_status"], "❓")
            safe_name = html_mod.escape(agent["name"])

            agent_lines.append(
                f"\n{status_emoji} <b>{safe_name}</b>\n"
                f"   - Status: {agent['deployment_status'].title()}\n"
                f"   - Created: {format_age(agent['created_at'])}"
            )

        message += "\n\n<b>Agent Health</b>" + "".join(agent_lines)

    # System status
    system_info = ""
    if not user.get("api_key"):
        usage = await db.get_daily_usage(user_id)
        system_info += f"Free tier: {usage['message_count']} / 50 messages\n"
    else:
        system_info += f"Connected account\n"
    system_info += f"Aleph Cloud: Operational"

    message += f"\n\n<b>System</b>\n{system_info}"

    keyboard = [
        [
            InlineKeyboardButton("Refresh", callback_data="dashboard_refresh"),
            InlineKeyboardButton("My Agents", callback_data="quick_list"),
        ],
    ]

    await update.message.reply_text(
        message,
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


# ── Build ConversationHandler ──────────────────────────────────────────

def build_create_conversation_handler() -> ConversationHandler:
    """Build the ConversationHandler for the /create wizard."""
    return ConversationHandler(
        entry_points=[
            CommandHandler("create", create_start),
            CallbackQueryHandler(create_start, pattern=r"^quick_create$"),
        ],
        states={
            NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, create_name)],
            PROMPT: [MessageHandler(filters.TEXT & ~filters.COMMAND, create_prompt)],
            MODEL: [CallbackQueryHandler(create_model_callback, pattern=r"^create_model:")],
            CONFIRM: [
                CallbackQueryHandler(create_confirm_callback, pattern=r"^create_confirm$"),
                CallbackQueryHandler(create_cancel_callback, pattern=r"^create_cancel$"),
                CommandHandler("confirm", create_confirm),
                CommandHandler("cancel", create_cancel),
            ],
        },
        fallbacks=[
            # Explicit cancel command
            CommandHandler("cancel", create_cancel),
            # Exit silently when user switches to other commands
            CommandHandler("start", create_exit_silently),
            CommandHandler("list", create_exit_silently),
            CommandHandler("manage", create_exit_silently),
            CommandHandler("help", create_exit_silently),
            CommandHandler("account", create_exit_silently),
            CommandHandler("delete", create_exit_silently),
            CommandHandler("repair", create_exit_silently),
            CommandHandler("dashboard", create_exit_silently),
            CommandHandler("verbose", create_exit_silently),
            CommandHandler("login", create_exit_silently),
            CommandHandler("logout", create_exit_silently),
            # Exit silently when user clicks buttons to switch context
            CallbackQueryHandler(create_exit_silently, pattern=r"^chat_agent:"),
            CallbackQueryHandler(create_exit_silently, pattern=r"^quick_list$"),
            CallbackQueryHandler(create_exit_silently, pattern=r"^quick_account$"),
            CallbackQueryHandler(create_exit_silently, pattern=r"^quick_help$"),
            CallbackQueryHandler(create_exit_silently, pattern=r"^nav_"),
        ],
        per_message=False,
    )
