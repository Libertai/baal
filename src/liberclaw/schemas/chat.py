"""Request/response schemas for chat endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=32000)
