"""Request/response schemas for agent endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    system_prompt: str | None = Field(None, min_length=1)
    model: str | None = None
    template_id: str | None = None
    skills: list[str] | None = None


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
    skills: list[str] | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("skills", mode="before")
    @classmethod
    def parse_skills(cls, v):
        if isinstance(v, str):
            import json

            return json.loads(v)
        return v

    model_config = {"from_attributes": True}


class AgentListResponse(BaseModel):
    agents: list[AgentResponse]
    total: int


class DeploymentStepResponse(BaseModel):
    key: str
    status: str  # pending | active | done | failed
    detail: str | None = None


class DeploymentLogEntry(BaseModel):
    timestamp: float
    level: str  # info | success | error | warning
    message: str


class DeploymentStatusResponse(BaseModel):
    agent_id: uuid.UUID
    deployment_status: str
    vm_url: str | None
    steps: list[DeploymentStepResponse] = []
    logs: list[DeploymentLogEntry] = []


class AgentHealthResponse(BaseModel):
    agent_id: uuid.UUID
    healthy: bool
    vm_url: str | None
    agent_version: int | None = None
    current_version: int | None = None
