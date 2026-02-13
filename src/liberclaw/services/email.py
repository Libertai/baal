"""Email sending via SMTP, Resend API, or dev console fallback."""

from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def _build_html(verify_url: str, code: str = "") -> str:
    code_section = ""
    if code:
        code_section = (
            '<p style="font-size: 24px; font-weight: bold; letter-spacing: 8px; '
            f'text-align: center; margin: 20px 0;">{code}</p>'
            '<p style="text-align: center; color: #666;">Enter this code in the app</p>'
            '<p style="text-align: center; color: #666;">&mdash; or &mdash;</p>'
        )
    return (
        "<h2>Sign in to LiberClaw</h2>"
        f"{code_section}"
        f'<p><a href="{verify_url}">Click here to sign in</a></p>'
        "<p>This link and code expire in 15 minutes.</p>"
        "<p>If you didn't request this, you can safely ignore this email.</p>"
    )


async def send_magic_link_email(
    to_email: str,
    token: str,
    frontend_url: str,
    resend_api_key: str = "",
    *,
    code: str = "",
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
            code=code,
        )

    # 2. Resend if configured
    if resend_api_key:
        return _send_resend(to_email, verify_url, resend_api_key, smtp_from, code=code)

    # 3. Dev fallback: log to console
    logger.warning("No email provider configured — logging magic link to console")
    logger.info("=" * 60)
    logger.info(f"MAGIC LINK for {to_email}")
    logger.info(f"Token: {token}")
    logger.info(f"Code: {code}")
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
    *,
    code: str = "",
) -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Sign in to LiberClaw"
        msg["From"] = from_addr
        msg["To"] = to_email
        msg.attach(MIMEText(_build_html(verify_url, code=code), "html"))

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
    *,
    code: str = "",
) -> bool:
    try:
        import resend
        resend.api_key = api_key
        resend.Emails.send({
            "from": from_addr,
            "to": [to_email],
            "subject": "Sign in to LiberClaw",
            "html": _build_html(verify_url, code=code),
        })
        logger.info(f"Magic link email sent to {to_email} via Resend")
        return True
    except Exception as e:
        logger.error(f"Resend send failed for {to_email}: {e}")
        return False
