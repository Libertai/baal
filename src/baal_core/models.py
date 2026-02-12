"""Shared models and constants used by both Baal bot and LiberClaw API."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


AVAILABLE_MODELS: dict[str, dict] = {
    "qwen3-coder-next": {
        "name": "Qwen 3 Coder Next",
        "emoji": "\u2728",
        "description": "Latest coding model",
        "best_for": "Code generation, debugging, technical tasks",
        "context": "96K tokens",
        "speed": "Fast",
        "badges": ["Recommended"],
    },
    "glm-4.7": {
        "name": "GLM 4.7",
        "emoji": "\U0001f4ac",
        "description": "General-purpose chat",
        "best_for": "Conversations, research, creative writing",
        "context": "128K tokens",
        "speed": "Moderate",
        "badges": ["Great for long documents"],
    },
}

DEFAULT_MODEL = "qwen3-coder-next"


@dataclass
class VMInfo:
    """Information about an allocated VM."""

    vm_ipv4: str
    ssh_port: int = 22


@dataclass
class DeploymentResult:
    """Result of an agent deployment operation."""

    status: str  # "success" or "error"
    vm_url: str | None = None
    error: str | None = None
    instance_hash: str | None = None
    steps: list[dict] | None = None
