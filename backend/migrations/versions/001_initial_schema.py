"""Initial schema - create all tables

Revision ID: 001_initial
Revises: 
Create Date: 2026-09-30 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("keycloak_id", sa.String(36), unique=True, nullable=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column(
            "role",
            sa.Enum("pg", "supervisor", "admin", name="userrole"),
            nullable=False,
            server_default="pg",
        ),
        sa.Column("store_code", sa.String(50), nullable=True),
        sa.Column("region", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_users_keycloak_id", "users", ["keycloak_id"])
    op.create_index("ix_users_email", "users", ["email"])

    # --- pg_passports ---
    op.create_table(
        "pg_passports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column("c1_approach", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("c2_discovery", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("c3_storytelling", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("c4_expansion", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("c5_objection", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("c6_negotiation", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("c7_discipline", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("overall_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("total_points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("red_flags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("is_initialized", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("last_assessment_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_pg_passports_user_id", "pg_passports", ["user_id"])

    # --- quizzes ---
    op.create_table(
        "quizzes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("competency_target", sa.String(10), nullable=True),
        sa.Column("questions", sa.JSON(), nullable=False),
        sa.Column("time_limit_seconds", sa.Integer(), nullable=False, server_default="180"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # --- quiz_attempts ---
    op.create_table(
        "quiz_attempts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quiz_id", sa.String(36), sa.ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("points_earned", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("answers", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("time_taken_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "status",
            sa.Enum("pending", "in_progress", "completed", "failed", name="sessionstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_quiz_attempts_user_id", "quiz_attempts", ["user_id"])
    op.create_index("ix_quiz_attempts_quiz_id", "quiz_attempts", ["quiz_id"])

    # --- voice_scenarios ---
    op.create_table(
        "voice_scenarios",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("scenario_type", sa.String(50), nullable=False),
        sa.Column("persona_prompt", sa.Text(), nullable=False),
        sa.Column("target_competencies", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("difficulty", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # --- voice_sessions ---
    op.create_table(
        "voice_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scenario_id", sa.String(36), sa.ForeignKey("voice_scenarios.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "in_progress", "completed", "failed", name="sessionstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("conversation_history", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("scores", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("overall_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("points_earned", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("avg_response_latency_ms", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("keyword_hits", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("feedback_summary", sa.Text(), nullable=True),
        sa.Column("recording_url", sa.String(500), nullable=True),
        sa.Column("supervisor_stamp", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("supervisor_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("supervisor_notes", sa.Text(), nullable=True),
        sa.Column("stamped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_voice_sessions_user_id", "voice_sessions", ["user_id"])
    op.create_index("ix_voice_sessions_scenario_id", "voice_sessions", ["scenario_id"])

    # --- daily_quests ---
    op.create_table(
        "daily_quests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("target_competency", sa.String(10), nullable=False),
        sa.Column("task_type", sa.String(50), nullable=False),
        sa.Column("task_id", sa.String(36), nullable=False),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "assigned_date",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_daily_quests_user_id", "daily_quests", ["user_id"])
    op.create_index("ix_daily_quests_user_date", "daily_quests", ["user_id", "assigned_date"])


def downgrade() -> None:
    op.drop_table("daily_quests")
    op.drop_table("voice_sessions")
    op.drop_table("voice_scenarios")
    op.drop_table("quiz_attempts")
    op.drop_table("quizzes")
    op.drop_table("pg_passports")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS sessionstatus")
    op.execute("DROP TYPE IF EXISTS userrole")
