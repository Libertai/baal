"""Initial schema.

Revision ID: 001
Revises:
Create Date: 2026-02-12
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), unique=True, nullable=True),
        sa.Column("email_verified", sa.Boolean(), default=False),
        sa.Column("display_name", sa.String(100), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("tier", sa.String(20), default="free"),
        sa.Column("show_tool_calls", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # OAuth connections
    op.create_table(
        "oauth_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("provider_id", sa.String(255), nullable=False),
        sa.Column("provider_email", sa.String(320), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("provider", "provider_id", name="uq_oauth_provider_id"),
    )

    # Wallet connections
    op.create_table(
        "wallet_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chain", sa.String(20), nullable=False),
        sa.Column("address", sa.String(100), nullable=False),
        sa.Column("is_primary", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("chain", "address", name="uq_wallet_chain_address"),
    )

    # Sessions (refresh tokens)
    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("refresh_token_hash", sa.String(64), nullable=False),
        sa.Column("device_info", sa.String(500), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Magic links
    op.create_table(
        "magic_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, index=True),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # API keys
    op.create_table(
        "api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("encrypted_key", sa.Text(), nullable=False),
        sa.Column("label", sa.String(100), default="default"),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Agents
    op.create_table(
        "agents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("model", sa.String(50), default="qwen3-coder-next"),
        sa.Column("deployment_status", sa.String(20), default="pending"),
        sa.Column("instance_hash", sa.String(100), nullable=True),
        sa.Column("vm_ipv6", sa.String(100), nullable=True),
        sa.Column("vm_url", sa.String(255), nullable=True),
        sa.Column("crn_url", sa.String(255), nullable=True),
        sa.Column("auth_token", sa.Text(), nullable=True),
        sa.Column("source", sa.String(20), default="web"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Deployment history
    op.create_table(
        "deployment_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("step", sa.String(50), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Daily usage
    op.create_table(
        "daily_usage",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("message_count", sa.Integer(), default=0),
        sa.UniqueConstraint("user_id", "date", name="uq_daily_usage_user_date"),
    )

    # Usage events
    op.create_table(
        "usage_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("agents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("tokens_used", sa.Integer(), default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Wallet challenges
    op.create_table(
        "wallet_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("address", sa.String(100), nullable=False, index=True),
        sa.Column("nonce", sa.String(100), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("wallet_challenges")
    op.drop_table("usage_events")
    op.drop_table("daily_usage")
    op.drop_table("deployment_history")
    op.drop_table("agents")
    op.drop_table("api_keys")
    op.drop_table("magic_links")
    op.drop_table("sessions")
    op.drop_table("wallet_connections")
    op.drop_table("oauth_connections")
    op.drop_table("users")
