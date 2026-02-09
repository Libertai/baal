from pydantic_settings import BaseSettings


class AgentSettings(BaseSettings):
    """Settings for a deployed agent instance."""

    model_config = {"env_prefix": ""}

    agent_name: str = "Agent"
    system_prompt: str = "You are a helpful assistant."
    model: str = "hermes-3-8b-tee"
    libertai_api_key: str
    agent_secret: str  # Shared secret for bot<->agent auth
    port: int = 8080
    db_path: str = "agent.db"
    max_history: int = 20
