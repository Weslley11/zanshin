from __future__ import annotations

import os
from datetime import date

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select

from app.content.languages import LANGUAGES
from app.db import utcnow
from app.deps import DB, CurrentUser
from app.models import (
    ActivityLog,
    Assessment,
    Consent,
    ConversationSession,
    ConversationTurn,
    Document,
    ErrorRecord,
    LearnerProfile,
    PlanDay,
    Recording,
    RefreshToken,
    ReviewLog,
    StudyPlan,
    UsageLedger,
    User,
    UserCard,
    VocabItem,
)
from app.routers.auth import CONSENT_KINDS
from app.security import verify_password
from app.services import usage
from app.services import vocab as vocab_service

router = APIRouter(prefix="/me", tags=["me"])


class MeOut(BaseModel):
    id: str
    email: str
    display_name: str
    ui_locale: str
    active_language: str
    consents: dict[str, bool]
    profiles: list[dict]


async def _consents(db, user: User) -> dict[str, bool]:
    rows = (await db.execute(select(Consent).where(Consent.user_id == user.id))).scalars().all()
    out = dict.fromkeys(CONSENT_KINDS, False)
    out.update({c.kind: c.granted for c in rows})
    return out


def profile_view(p: LearnerProfile) -> dict:
    return {"language": p.language, "cefr_estimate": p.cefr_estimate, "skill_scores": p.skill_scores,
            "daily_minutes": p.daily_minutes, "goals": p.goals, "focus_domains": p.focus_domains,
            "difficulties": p.difficulties, "trip_date": p.trip_date.isoformat() if p.trip_date else None,
            "preferred_accents": p.preferred_accents, "new_cards_per_day": p.new_cards_per_day}


@router.get("", response_model=MeOut)
async def me(user: CurrentUser, db: DB) -> MeOut:
    profiles = (await db.execute(select(LearnerProfile).where(LearnerProfile.user_id == user.id))).scalars().all()
    return MeOut(id=str(user.id), email=user.email, display_name=user.display_name, ui_locale=user.ui_locale,
                 active_language=user.active_language, consents=await _consents(db, user),
                 profiles=[profile_view(p) for p in profiles])


class MePatch(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)
    active_language: str | None = None


@router.patch("", response_model=MeOut)
async def update_me(body: MePatch, user: CurrentUser, db: DB) -> MeOut:
    if body.display_name is not None:
        user.display_name = body.display_name.strip()
    if body.active_language is not None:
        if body.active_language not in LANGUAGES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Idioma não suportado.")
        user.active_language = body.active_language
    await db.commit()
    return await me(user, db)


class ConsentsIn(BaseModel):
    consents: dict[str, bool]


@router.put("/consents")
async def set_consents(body: ConsentsIn, user: CurrentUser, db: DB) -> dict[str, bool]:
    for kind, granted in body.consents.items():
        if kind not in CONSENT_KINDS:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Consentimento desconhecido: {kind}")
        row = (await db.execute(select(Consent).where(Consent.user_id == user.id, Consent.kind == kind))).scalar_one_or_none()
        if row is None:
            db.add(Consent(user_id=user.id, kind=kind, granted=granted))
        else:
            row.granted = granted
    if body.consents.get("recording_storage") is False:  # revogação apaga gravações já guardadas
        await _delete_recordings(db, user)
    await db.commit()
    return await _consents(db, user)


class ProfileIn(BaseModel):
    daily_minutes: int = Field(default=45, ge=10, le=240)
    goals: list[str] = Field(default_factory=list, max_length=10)
    focus_domains: list[str] = Field(default_factory=list, max_length=10)
    difficulties: list[str] = Field(default_factory=list, max_length=10)
    trip_date: date | None = None
    preferred_accents: list[str] = Field(default_factory=list, max_length=5)
    new_cards_per_day: int = Field(default=12, ge=0, le=50)
    self_level: str | None = Field(default=None, pattern="^(A1|A2|B1|B2|C1|C2)$")


