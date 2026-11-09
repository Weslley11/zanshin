"""Modelo de dados (SQLAlchemy 2.0). Compatível com PostgreSQL (produção) e SQLite (testes)."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, JSONType, UTCDateTime, utcnow


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(120), default="")
    ui_locale: Mapped[str] = mapped_column(String(10), default="pt-BR")
    active_language: Mapped[str] = mapped_column(String(5), default="en")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    profiles: Mapped[list[LearnerProfile]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )


class RefreshToken(Base):
    """Refresh tokens opacos, armazenados apenas como hash. Rotação com detecção de reuso por família."""

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    family_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    user_agent: Mapped[str] = mapped_column(String(255), default="")


class Consent(Base):
    __tablename__ = "consents"
    __table_args__ = (UniqueConstraint("user_id", "kind"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # voice_processing | recording_storage | document_processing | ai_processing
    kind: Mapped[str] = mapped_column(String(40))
    granted: Mapped[bool] = mapped_column(Boolean, default=False)
    policy_version: Mapped[str] = mapped_column(String(20), default="2026-11")
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class LearnerProfile(Base):
    __tablename__ = "learner_profiles"
    __table_args__ = (UniqueConstraint("user_id", "language"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    language: Mapped[str] = mapped_column(String(5))
    cefr_estimate: Mapped[str | None] = mapped_column(String(3), nullable=True)
    # 0-100 por competência: listening, speaking, vocabulary, grammar, reading, pronunciation, fluency, interaction
    skill_scores: Mapped[dict] = mapped_column(JSONType, default=dict)
    self_assessment: Mapped[dict] = mapped_column(JSONType, default=dict)
    daily_minutes: Mapped[int] = mapped_column(Integer, default=45)
    goals: Mapped[list] = mapped_column(JSONType, default=list)
    focus_domains: Mapped[list] = mapped_column(JSONType, default=list)
    difficulties: Mapped[list] = mapped_column(JSONType, default=list)
    trip_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    preferred_accents: Mapped[list] = mapped_column(JSONType, default=list)
    new_cards_per_day: Mapped[int] = mapped_column(Integer, default=12)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship(back_populates="profiles")


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    language: Mapped[str] = mapped_column(String(5))
    kind: Mapped[str] = mapped_column(String(20))  # placement | checkpoint
    item_ids: Mapped[list] = mapped_column(JSONType, default=list)
    responses: Mapped[dict] = mapped_column(JSONType, default=dict)
    section_scores: Mapped[dict] = mapped_column(JSONType, default=dict)
    cefr_by_skill: Mapped[dict] = mapped_column(JSONType, default=dict)
    overall_cefr: Mapped[str | None] = mapped_column(String(3), nullable=True)
    details: Mapped[dict] = mapped_column(JSONType, default=dict)
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)


class StudyPlan(Base):
    __tablename__ = "study_plans"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    language: Mapped[str] = mapped_column(String(5))
    title: Mapped[str] = mapped_column(String(200))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    total_days: Mapped[int] = mapped_column(Integer)
    daily_minutes: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | archived
    config: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    last_adapted_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    days: Mapped[list[PlanDay]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="PlanDay.day_index"
    )


class PlanDay(Base):
    __tablename__ = "plan_days"
    __table_args__ = (UniqueConstraint("plan_id", "day_index"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("study_plans.id", ondelete="CASCADE"), index=True)
    day_index: Mapped[int] = mapped_column(Integer)
    date: Mapped[date] = mapped_column(Date)
    phase: Mapped[int] = mapped_column(Integer)
    focus: Mapped[str] = mapped_column(String(200))
    activities: Mapped[list] = mapped_column(JSONType, default=list)
    is_assessment_day: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    plan: Mapped[StudyPlan] = relationship(back_populates="days")


class VocabItem(Base):
    __tablename__ = "vocab_items"
    __table_args__ = (Index("ix_vocab_lang_kind", "language", "kind"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    language: Mapped[str] = mapped_column(String(5), index=True)
    term: Mapped[str] = mapped_column(String(200))
    # word | phrase | phrasal_verb | collocation | idiom | technical | corporate | travel | correction | ...
    kind: Mapped[str] = mapped_column(String(30))
    meaning_pt: Mapped[str] = mapped_column(Text)
    definition: Mapped[str] = mapped_column(Text, default="")
    pronunciation: Mapped[str] = mapped_column(String(200), default="")
    examples: Mapped[list] = mapped_column(JSONType, default=list)
    tags: Mapped[list] = mapped_column(JSONType, default=list)
    domain: Mapped[str] = mapped_column(String(40), default="general")
    cefr: Mapped[str] = mapped_column(String(3), default="B1")
    frequency_rank: Mapped[int] = mapped_column(Integer, default=5000)
    source: Mapped[str] = mapped_column(String(20), default="seed")  # seed | user | document | tutor | error
    seed_key: Mapped[str | None] = mapped_column(String(120), unique=True, nullable=True)
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class UserCard(Base):
    """Estado FSRS de um item para um usuário."""

    __tablename__ = "user_cards"
    __table_args__ = (
        UniqueConstraint("user_id", "vocab_item_id"),
        Index("ix_cards_user_due", "user_id", "due"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    vocab_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vocab_items.id", ondelete="CASCADE"))
    language: Mapped[str] = mapped_column(String(5))
    state: Mapped[str] = mapped_column(String(12), default="new")  # new | learning | review | relearning
    step: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stability: Mapped[float | None] = mapped_column(Float, nullable=True)
    difficulty: Mapped[float | None] = mapped_column(Float, nullable=True)
    due: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    last_review: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    reps: Mapped[int] = mapped_column(Integer, default=0)
    lapses: Mapped[int] = mapped_column(Integer, default=0)
    priority: Mapped[int] = mapped_column(Integer, default=0)  # maior = introduzir antes
    introduced_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    item: Mapped[VocabItem] = relationship()


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    card_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user_cards.id", ondelete="CASCADE"), index=True)
    rating: Mapped[int] = mapped_column(Integer)
    state_before: Mapped[str] = mapped_column(String(12))
    retrievability: Mapped[float | None] = mapped_column(Float, nullable=True)
    scheduled_days: Mapped[float] = mapped_column(Float, default=0)
    response_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mode: Mapped[str] = mapped_column(String(20), default="recall_text")
    reviewed_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class ConversationSession(Base):
    __tablename__ = "conversation_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    language: Mapped[str] = mapped_column(String(5))
    # natural | immediate | no_native | quick_response | scenario | challenge
    mode: Mapped[str] = mapped_column(String(20))
    scenario_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    title: Mapped[str] = mapped_column(String(200), default="")
    settings: Mapped[dict] = mapped_column(JSONType, default=dict)
    state: Mapped[dict] = mapped_column(JSONType, default=dict)
    report: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    metrics: Mapped[dict] = mapped_column(JSONType, default=dict)
    provider: Mapped[str] = mapped_column(String(40), default="offline")
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    turns: Mapped[list[ConversationTurn]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="ConversationTurn.seq"
    )


class ConversationTurn(Base):
    __tablename__ = "conversation_turns"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversation_sessions.id", ondelete="CASCADE"), index=True
    )
    seq: Mapped[int] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(String(12))  # user | assistant
    text: Mapped[str] = mapped_column(Text)
    corrections: Mapped[list] = mapped_column(JSONType, default=list)
    meta: Mapped[dict] = mapped_column(JSONType, default=dict)  # latência, confiança STT, duração do áudio...
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    session: Mapped[ConversationSession] = relationship(back_populates="turns")


class ErrorRecord(Base):
    """Caderno de erros: alimenta revisões automáticas e o motor adaptativo."""

    __tablename__ = "error_records"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    language: Mapped[str] = mapped_column(String(5))
    category: Mapped[str] = mapped_column(String(30))  # grammar | vocabulary | word_choice | pronunciation | false_friend
    subtype: Mapped[str] = mapped_column(String(60), default="")
    original: Mapped[str] = mapped_column(Text)
    corrected: Mapped[str] = mapped_column(Text)
    explanation_pt: Mapped[str] = mapped_column(Text, default="")
    severity: Mapped[str] = mapped_column(String(20), default="minor")  # minor | may_confuse | blocks_understanding
    source: Mapped[str] = mapped_column(String(30), default="tutor")
    source_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    occurrences: Mapped[int] = mapped_column(Integer, default=1)
    correct_streak: Mapped[int] = mapped_column(Integer, default=0)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    __table_args__ = (Index("ix_activity_user_started", "user_id", "started_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    language: Mapped[str] = mapped_column(String(5))
    activity_type: Mapped[str] = mapped_column(String(30))
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)  # 0..1
    skills: Mapped[list] = mapped_column(JSONType, default=list)
    details: Mapped[dict] = mapped_column(JSONType, default=dict)
    plan_day_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)


class Document(Base):
    """Documento técnico enviado pelo usuário. Armazenamos apenas o texto JÁ REDIGIDO."""

    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    language: Mapped[str] = mapped_column(String(5), default="en")
    status: Mapped[str] = mapped_column(String(20), default="ready")  # ready | generated
    redacted_text: Mapped[str] = mapped_column(Text)
    report: Mapped[dict] = mapped_column(JSONType, default=dict)
    generated: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    authorized_by_user: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Recording(Base):
    """Gravações só são persistidas com consentimento explícito e por tempo limitado."""

    __tablename__ = "recordings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    path: Mapped[str] = mapped_column(String(500))
    purpose: Mapped[str] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)


class UsageLedger(Base):
    __tablename__ = "usage_ledger"
    __table_args__ = (Index("ix_usage_user_day", "user_id", "day"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    provider: Mapped[str] = mapped_column(String(40))
    kind: Mapped[str] = mapped_column(String(20))  # llm_tokens | stt_seconds | tts_chars
    amount: Mapped[float] = mapped_column(Float, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0)
    purpose: Mapped[str] = mapped_column(String(40), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
