"""Add activity_events table.

Revision ID: 004
Revises: 003
Create Date: 2026-02-13
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "activity_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "agent_id",
            UUID(as_uuid=True),
            sa.ForeignKey("agents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("metadata_json", sa.JSON, nullable=True),
        sa.Column("is_public", sa.Boolean, default=False, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_activity_user_created", "activity_events", ["user_id", "created_at"]
    )
    op.create_index(
        "ix_activity_public_created", "activity_events", ["is_public", "created_at"]
    )


def downgrade() -> None:
    op.drop_table("activity_events")
