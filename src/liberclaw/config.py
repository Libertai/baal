"""LiberClaw configuration via pydantic-settings."""

from __future__ import annotations

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


def _shared(name: str) -> AliasChoices:
    """Allow LIBERCLAW_<NAME> with fallback to bare <NAME> for shared bot vars."""
    return AliasChoices(f"LIBERCLAW_{name}", name)


class LiberClawSettings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = {"env_prefix": "LIBERCLAW_", "env_file": ".env", "extra": "ignore"}

    # Database
    database_url: str = "postgresql+asyncpg://localhost/liberclaw"

    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    # Encryption (Fernet key for API keys, agent secrets)
    encryption_key: str

    # OAuth — Google
    google_client_id: str = ""
    google_client_secret: str = ""

    # OAuth — GitHub
    github_client_id: str = ""
    github_client_secret: str = ""

    # Magic link
    magic_link_secret: str = ""
    resend_api_key: str = ""

    # SMTP (used instead of Resend when configured)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "LiberClaw <noreply@libertai.io>"
    smtp_use_tls: bool = True

    # Aleph Cloud deployment (falls back to unprefixed bot vars)
    aleph_private_key: str = Field(default="", validation_alias=_shared("ALEPH_PRIVATE_KEY"))
    aleph_ssh_pubkey: str = Field(default="", validation_alias=_shared("ALEPH_SSH_PUBKEY"))
    aleph_ssh_privkey_path: str = Field(default="~/.ssh/id_rsa", validation_alias=_shared("ALEPH_SSH_PRIVKEY_PATH"))

    # LibertAI (falls back to unprefixed bot var)
    libertai_api_key: str = Field(default="", validation_alias=_shared("LIBERTAI_API_KEY"))
    libertai_api_base_url: str = "https://api.libertai.io/v1"

    # Frontend / CORS
    frontend_url: str = "http://localhost:8081"
    api_url: str = "http://localhost:8000"
    cors_origins: list[str] = ["http://localhost:8081"]

    # Limits
    free_tier_daily_messages: int = 50
    max_agents_per_user: int = 5
    default_model: str = "qwen3-coder-next"

    # VM Pool
    pool_enabled: bool = False
    pool_db_path: str = "pool.db"
    pool_min_size: int = 5
    pool_max_size: int = 10
    pool_replenish_interval: int = 30
    pool_max_age_hours: int = 24
