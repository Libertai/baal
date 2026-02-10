# src/baal/handlers/deployment_progress.py

import html as html_mod
import logging

from telegram import Bot
from telegram.constants import ParseMode
from telegram.error import BadRequest

logger = logging.getLogger(__name__)

class DeploymentProgress:
    """Manages live progress updates during agent deployment."""

    STEPS = [
        ("instance", "Create Aleph Cloud instance"),
        ("verify", "Verify message on network"),
        ("allocation", "Wait for VM allocation"),
        ("ssh", "Deploy agent code via SSH"),
        ("health", "Run health check"),
        ("caddy", "Configure HTTPS"),
    ]

    def __init__(self, bot: Bot, chat_id: int, agent_name: str):
        self.bot = bot
        self.chat_id = chat_id
        self.agent_name = agent_name
        self.message_id = None
        self.current_step = 0
        self.failed = False

    async def init(self):
        """Send initial progress message."""
        msg = await self.bot.send_message(
            chat_id=self.chat_id,
            text=self._render(),
            parse_mode=ParseMode.HTML,
        )
        self.message_id = msg.message_id

    async def update(self, step_key: str, status: str = "in_progress"):
        """
        Update progress display.

        Args:
            step_key: Step identifier (e.g., 'instance', 'ssh')
            status: 'in_progress', 'success', or 'failed'
        """
        # Find step index
        for i, (key, _) in enumerate(self.STEPS):
            if key == step_key:
                self.current_step = i
                break

        if status == "failed":
            self.failed = True

        try:
            await self.bot.edit_message_text(
                chat_id=self.chat_id,
                message_id=self.message_id,
                text=self._render(),
                parse_mode=ParseMode.HTML,
            )
        except BadRequest as e:
            # "Message is not modified" happens when text hasn't changed
            # (e.g., calling update() twice with same step/status) -- ignore it
            if "message is not modified" in str(e).lower():
                logger.debug(f"Progress message unchanged, skipping edit")
            else:
                logger.warning(f"Failed to update progress: {e}")
        except Exception as e:
            logger.warning(f"Failed to update progress: {e}")

    async def complete(self):
        """Mark deployment as complete."""
        self.current_step = len(self.STEPS)
        try:
            await self.bot.edit_message_text(
                chat_id=self.chat_id,
                message_id=self.message_id,
                text=self._render_complete(),
                parse_mode=ParseMode.HTML,
            )
        except BadRequest as e:
            if "message is not modified" in str(e).lower():
                logger.debug(f"Progress message unchanged, skipping edit")
            else:
                logger.warning(f"Failed to mark complete: {e}")
        except Exception as e:
            logger.warning(f"Failed to mark complete: {e}")

    def _render(self) -> str:
        """Render current progress state (HTML format)."""
        safe_name = html_mod.escape(self.agent_name)
        progress = int((self.current_step / len(self.STEPS)) * 100)
        bar_length = 16
        filled = int((progress / 100) * bar_length)
        bar = "█" * filled + "░" * (bar_length - filled)

        lines = [
            f"<b>Deploying Agent:</b> {safe_name}\n",
            f"Progress: {bar} {progress}%\n",
        ]

        for i, (key, label) in enumerate(self.STEPS):
            if i < self.current_step:
                lines.append(f"  {label}")
            elif i == self.current_step:
                if self.failed:
                    lines.append(f"  {label} (failed)")
                else:
                    lines.append(f"  {label}...")
            else:
                lines.append(f"  {label}")

        if not self.failed:
            remaining = max(1, len(self.STEPS) - self.current_step)
            lines.append(f"\nEstimated time remaining: ~{remaining} minute{'s' if remaining != 1 else ''}")

        return "\n".join(lines)

    def _render_complete(self) -> str:
        """Render completion state (HTML format)."""
        safe_name = html_mod.escape(self.agent_name)
        return (
            f"<b>Deployment Complete!</b>\n\n"
            f"Agent <b>{safe_name}</b> is now running.\n"
            f"All systems operational."
        )