@router.put("/profiles/{language}")
async def upsert_profile(language: str, body: ProfileIn, user: CurrentUser, db: DB) -> dict:
    if language not in LANGUAGES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Idioma não suportado.")
    p = (await db.execute(select(LearnerProfile).where(LearnerProfile.user_id == user.id,
                                                       LearnerProfile.language == language))).scalar_one_or_none()
    created = p is None
    if p is None:
        p = LearnerProfile(user_id=user.id, language=language)
        db.add(p)
    p.daily_minutes, p.goals, p.focus_domains = body.daily_minutes, [g[:120] for g in body.goals], body.focus_domains
    p.difficulties, p.trip_date, p.preferred_accents = [d[:120] for d in body.difficulties], body.trip_date, body.preferred_accents
    p.new_cards_per_day = body.new_cards_per_day
    if body.self_level and not p.cefr_estimate:
        p.cefr_estimate = body.self_level  # autodeclarado até a primeira avaliação
    user.active_language = language
    await db.flush()
    if created:
        await vocab_service.enroll(db, user, language, body.focus_domains)
    await db.commit()
    return profile_view(p)


@router.get("/usage")
async def my_usage(user: CurrentUser, db: DB) -> dict:
    return await usage.usage_summary(db, user.id)


@router.get("/export")
async def export_data(user: CurrentUser, db: DB) -> dict:
    """Portabilidade (LGPD art. 18): todos os dados do usuário em JSON."""

    async def rows(model, *where):
        return [{c.name: _ser(getattr(r, c.name)) for c in model.__table__.columns if c.name != "password_hash"}
                for r in (await db.execute(select(model).where(*where))).scalars()]

    sessions = (await db.execute(select(ConversationSession.id).where(ConversationSession.user_id == user.id))).scalars().all()
    return {
        "exported_at": utcnow().isoformat(),
        "user": (await rows(User, User.id == user.id))[0],
        "consents": await rows(Consent, Consent.user_id == user.id),
        "profiles": await rows(LearnerProfile, LearnerProfile.user_id == user.id),
        "assessments": await rows(Assessment, Assessment.user_id == user.id),
        "plans": await rows(StudyPlan, StudyPlan.user_id == user.id),
        "cards": await rows(UserCard, UserCard.user_id == user.id),
        "review_logs": await rows(ReviewLog, ReviewLog.user_id == user.id),
        "personal_vocabulary": await rows(VocabItem, VocabItem.owner_user_id == user.id),
        "conversations": await rows(ConversationSession, ConversationSession.user_id == user.id),
        "conversation_turns": await rows(ConversationTurn, ConversationTurn.session_id.in_(sessions)) if sessions else [],
        "errors": await rows(ErrorRecord, ErrorRecord.user_id == user.id),
        "activities": await rows(ActivityLog, ActivityLog.user_id == user.id),
        "documents": await rows(Document, Document.user_id == user.id),
    }


def _ser(v):
    if hasattr(v, "isoformat"):
        return v.isoformat()
    if v is not None and type(v).__name__ == "UUID":
        return str(v)
    return v


async def _delete_recordings(db, user: User) -> None:
    recs = (await db.execute(select(Recording).where(Recording.user_id == user.id))).scalars().all()
    for r in recs:
        try:
            os.remove(r.path)
        except OSError:
            pass
    await db.execute(delete(Recording).where(Recording.user_id == user.id))


class DeleteIn(BaseModel):
    password: str = Field(max_length=128)


@router.post("/delete", status_code=204)
async def delete_account(body: DeleteIn, user: CurrentUser, db: DB) -> None:
    """Exclusão definitiva da conta e de todos os dados associados (cascade)."""
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Senha incorreta.")
    await _delete_recordings(db, user)
    sessions = select(ConversationSession.id).where(ConversationSession.user_id == user.id)
    await db.execute(delete(ConversationTurn).where(ConversationTurn.session_id.in_(sessions)))
    for model, col in ((ReviewLog, ReviewLog.user_id), (UserCard, UserCard.user_id), (VocabItem, VocabItem.owner_user_id),
                       (ConversationSession, ConversationSession.user_id), (ErrorRecord, ErrorRecord.user_id),
                       (ActivityLog, ActivityLog.user_id), (Document, Document.user_id), (Assessment, Assessment.user_id),
                       (LearnerProfile, LearnerProfile.user_id), (Consent, Consent.user_id),
                       (RefreshToken, RefreshToken.user_id), (UsageLedger, UsageLedger.user_id)):
        await db.execute(delete(model).where(col == user.id))
    plan_ids = select(StudyPlan.id).where(StudyPlan.user_id == user.id)
    await db.execute(delete(PlanDay).where(PlanDay.plan_id.in_(plan_ids)))
    await db.execute(delete(StudyPlan).where(StudyPlan.user_id == user.id))
    await db.execute(delete(User).where(User.id == user.id))
    await db.commit()
