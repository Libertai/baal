"""Add skills column to agents table.

Revision ID: 003
Revises: 002
Create Date: 2026-02-13
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("skills", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("agents", "skills")
