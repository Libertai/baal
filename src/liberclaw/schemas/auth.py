"""Request/response schemas for auth endpoints."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, EmailStr, Field


class MagicLinkRequest(BaseModel):
    email: EmailStr


class MagicLinkResponse(BaseModel):
    message: str = "If this email is valid, a magic link has been sent."


class MagicLinkVerifyRequest(BaseModel):
    token: str | None = None
    email: EmailStr | None = None
    code: str | None = Field(None, pattern=r"^\d{6}$")


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshRequest(BaseModel):
    refresh_token: str


class WalletChallengeRequest(BaseModel):
    address: str


class WalletChallengeResponse(BaseModel):
    nonce: str
    message: str  # The message to sign


class WalletVerifyRequest(BaseModel):
    address: str
    signature: str
    nonce: str


class GuestRequest(BaseModel):
    device_id: str


class GoogleIdTokenRequest(BaseModel):
    id_token: str


class AppleIdTokenRequest(BaseModel):
    identity_token: str
    full_name: str | None = None
