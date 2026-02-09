from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = {"env_prefix": ""}

    telegram_bot_token: str
    libertai_api_key: str
    libertai_api_base_url: str = "https://api.libertai.io/v1"

    # Aleph Cloud deployment
    aleph_private_key: str
    aleph_ssh_pubkey: str
    aleph_ssh_privkey_path: str = "~/.ssh/id_rsa"

    # Security
    bot_encryption_key: str  # Fernet key

    # Limits
    free_tier_daily_messages: int = 50
    max_agents_per_user: int = 3
    default_model: str = "hermes-3-8b-tee"

    # Database
    db_path: str = "baal.db"
