"""Email sending via SMTP, Resend API, or dev console fallback."""

from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def _build_html(verify_url: str) -> str:
    return (
        "<h2>Sign in to LiberClaw</h2>"
        "<p>Click the link below to sign in. This link expires in 15 minutes.</p>"
        f'<p><a href="{verify_url}">Sign in to LiberClaw</a></p>'
        "<p>If you didn't request this, you can safely ignore this email.</p>"
    )


async def send_magic_link_email(
    to_email: str,
    token: str,
    frontend_url: str,
    resend_api_key: str = "",
    *,
    smtp_host: str = "",
    smtp_port: int = 587,
    smtp_user: str = "",
    smtp_password: str = "",
    smtp_from: str = "LiberClaw <noreply@libertai.io>",
    smtp_use_tls: bool = True,
) -> bool:
    """Send a magic link email via SMTP, Resend, or dev console fallback."""
    verify_url = f"{frontend_url}/auth/verify?token={token}"

    # 1. SMTP if configured
    if smtp_host:
        return _send_smtp(
            to_email, verify_url,
            smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, smtp_use_tls,
        )

    # 2. Resend if configured
    if resend_api_key:
        return _send_resend(to_email, verify_url, resend_api_key, smtp_from)

    # 3. Dev fallback: log to console
    logger.warning("No email provider configured — logging magic link to console")
    logger.info("=" * 60)
    logger.info(f"MAGIC LINK for {to_email}")
    logger.info(f"Token: {token}")
    logger.info(f"URL:   {verify_url}")
    logger.info("=" * 60)
    return True


def _send_smtp(
    to_email: str,
    verify_url: str,
    host: str,
    port: int,
    user: str,
    password: str,
    from_addr: str,
    use_tls: bool,
) -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Sign in to LiberClaw"
        msg["From"] = from_addr
        msg["To"] = to_email
        msg.attach(MIMEText(_build_html(verify_url), "html"))

        with smtplib.SMTP(host, port) as server:
            if use_tls:
                server.starttls()
            if user and password:
                server.login(user, password)
            server.sendmail(from_addr, [to_email], msg.as_string())

        logger.info(f"Magic link email sent to {to_email} via SMTP")
        return True
    except Exception as e:
        logger.error(f"SMTP send failed for {to_email}: {e}")
        return False


def _send_resend(
    to_email: str,
    verify_url: str,
    api_key: str,
    from_addr: str,
) -> bool:
    try:
        import resend
        resend.api_key = api_key
        resend.Emails.send({
            "from": from_addr,
            "to": [to_email],
            "subject": "Sign in to LiberClaw",
            "html": _build_html(verify_url),
        })
        logger.info(f"Magic link email sent to {to_email} via Resend")
        return True
    except Exception as e:
        logger.error(f"Resend send failed for {to_email}: {e}")
        return False
