from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.config import get_settings
from app.deps import DB, CurrentUser, ProvidersDep, ai_rate_limit, require_consent
from app.models import ConversationSession
from app.routers.content import _maybe_store_recording
from app.services import tutor as tutor_service
from app.services import usage
from app.services.speech_metrics import fluency_metrics

router = APIRouter(prefix="/tutor", tags=["tutor"])


class SessionSettings(BaseModel):
    speed: str = Field(default="normal", pattern="^(slow|normal|fast)$")
    accent: str | None = Field(default=None, max_length=10)
    level: str | None = Field(default=None, pattern="^(A1|A2|B1|B2|C1|C2)$")
    challenge_minutes: int | None = Field(default=None, ge=1, le=60)
    plan_day: int | None = None
    plan_activity_id: str | None = None


class StartIn(BaseModel):
    language: str = "en"
    mode: str = "natural"
    scenario_id: str | None = None
    settings: SessionSettings = Field(default_factory=SessionSettings)


def _session_view(s: ConversationSession, turns) -> dict:
    return {"id": str(s.id), "language": s.language, "mode": s.mode, "scenario_id": s.scenario_id, "title": s.title,
            "settings": s.settings, "engine": s.provider, "started_at": s.started_at.isoformat(),
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "turns": [{"role": t.role, "text": t.text, "corrections": t.corrections if s.mode == "immediate" or s.ended_at else [],
                       "created_at": t.created_at.isoformat()} for t in turns],
            "report": s.report, "goals_achieved": s.state.get("goals_achieved", [])}


async def _get_session(db, user, session_id: uuid.UUID) -> ConversationSession:
    s = (await db.execute(select(ConversationSession).where(ConversationSession.id == session_id,
                                                            ConversationSession.user_id == user.id))).scalar_one_or_none()
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sessão não encontrada.")
    return s


@router.post("/sessions", status_code=201, dependencies=[Depends(ai_rate_limit)])
async def start(body: StartIn, user: CurrentUser, db: DB, providers: ProvidersDep) -> dict:
    if providers.llm.is_generative:
        await require_consent(db, user, "ai_processing")
    try:
        s = await tutor_service.start_session(db, user, providers, language=body.language, mode=body.mode,
                                              scenario_id=body.scenario_id, settings=body.settings.model_dump(exclude_none=True))
    except tutor_service.TutorError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    await db.commit()
    return _session_view(s, await tutor_service.load_turns(db, s))


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    latency_ms: int | None = Field(default=None, ge=0, le=600_000)
    source: str = Field(default="text", pattern="^(text|voice|device_stt)$")
    audio_seconds: float | None = Field(default=None, ge=0, le=600)


@router.post("/sessions/{session_id}/messages", dependencies=[Depends(ai_rate_limit)])
async def message(session_id: uuid.UUID, body: MessageIn, user: CurrentUser, db: DB, providers: ProvidersDep) -> dict:
    s = await _get_session(db, user, session_id)
    meta = {"source": body.source, "latency_ms": body.latency_ms, "audio_seconds": body.audio_seconds}
    try:
        result = await tutor_service.post_message(db, user, providers, s, body.text, {k: v for k, v in meta.items() if v is not None})
    except tutor_service.TutorError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    await db.commit()
    return result


@router.post("/sessions/{session_id}/audio", dependencies=[Depends(ai_rate_limit)])
async def audio_message(
    session_id: uuid.UUID, user: CurrentUser, db: DB, providers: ProvidersDep,
    audio: UploadFile = File(...), latency_ms: int | None = Form(default=None, ge=0, le=600_000),
) -> dict:
    """Pipeline de voz: áudio → STT → tutor. A resposta é falada no dispositivo (ou via /speech/tts)."""
    await require_consent(db, user, "voice_processing")
    if providers.stt is None:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED,
                            {"code": "stt_not_configured", "message": "Reconhecimento de voz no servidor não configurado."})
    s = await _get_session(db, user, session_id)
    data = await audio.read()
    if len(data) > get_settings().max_upload_audio_mb * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Áudio muito grande.")
    await usage.ensure_budget(db, user.id, "stt_seconds")
    t = await providers.stt.transcribe(data, mime_type=audio.content_type or "audio/mp4", language=s.language)
    await usage.record_stt(db, user.id, t.provider, t.duration_seconds, "tutor_audio")
    await _maybe_store_recording(db, user, data, "conversation")
    if not t.text.strip() or (t.confidence is not None and t.confidence < 0.35):
        await db.commit()
        return {"status": "unclear", "transcript": t.text,
                "message_pt": "Não consegui entender o áudio. Tente de novo, mais perto do microfone e em um lugar silencioso."}
    meta = {"source": "voice", "latency_ms": latency_ms, "audio_seconds": t.duration_seconds, "stt_confidence": t.confidence,
            "fluency": fluency_metrics(t.words, t.duration_seconds, t.text)}
    try:
        result = await tutor_service.post_message(db, user, providers, s, t.text, {k: v for k, v in meta.items() if v is not None})
    except tutor_service.TutorError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    await db.commit()
    return {"status": "ok", "transcript": t.text, "fluency": meta["fluency"]} | result


@router.post("/sessions/{session_id}/end")
async def end(session_id: uuid.UUID, user: CurrentUser, db: DB, providers: ProvidersDep) -> dict:
    s = await _get_session(db, user, session_id)
    report = await tutor_service.end_session(db, user, providers, s)
    if s.settings.get("plan_day") and s.settings.get("plan_activity_id"):
        from app.services import plans as plan_service

        plan = await plan_service.current_plan(db, user, s.language)
        if plan:
            await plan_service.complete_activity(db, plan, s.settings["plan_day"], s.settings["plan_activity_id"])
    await db.commit()
    return report


@router.get("/sessions")
async def history(user: CurrentUser, db: DB, language: str = "en") -> list[dict]:
    rows = await tutor_service.recent_sessions(db, user, language)
    return [{"id": str(s.id), "title": s.title, "mode": s.mode, "started_at": s.started_at.isoformat(),
             "ended_at": s.ended_at.isoformat() if s.ended_at else None, "metrics": s.metrics, "engine": s.provider}
            for s in rows]


@router.get("/sessions/{session_id}")
async def get_session(session_id: uuid.UUID, user: CurrentUser, db: DB) -> dict:
    s = await _get_session(db, user, session_id)
    return _session_view(s, await tutor_service.load_turns(db, s))


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: uuid.UUID, user: CurrentUser, db: DB) -> None:
    s = await _get_session(db, user, session_id)
    await db.delete(s)
    await db.commit()
