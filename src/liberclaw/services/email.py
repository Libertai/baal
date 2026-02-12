"""Email sending via Resend API."""

from __future__ import annotations

import logging

import resend

logger = logging.getLogger(__name__)


async def send_magic_link_email(
    to_email: str,
    token: str,
    frontend_url: str,
    resend_api_key: str,
) -> bool:
    """Send a magic link email. Returns True on success."""
    resend.api_key = resend_api_key
    verify_url = f"{frontend_url}/auth/verify?token={token}"

    try:
        resend.Emails.send({
            "from": "LiberClaw <noreply@libertai.io>",
            "to": [to_email],
            "subject": "Sign in to LiberClaw",
            "html": (
                f"<h2>Sign in to LiberClaw</h2>"
                f"<p>Click the link below to sign in. This link expires in 15 minutes.</p>"
                f'<p><a href="{verify_url}">Sign in to LiberClaw</a></p>'
                f"<p>If you didn't request this, you can safely ignore this email.</p>"
            ),
        })
        return True
    except Exception as e:
        logger.error(f"Failed to send magic link email to {to_email}: {e}")
        return False
