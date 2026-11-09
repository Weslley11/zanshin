"""Avaliação, plano de 90 dias, vocabulário (FSRS), caderno de erros, registro de atividades e dashboard."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.content.languages import LANGUAGES
from app.db import utcnow
from app.deps import DB, CurrentUser, ProvidersDep, ai_rate_limit
from app.models import ActivityLog, Assessment, ErrorRecord, LearnerProfile, PlanDay
from app.services import assessment as assessment_service
from app.services import dashboard as dashboard_service
from app.services import drills
from app.services import plans as plan_service
from app.services import vocab as vocab_service

router = APIRouter(tags=["learning"])


async def _profile_or_400(db, user, language: str) -> LearnerProfile:
    p = (await db.execute(select(LearnerProfile).where(LearnerProfile.user_id == user.id,
                                                       LearnerProfile.language == language))).scalar_one_or_none()
    if p is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Configure seu perfil para este idioma primeiro.")
    return p


# ------------------------------- Avaliação -------------------------------
class StartAssessment(BaseModel):
    language: str = "en"
    kind: str = Field(default="placement", pattern="^(placement|checkpoint)$")


@router.post("/assessments", status_code=201)
async def start_assessment(body: StartAssessment, user: CurrentUser, db: DB) -> dict:
    try:
        a = await assessment_service.start(db, user, body.language, body.kind)
    except assessment_service.AssessmentUnavailable as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    await db.commit()
    return assessment_service.assessment_payload(a)


class SpeakingResponse(BaseModel):
    id: str
    transcript: str = Field(default="", max_length=6000)
    duration_seconds: float | None = Field(default=None, ge=0, le=600)


class SubmitAssessment(BaseModel):
    answers: dict[str, str | int | None] = Field(default_factory=dict)
    speaking: list[SpeakingResponse] = Field(default_factory=list)
    self_assessment: dict[str, bool] = Field(default_factory=dict)
    duration_seconds: int = Field(default=0, ge=0, le=14_400)


@router.post("/assessments/{assessment_id}/submit", dependencies=[Depends(ai_rate_limit)])
async def submit_assessment(assessment_id: uuid.UUID, body: SubmitAssessment, user: CurrentUser, db: DB,
                            providers: ProvidersDep) -> dict:
    a = (await db.execute(select(Assessment).where(Assessment.id == assessment_id, Assessment.user_id == user.id))).scalar_one_or_none()
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Avaliação não encontrada.")
    if a.completed_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Avaliação já enviada.")
    result = await assessment_service.submit(db, user, providers, a, body.model_dump())
    plan = await plan_service.current_plan(db, user, a.language)
    if plan is not None:
        profile = await _profile_or_400(db, user, a.language)
        result["plan_adaptation"] = await plan_service.adapt(db, user, plan, profile)
    await db.commit()
    return result


@router.get("/assessments")
async def list_assessments(user: CurrentUser, db: DB, language: str = "en") -> list[dict]:
    rows = (await db.execute(select(Assessment).where(Assessment.user_id == user.id, Assessment.language == language)
                             .order_by(Assessment.started_at.desc()))).scalars().all()
    return [{"id": str(a.id), "kind": a.kind, "started_at": a.started_at.isoformat(),
             "completed_at": a.completed_at.isoformat() if a.completed_at else None, "overall_cefr": a.overall_cefr,
             "scores": a.section_scores} for a in rows]


@router.get("/assessments/{assessment_id}")
async def get_assessment(assessment_id: uuid.UUID, user: CurrentUser, db: DB) -> dict:
    a = (await db.execute(select(Assessment).where(Assessment.id == assessment_id, Assessment.user_id == user.id))).scalar_one_or_none()
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Avaliação não encontrada.")
    payload = assessment_service.assessment_payload(a)
    if a.completed_at:
        payload["result"] = a.details | {"overall_cefr": a.overall_cefr}
    return payload


# ------------------------------- Plano -------------------------------
class CreatePlan(BaseModel):
    language: str = "en"


@router.post("/plans", status_code=201)
async def create_plan(body: CreatePlan, user: CurrentUser, db: DB) -> dict:
    profile = await _profile_or_400(db, user, body.language)
    plan = await plan_service.create_plan(db, user, profile)
    await db.commit()
    return plan_service.plan_view(plan, await plan_service.plan_days(db, plan), utcnow().date())


@router.get("/plans/current")
async def get_current_plan(user: CurrentUser, db: DB, language: str = "en") -> dict:
    plan = await plan_service.current_plan(db, user, language)
    if plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nenhum plano ativo.")
    return plan_service.plan_view(plan, await plan_service.plan_days(db, plan), utcnow().date())


@router.get("/plans/current/days/{day_index}")
async def get_plan_day(day_index: int, user: CurrentUser, db: DB, language: str = "en") -> dict:
    plan = await plan_service.current_plan(db, user, language)
    if plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nenhum plano ativo.")
    d = (await db.execute(select(PlanDay).where(PlanDay.plan_id == plan.id, PlanDay.day_index == day_index))).scalar_one_or_none()
    if d is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dia não encontrado.")
    return plan_service.day_view(d) | {"phase_info": plan.config["phases"][str(d.phase)] if str(d.phase) in plan.config["phases"]
                                       else plan.config["phases"].get(d.phase)}


@router.post("/plans/current/days/{day_index}/activities/{activity_id}/complete")
async def complete_activity(day_index: int, activity_id: str, user: CurrentUser, db: DB, language: str = "en") -> dict:
    plan = await plan_service.current_plan(db, user, language)
    if plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nenhum plano ativo.")
    d = await plan_service.complete_activity(db, plan, day_index, activity_id)
    if d is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Atividade não encontrada.")
    await db.commit()
    return plan_service.day_view(d)


@router.post("/plans/current/adapt")
async def adapt_plan(user: CurrentUser, db: DB, language: str = "en") -> dict:
    plan = await plan_service.current_plan(db, user, language)
    if plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nenhum plano ativo.")
    result = await plan_service.adapt(db, user, plan, await _profile_or_400(db, user, language))
    await db.commit()
    return result


# ------------------------------- Vocabulário -------------------------------
@router.get("/vocab/session")
async def vocab_session(user: CurrentUser, db: DB, language: str = "en", limit: int = 20) -> dict:
    if language not in LANGUAGES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Idioma não suportado.")
    result = await vocab_service.session_cards(db, user, language, min(max(limit, 1), 50))
    await db.commit()
    return result


class CheckIn(BaseModel):
    answer: str = Field(max_length=500)
    response_ms: int | None = Field(default=None, ge=0, le=600_000)


@router.post("/vocab/cards/{card_id}/check")
async def vocab_check(card_id: uuid.UUID, body: CheckIn, user: CurrentUser, db: DB) -> dict:
    card = await vocab_service.get_user_card(db, user, card_id)
    if card is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cartão não encontrado.")
    return vocab_service.check_answer(card, body.answer, body.response_ms)


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=4)
    response_ms: int | None = Field(default=None, ge=0, le=600_000)
    mode: str = Field(default="recall_text", pattern="^(recall_text|recall_speech|recognition)$")


@router.post("/vocab/cards/{card_id}/review")
async def vocab_review(card_id: uuid.UUID, body: ReviewIn, user: CurrentUser, db: DB) -> dict:
    card = await vocab_service.get_user_card(db, user, card_id)
    if card is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cartão não encontrado.")
    result = await vocab_service.review(db, user, card, body.rating, body.response_ms, body.mode)
    db.add(ActivityLog(user_id=user.id, language=card.language, activity_type="vocab_review",
                       duration_seconds=min((body.response_ms or 8000) // 1000 + 4, 120), score=1.0 if body.rating > 1 else 0.0,
                       skills=["vocabulary"], details={"card_id": str(card.id), "rating": body.rating}))
    await db.commit()
    return result


@router.get("/vocab/stats")
async def vocab_stats(user: CurrentUser, db: DB, language: str = "en") -> dict:
    return await vocab_service.stats(db, user, language)


class NewItem(BaseModel):
    language: str = "en"
    term: str = Field(min_length=1, max_length=200)
    meaning_pt: str = Field(min_length=1, max_length=500)
    example: str = Field(default="", max_length=300)
    kind: str = Field(default="phrase", max_length=30)


@router.post("/vocab/items", status_code=201)
async def add_item(body: NewItem, user: CurrentUser, db: DB) -> dict:
    card = await vocab_service.add_personal_item(db, user, language=body.language, term=body.term, meaning_pt=body.meaning_pt,
                                                 example=body.example, kind=body.kind)
    if card is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Você já tem este item.")
    await db.commit()
    await db.refresh(card, ["item"])
    return vocab_service.card_view(card)


# ------------------------------- Caderno de erros -------------------------------
@router.get("/errors")
async def list_errors(user: CurrentUser, db: DB, language: str = "en", include_resolved: bool = False) -> list[dict]:
    q = select(ErrorRecord).where(ErrorRecord.user_id == user.id, ErrorRecord.language == language)
    if not include_resolved:
        q = q.where(ErrorRecord.resolved.is_(False))
    rows = (await db.execute(q.order_by(ErrorRecord.occurrences.desc(), ErrorRecord.last_seen_at.desc()).limit(100))).scalars().all()
    return [{"id": str(e.id), "category": e.category, "subtype": e.subtype, "original": e.original, "corrected": e.corrected,
             "explanation_pt": e.explanation_pt, "severity": e.severity, "occurrences": e.occurrences,
             "correct_streak": e.correct_streak, "resolved": e.resolved} for e in rows]


@router.get("/errors/review")
async def error_review_set(user: CurrentUser, db: DB, language: str = "en", count: int = 5) -> list[dict]:
    """Revisão automática: prioriza erros frequentes e graves ainda não resolvidos."""
    rows = (await db.execute(select(ErrorRecord).where(ErrorRecord.user_id == user.id, ErrorRecord.language == language,
                                                       ErrorRecord.resolved.is_(False))
                             .order_by(ErrorRecord.occurrences.desc()).limit(30))).scalars().all()
    sev = {"blocks_understanding": 3, "may_confuse": 2, "minor": 1}
    rows = sorted(rows, key=lambda e: (-(sev.get(e.severity, 1) * e.occurrences), e.correct_streak))[:count]
    return [{"id": str(e.id), "prompt": e.original, "instruction_pt": "Reescreva a frase de forma correta e natural.",
             "hint_pt": e.explanation_pt, "subtype": e.subtype} for e in rows]


class RewriteIn(BaseModel):
    answer: str = Field(max_length=1000)


@router.post("/errors/{error_id}/attempt")
async def error_attempt(error_id: uuid.UUID, body: RewriteIn, user: CurrentUser, db: DB) -> dict:
    e = (await db.execute(select(ErrorRecord).where(ErrorRecord.id == error_id, ErrorRecord.user_id == user.id))).scalar_one_or_none()
    if e is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Erro não encontrado.")
    result = drills.check_error_rewrite(e.corrected, body.answer)
    e.correct_streak = e.correct_streak + 1 if result["correct"] else 0
    if e.correct_streak >= 3:
        e.resolved = True
    db.add(ActivityLog(user_id=user.id, language=e.language, activity_type="error_review", duration_seconds=30,
                       score=1.0 if result["correct"] else 0.0, skills=["grammar"], details={"error_id": str(e.id)}))
    await db.commit()
    return result | {"explanation_pt": e.explanation_pt, "correct_streak": e.correct_streak, "resolved": e.resolved}


# ------------------------------- Atividades & dashboard -------------------------------
class ActivityIn(BaseModel):
    language: str = "en"
    activity_type: str = Field(pattern="^(vocab_review|listening|shadowing|quick_response|sentence_building|think_in_english|conversation|scenario|error_review|assessment|reading|other)$")
    duration_seconds: int = Field(ge=0, le=14_400)
    score: float | None = Field(default=None, ge=0, le=1)
    details: dict = Field(default_factory=dict)
    plan_day: int | None = None
    plan_activity_id: str | None = Field(default=None, max_length=40)


@router.post("/activities", status_code=201)
async def log_activity(body: ActivityIn, user: CurrentUser, db: DB) -> dict:
    """Registra tempo de atividades feitas no cliente e (opcionalmente) marca a atividade do plano como concluída."""
    db.add(ActivityLog(user_id=user.id, language=body.language, activity_type=body.activity_type,
                       duration_seconds=body.duration_seconds, score=body.score, details=dict(list(body.details.items())[:20])))
    day = None
    if body.plan_day and body.plan_activity_id:
        plan = await plan_service.current_plan(db, user, body.language)
        if plan:
            d = await plan_service.complete_activity(db, plan, body.plan_day, body.plan_activity_id)
            day = plan_service.day_view(d) if d else None
    await db.commit()
    return {"ok": True, "plan_day": day}


@router.get("/dashboard")
async def dashboard(user: CurrentUser, db: DB, language: str = "en") -> dict:
    if language not in LANGUAGES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Idioma não suportado.")
    return await dashboard_service.build(db, user, language)
