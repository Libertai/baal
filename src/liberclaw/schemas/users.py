"""Request/response schemas for user endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserProfile(BaseModel):
    id: uuid.UUID
    email: str | None
    email_verified: bool
    display_name: str | None
    avatar_url: str | None
    tier: str
    show_tool_calls: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    display_name: str | None = Field(None, max_length=100)
    show_tool_calls: bool | None = None


class ConnectionResponse(BaseModel):
    id: uuid.UUID
    type: str  # "oauth" or "wallet"
    provider: str | None = None  # "google", "github" for OAuth
    chain: str | None = None  # "evm" for wallet
    address: str | None = None
    email: str | None = None
    created_at: datetime


class ApiKeyCreate(BaseModel):
    key: str
    label: str = "default"


class ApiKeyResponse(BaseModel):
    id: uuid.UUID
    label: str
    masked_key: str
    is_active: bool
    created_at: datetime
