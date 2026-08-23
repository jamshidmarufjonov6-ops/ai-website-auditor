"""Add error_code to audits

Revision ID: 0002_audit_error_code
Revises: 0001_initial
Create Date: 2026-08-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_audit_error_code"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("audits", sa.Column("error_code", sa.String(length=64), nullable=True))


def downgrade() -> None:
    # Batch mode makes the column drop work on older SQLite versions.
    with op.batch_alter_table("audits") as batch_op:
        batch_op.drop_column("error_code")
