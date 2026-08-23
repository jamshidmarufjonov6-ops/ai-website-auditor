"""Initial schema: users, websites, audits, audit_results, recommendations

Revision ID: 0001_initial
Revises:
Create Date: 2026-08-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "websites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("domain", sa.String(length=255), nullable=False),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_audited_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_websites_domain", "websites", ["domain"], unique=True)

    op.create_table(
        "audits",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("public_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("website_id", sa.Integer(), sa.ForeignKey("websites.id"), nullable=True),
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("stage", sa.String(length=120), nullable=False),
        sa.Column("overall_score", sa.Integer(), nullable=True),
        sa.Column("category_scores", sa.JSON(), nullable=True),
        sa.Column("summary", sa.JSON(), nullable=True),
        sa.Column("results", sa.JSON(), nullable=True),
        sa.Column("ai_recommendations", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("website_id", "started_at", name="uq_website_started"),
    )
    op.create_index("ix_audits_public_id", "audits", ["public_id"], unique=True)
    op.create_index("ix_audits_user_id", "audits", ["user_id"], unique=False)
    op.create_index("ix_audits_website_id", "audits", ["website_id"], unique=False)

    op.create_table(
        "audit_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("audit_id", sa.Integer(), sa.ForeignKey("audits.id"), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("check_id", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("recommendation", sa.Text(), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
    )
    op.create_index("ix_audit_results_audit_id", "audit_results", ["audit_id"], unique=False)
    op.create_index("ix_audit_results_category", "audit_results", ["category"], unique=False)

    op.create_table(
        "recommendations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("audit_id", sa.Integer(), sa.ForeignKey("audits.id"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("priority", sa.String(length=16), nullable=False),
        sa.Column("difficulty", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("problem", sa.Text(), nullable=False),
        sa.Column("why_it_matters", sa.Text(), nullable=False),
        sa.Column("recommended_fix", sa.Text(), nullable=False),
    )
    op.create_index("ix_recommendations_audit_id", "recommendations", ["audit_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_recommendations_audit_id", table_name="recommendations")
    op.drop_table("recommendations")
    op.drop_index("ix_audit_results_category", table_name="audit_results")
    op.drop_index("ix_audit_results_audit_id", table_name="audit_results")
    op.drop_table("audit_results")
    op.drop_index("ix_audits_website_id", table_name="audits")
    op.drop_index("ix_audits_user_id", table_name="audits")
    op.drop_index("ix_audits_public_id", table_name="audits")
    op.drop_table("audits")
    op.drop_index("ix_websites_domain", table_name="websites")
    op.drop_table("websites")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
