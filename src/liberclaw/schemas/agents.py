"""Request/response schemas for agent endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    system_prompt: str = Field(..., min_length=1)
    model: str = "qwen3-coder-next"


class AgentUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    system_prompt: str | None = Field(None, min_length=1)
    model: str | None = None


class AgentResponse(BaseModel):
    id: uuid.UUID
    name: str
    system_prompt: str
    model: str
    deployment_status: str
    vm_url: str | None
    source: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgentListResponse(BaseModel):
    agents: list[AgentResponse]
    total: int


class DeploymentStatusResponse(BaseModel):
    agent_id: uuid.UUID
    deployment_status: str
    vm_url: str | None
    steps: list[dict] | None = None


class AgentHealthResponse(BaseModel):
    agent_id: uuid.UUID
    healthy: bool
    vm_url: str | None
