"""Add device_id to users, code_hash and attempts to magic_links.

Revision ID: 002
Revises: 001
Create Date: 2026-02-13
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("device_id", sa.String(255), nullable=True))
    op.create_unique_constraint("uq_users_device_id", "users", ["device_id"])

    op.add_column("magic_links", sa.Column("code_hash", sa.String(64), nullable=True))
    op.add_column(
        "magic_links",
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("magic_links", "attempts")
    op.drop_column("magic_links", "code_hash")

    op.drop_constraint("uq_users_device_id", "users", type_="unique")
    op.drop_column("users", "device_id")
