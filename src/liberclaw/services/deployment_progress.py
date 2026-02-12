"""In-memory deployment progress store for real-time step tracking.

Background deployment tasks update this store as they progress.
The status endpoint reads from it to return structured step/log data.
Data is ephemeral — cleared when deployment finishes.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field


STEP_KEYS = [
    "provisioning",
    "allocation",
    "ssh",
    "environment",
    "service",
    "health",
]


@dataclass
class StepInfo:
    key: str
    status: str = "pending"  # pending | active | done | failed
    detail: str | None = None


@dataclass
class LogEntry:
    timestamp: float
    level: str  # info | success | error | warning
    message: str


@dataclass
class DeploymentProgress:
    steps: list[StepInfo] = field(default_factory=list)
    logs: list[LogEntry] = field(default_factory=list)
    started_at: float = field(default_factory=time.monotonic)


# Module-level store: agent_id -> progress
_store: dict[uuid.UUID, DeploymentProgress] = {}


def init_progress(agent_id: uuid.UUID) -> DeploymentProgress:
    """Create a fresh progress entry with all steps pending."""
    progress = DeploymentProgress(
        steps=[StepInfo(key=k) for k in STEP_KEYS],
    )
    _store[agent_id] = progress
    return progress


def set_step(
    agent_id: uuid.UUID,
    key: str,
    status: str,
    detail: str | None = None,
) -> None:
    """Update a step's status and optional detail text."""
    progress = _store.get(agent_id)
    if not progress:
        return
    for step in progress.steps:
        if step.key == key:
            step.status = status
            if detail is not None:
                step.detail = detail
            break


def add_log(
    agent_id: uuid.UUID,
    level: str,
    message: str,
) -> None:
    """Append a timestamped log entry."""
    progress = _store.get(agent_id)
    if not progress:
        return
    progress.logs.append(LogEntry(
        timestamp=time.time(),
        level=level,
        message=message,
    ))


def get_progress(agent_id: uuid.UUID) -> DeploymentProgress | None:
    """Get current progress for an agent, or None if not tracking."""
    return _store.get(agent_id)


def clear_progress(agent_id: uuid.UUID) -> None:
    """Remove progress data after deployment completes."""
    _store.pop(agent_id, None)
