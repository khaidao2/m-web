"""
PG-NEXUS Database Models
Entities: User, PGPassport, Quiz, QuizAttempt, VoiceSession, Competency, Leaderboard
"""
import uuid
import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Integer, Float, Boolean, DateTime, Text, JSON,
    ForeignKey, Enum as SAEnum, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    PG = "pg"
    SUPERVISOR = "supervisor"
    ADMIN = "admin"


class CompetencyLevel(int, enum.Enum):
    LEVEL_1 = 1  # Cần cải thiện
    LEVEL_2 = 2  # Trung bình - Đạt yêu cầu
    LEVEL_3 = 3  # Khá - Thành thạo
    LEVEL_4 = 4  # Giỏi - Xuất sắc


class SessionStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    keycloak_id: Mapped[Optional[str]] = mapped_column(String(36), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), default=UserRole.PG)
    store_code: Mapped[Optional[str]] = mapped_column(String(50))  # BHX store code
    region: Mapped[Optional[str]] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    passport: Mapped[Optional["PGPassport"]] = relationship("PGPassport", back_populates="user", uselist=False)
    quiz_attempts: Mapped[list["QuizAttempt"]] = relationship("QuizAttempt", back_populates="user")
    voice_sessions: Mapped[list["VoiceSession"]] = relationship("VoiceSession", back_populates="user")


class PGPassport(Base):
    """Digital Passport - tracks PG competency levels (7 competencies)"""
    __tablename__ = "pg_passports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), unique=True, index=True)

    # 7 Competencies scores (1.0-4.0 scale)
    c1_approach: Mapped[float] = mapped_column(Float, default=0.0)       # Tiếp cận & Thiết lập kết nối
    c2_discovery: Mapped[float] = mapped_column(Float, default=0.0)      # Thấu hiểu & Khơi gợi nhu cầu
    c3_storytelling: Mapped[float] = mapped_column(Float, default=0.0)   # Tư vấn giải pháp sản phẩm
    c4_expansion: Mapped[float] = mapped_column(Float, default=0.0)      # Gia tăng giá trị giỏ hàng
    c5_objection: Mapped[float] = mapped_column(Float, default=0.0)      # Xử lý phản bác & Củng cố niềm tin
    c6_negotiation: Mapped[float] = mapped_column(Float, default=0.0)    # Đàm phán & Thuyết phục
    c7_discipline: Mapped[float] = mapped_column(Float, default=0.0)     # Thái độ & Kỷ luật

    # Computed
    overall_score: Mapped[float] = mapped_column(Float, default=0.0)
    total_points: Mapped[int] = mapped_column(Integer, default=0)  # gamification points
    red_flags: Mapped[list] = mapped_column(JSON, default=list)    # list of competency keys with score < 2.0

    # Status
    is_initialized: Mapped[bool] = mapped_column(Boolean, default=False)
    last_assessment_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship("User", back_populates="passport")


class Quiz(Base):
    """3-minute quiz bank"""
    __tablename__ = "quizzes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(100))  # product_knowledge, process, promotion
    competency_target: Mapped[Optional[str]] = mapped_column(String(10))  # c1-c7
    questions: Mapped[list] = mapped_column(JSON)  # list of {id, text, image_url, options, correct, explanation}
    time_limit_seconds: Mapped[int] = mapped_column(Integer, default=180)  # 3 minutes
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    attempts: Mapped[list["QuizAttempt"]] = relationship("QuizAttempt", back_populates="quiz")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    quiz_id: Mapped[str] = mapped_column(String(36), ForeignKey("quizzes.id"), index=True)

    score: Mapped[float] = mapped_column(Float, default=0.0)  # percentage 0-100
    points_earned: Mapped[int] = mapped_column(Integer, default=0)
    answers: Mapped[list] = mapped_column(JSON, default=list)  # list of {question_id, selected, correct, time_ms}
    time_taken_seconds: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[SessionStatus] = mapped_column(SAEnum(SessionStatus), default=SessionStatus.PENDING)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship("User", back_populates="quiz_attempts")
    quiz: Mapped["Quiz"] = relationship("Quiz", back_populates="attempts")


class VoiceScenario(Base):
    """AI Voice Simulation scenarios"""
    __tablename__ = "voice_scenarios"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Text] = mapped_column(Text)
    scenario_type: Mapped[str] = mapped_column(String(50))  # customer_objection, store_manager, etc.
    persona_prompt: Mapped[str] = mapped_column(Text)  # Claude system prompt for the AI persona
    target_competencies: Mapped[list] = mapped_column(JSON, default=list)  # ["c1","c5"]
    difficulty: Mapped[int] = mapped_column(Integer, default=1)  # 1-5
    duration_minutes: Mapped[int] = mapped_column(Integer, default=7)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sessions: Mapped[list["VoiceSession"]] = relationship("VoiceSession", back_populates="scenario")


class VoiceSession(Base):
    """AI Voice simulation session"""
    __tablename__ = "voice_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    scenario_id: Mapped[str] = mapped_column(String(36), ForeignKey("voice_scenarios.id"), index=True)

    # Session state
    status: Mapped[SessionStatus] = mapped_column(SAEnum(SessionStatus), default=SessionStatus.PENDING)
    conversation_history: Mapped[list] = mapped_column(JSON, default=list)  # [{role, content, timestamp, audio_url}]

    # Scoring
    scores: Mapped[dict] = mapped_column(JSON, default=dict)  # {c1: 2.5, c2: 3.0, ...}
    overall_score: Mapped[float] = mapped_column(Float, default=0.0)
    points_earned: Mapped[int] = mapped_column(Integer, default=0)

    # Metrics
    total_latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    avg_response_latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    keyword_hits: Mapped[list] = mapped_column(JSON, default=list)
    feedback_summary: Mapped[Optional[str]] = mapped_column(Text)

    # Recording
    recording_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Supervisor review
    supervisor_stamp: Mapped[bool] = mapped_column(Boolean, default=False)
    supervisor_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))
    supervisor_notes: Mapped[Optional[str]] = mapped_column(Text)
    stamped_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship("User", back_populates="voice_sessions", foreign_keys=[user_id])
    scenario: Mapped["VoiceScenario"] = relationship("VoiceScenario", back_populates="sessions")


class DailyQuest(Base):
    """Personalized micro-learning assignment targeting red flags"""
    __tablename__ = "daily_quests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    target_competency: Mapped[str] = mapped_column(String(10))  # c1-c7
    task_type: Mapped[str] = mapped_column(String(50))  # quiz | voice_session
    task_id: Mapped[str] = mapped_column(String(36))  # quiz_id or scenario_id
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    assigned_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_daily_quests_user_date", "user_id", "assigned_date"),
    )
