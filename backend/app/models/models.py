"""PG-NEXUS persistence model.

Competency scores are 0–10 (doc §IV). A missing score means "Chưa đánh giá", never 0.
"""
import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON, BigInteger, Date, DateTime, Enum, Float, ForeignKey, Index, Integer, LargeBinary, String, Text,
    UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


def _id() -> str:
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    PG = "pg"
    SUPERVISOR = "supervisor"


class AssessmentSource(str, enum.Enum):
    QUIZ = "quiz"
    VOICE = "voice"
    SUP = "sup"


class SessionKind(str, enum.Enum):
    ONBOARDING = "onboarding"
    QUEST = "quest"
    PRACTICE = "practice"


class FlagStatus(str, enum.Enum):
    OPEN = "open"          # score < 5.0
    READY = "ready"        # AI score reached 7.0, waiting for SUP stamp
    CLOSED = "closed"      # SUP stamped


def _enum(e: type[enum.Enum]) -> Enum:
    return Enum(e, values_callable=lambda x: [m.value for m in x], native_enum=False, length=20)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    keycloak_sub: Mapped[str | None] = mapped_column(String(64), unique=True)
    username: Mapped[str] = mapped_column(String(100))
    full_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[UserRole] = mapped_column(_enum(UserRole), default=UserRole.PG)
    store_name: Mapped[str | None] = mapped_column(String(200))
    is_demo: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Assessment(Base):
    """One scored observation of one competency; the passport is derived from these."""
    __tablename__ = "assessments"
    __table_args__ = (Index("ix_assessments_user_comp", "user_id", "competency", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    competency: Mapped[str] = mapped_column(String(4))
    score: Mapped[float] = mapped_column(Float)
    source: Mapped[AssessmentSource] = mapped_column(_enum(AssessmentSource))
    ref_id: Mapped[str | None] = mapped_column(String(36))
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RedFlag(Base):
    __tablename__ = "red_flags"
    __table_args__ = (Index("ix_red_flags_user_status", "user_id", "status"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    competency: Mapped[str] = mapped_column(String(4))
    status: Mapped[FlagStatus] = mapped_column(_enum(FlagStatus), default=FlagStatus.OPEN)
    opened_score: Mapped[float] = mapped_column(Float)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ready_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    sup_score: Mapped[float | None] = mapped_column(Float)
    sup_note: Mapped[str | None] = mapped_column(Text)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    question_ids: Mapped[list] = mapped_column(JSON)
    answers: Mapped[list] = mapped_column(JSON, default=list)
    correct: Mapped[int] = mapped_column(Integer, default=0)
    by_category: Mapped[dict] = mapped_column(JSON, default=dict)
    points: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class VoiceSession(Base):
    __tablename__ = "voice_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    scenario_code: Mapped[str] = mapped_column(String(10))
    kind: Mapped[SessionKind] = mapped_column(_enum(SessionKind))
    quest_id: Mapped[str | None] = mapped_column(String(36))
    turns: Mapped[list] = mapped_column(JSON, default=list)
    revealed: Mapped[list] = mapped_column(JSON, default=list)
    scores: Mapped[dict] = mapped_column(JSON, default=dict)
    overall: Mapped[float | None] = mapped_column(Float)
    report: Mapped[dict] = mapped_column(JSON, default=dict)
    points: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TurnAudio(Base):
    """PG's recorded voice for one turn, kept so the SUP can listen back (Workstream 3)."""
    __tablename__ = "turn_audio"

    session_id: Mapped[str] = mapped_column(ForeignKey("voice_sessions.id", ondelete="CASCADE"), primary_key=True)
    turn_index: Mapped[int] = mapped_column(Integer, primary_key=True)
    mime: Mapped[str] = mapped_column(String(60))
    data: Mapped[bytes] = mapped_column(LargeBinary)


class Quest(Base):
    __tablename__ = "quests"
    __table_args__ = (Index("ix_quests_user_day", "user_id", "day"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    day: Mapped[date] = mapped_column(Date)
    scenario_code: Mapped[str] = mapped_column(String(10))
    red_flag_id: Mapped[str | None] = mapped_column(ForeignKey("red_flags.id", ondelete="SET NULL"))
    competency: Mapped[str | None] = mapped_column(String(4))
    session_id: Mapped[str | None] = mapped_column(String(36))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PointsEntry(Base):
    __tablename__ = "points_ledger"
    __table_args__ = (Index("ix_points_user_time", "user_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    points: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(40))
    ref_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FieldAudit(Base):
    """Numbers the Sales Sup enters per PG (Workstream 1 · Field Audit Sync)."""
    __tablename__ = "field_audits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    sup_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    period: Mapped[date] = mapped_column(Date)
    revenue_vnd: Mapped[int | None] = mapped_column(BigInteger)
    dday_units: Mapped[int | None] = mapped_column(Integer)
    activations: Mapped[int | None] = mapped_column(Integer)
    extra_displays: Mapped[int | None] = mapped_column(Integer)
    c7_score: Mapped[float | None] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BillStatus(str, enum.Enum):
    DRAFT = "draft"        # read by OCR, waiting for the PG to check and confirm
    VALID = "valid"        # counts toward D-day results
    REVIEW = "review"      # failed an automatic check; SUP decides
    REJECTED = "rejected"  # duplicate or not eligible
    VOID = "void"          # withdrawn with a reason; never deleted (append-only ledger)


class DdayProgram(Base):
    """A D-day / hoạt náo program configured by the SUP; PGs join it with a shift."""
    __tablename__ = "dday_programs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    name: Mapped[str] = mapped_column(String(200))
    activity: Mapped[str] = mapped_column(String(40))
    day: Mapped[date] = mapped_column(Date, index=True)
    store_name: Mapped[str] = mapped_column(String(200))
    is_open: Mapped[bool] = mapped_column(default=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DdayShift(Base):
    __tablename__ = "dday_shifts"
    __table_args__ = (UniqueConstraint("user_id", "program_id", name="uq_shift_user_program"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    program_id: Mapped[str] = mapped_column(ForeignKey("dday_programs.id", ondelete="CASCADE"))
    hours: Mapped[float] = mapped_column(Float)   # self-declared, not yet verified
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Bill(Base):
    __tablename__ = "bills"
    __table_args__ = (Index("ix_bills_program_status", "program_id", "status"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    shift_id: Mapped[str] = mapped_column(ForeignKey("dday_shifts.id", ondelete="CASCADE"))
    program_id: Mapped[str] = mapped_column(ForeignKey("dday_programs.id", ondelete="CASCADE"))
    image_sha256: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[BillStatus] = mapped_column(_enum(BillStatus), default=BillStatus.DRAFT)
    flags: Mapped[list] = mapped_column(JSON, default=list)
    bill_no: Mapped[str | None] = mapped_column(String(60))
    store_name: Mapped[str | None] = mapped_column(String(200))
    purchased_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    total_vnd: Mapped[int | None] = mapped_column(BigInteger)
    lines: Mapped[list] = mapped_column(JSON, default=list)
    ocr_text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BillImage(Base):
    __tablename__ = "bill_images"

    bill_id: Mapped[str] = mapped_column(ForeignKey("bills.id", ondelete="CASCADE"), primary_key=True)
    mime: Mapped[str] = mapped_column(String(40))
    data: Mapped[bytes] = mapped_column(LargeBinary)


class BillEvent(Base):
    """Audit trail: every OCR read, PG edit, confirmation, SUP decision and void."""
    __tablename__ = "bill_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    bill_id: Mapped[str] = mapped_column(ForeignKey("bills.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(30))
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
