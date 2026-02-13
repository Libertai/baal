"""Activity event schemas."""

from __future__ import annotations

from pydantic import BaseModel


class ActivityEventResponse(BaseModel):
    id: str
    event_type: str
    metadata: dict | None = None
    is_public: bool
    created_at: str


class ActivityListResponse(BaseModel):
    events: list[ActivityEventResponse]
