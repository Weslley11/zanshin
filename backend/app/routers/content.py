"""Conteúdo e prática: idiomas, cenários, listening, drills 'Destravar a Fala' e shadowing."""

from __future__ import annotations

import random
import uuid
from datetime import timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from app.config import get_settings
from app.content.drills import QUICK_RESPONSE_EN, SENTENCE_BUILDING_EN, SHADOWING_EN, THINK_IN_ENGLISH_EN
from app.content.en_listening import LISTENING_EN
from app.content.languages import CEFR_LEVELS, LANGUAGES, public_language
from app.content.other_languages import (
    HIRAGANA_BASIC,
    KATAKANA_BASIC,
    QUICK_RESPONSE_OTHER,
    SHADOWING_OTHER,
    ZH_TONE_PAIRS,
)
from app.content.scenarios import SCENARIOS, get_scenario
from app.db import utcnow
from app.deps import DB, CurrentUser, ProvidersDep, ai_rate_limit, has_consent, require_consent
from app.models import ActivityLog, Recording
from app.services import drills, usage
from app.services.speech_metrics import shadowing_feedback

router = APIRouter(tags=["content"])


def _lang_or_404(language: str) -> None:
    if language not in LANGUAGES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Idioma não suportado.")


@router.get("/languages")
async def languages() -> list[dict]:
    return [public_language(c) for c in LANGUAGES]


@router.get("/languages/{language}")
async def language_detail(language: str) -> dict:
    _lang_or_404(language)
    extra: dict = {}
    if language == "ja":
        extra = {"hiragana": HIRAGANA_BASIC, "katakana": KATAKANA_BASIC}
    elif language == "zh":
        extra = {"tone_pairs": ZH_TONE_PAIRS}
    return public_language(language) | {"starter": extra}


# ------------------------------- Cenários -------------------------------
@router.get("/scenarios")
async def scenarios(category: str | None = None) -> list[dict]:
    keys = ("id", "category", "title_pt", "level", "phase", "domain", "minutes", "learner_role")
    return [{k: s[k] for k in keys} | {"goals": s["goals"], "characters": s["characters"]}
            for s in SCENARIOS if category is None or s["category"] == category]


@router.get("/scenarios/{scenario_id}")
async def scenario(scenario_id: str) -> dict:
    s = get_scenario(scenario_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cenário não encontrado.")
    return {k: v for k, v in s.items() if k not in ("script",)}


# ------------------------------- Listening -------------------------------
def _listening_public(x: dict, with_text: bool = True) -> dict:
    out = {k: x[k] for k in ("id", "title", "level", "domain", "phase", "accents")}
    if with_text:
        # As falas vão ao cliente para síntese de voz; a interface só mostra a transcrição após a resposta.
        out["lines"] = x["lines"]
        out["questions"] = [{k: v for k, v in q.items() if k not in ("answer", "accepted")} for q in x["questions"]]
        out["dictation_count"] = len(x.get("dictation", []))
        out["dictation"] = x.get("dictation", [])
        out["structure_tip_pt"] = x.get("structure_tip_pt")
    return out


@router.get("/listening")
async def listening_list(language: str = "en", level: str | None = None) -> list[dict]:
    if language != "en":
        return []
    return [_listening_public(x, with_text=False) for x in LISTENING_EN if level is None or x["level"] == level]


@router.get("/listening/{exercise_id}")
async def listening_get(exercise_id: str) -> dict:
    x = next((e for e in LISTENING_EN if e["id"] == exercise_id), None)
    if x is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercício não encontrado.")
    return _listening_public(x)


class ListeningSubmit(BaseModel):
    answers: dict[str, str | int | None]
    duration_seconds: int = Field(default=0, ge=0, le=7200)
    speed: float = Field(default=1.0, ge=0.5, le=1.5)
    plays: int = Field(default=1, ge=0, le=100)


@router.post("/listening/{exercise_id}/submit")
async def listening_submit(exercise_id: str, body: ListeningSubmit, user: CurrentUser, db: DB) -> dict:
    x = next((e for e in LISTENING_EN if e["id"] == exercise_id), None)
    if x is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercício não encontrado.")
    result = drills.score_listening(x, {k: v for k, v in body.answers.items() if v is not None})
    db.add(ActivityLog(user_id=user.id, language="en", activity_type="listening", duration_seconds=body.duration_seconds,
                       score=result["score"], skills=["listening"],
                       details={"exercise_id": exercise_id, "speed": body.speed, "plays": body.plays, "level": x["level"]}))
    await db.commit()
    return result


# ------------------------------- Destravar a Fala -------------------------------
def _qr_pool(language: str) -> list[dict]:
    return QUICK_RESPONSE_EN if language == "en" else QUICK_RESPONSE_OTHER.get(language, [])


@router.get("/drills/quick-response")
async def quick_response_set(language: str = "en", level: str = "B1", count: int = 8) -> dict:
    _lang_or_404(language)
    pool = _qr_pool(language)
    lvl_idx = CEFR_LEVELS.index(level) if level in CEFR_LEVELS else 2
    near = [q for q in pool if abs(CEFR_LEVELS.index(q["level"]) - lvl_idx) <= 1] or pool
    picks = random.sample(near, k=min(count, len(near)))
    start_ms = {0: 10000, 1: 9000, 2: 8000, 3: 6500, 4: 5500, 5: 5000}[lvl_idx]
    return {"questions": [{k: q[k] for k in ("id", "level", "theme", "q")} for q in picks], "initial_time_limit_ms": start_ms,
            "instructions_pt": "Ouça a pergunta e comece a responder antes do tempo acabar. Frases curtas valem!"}


class QuickResponseIn(BaseModel):
    question_id: str
    answer: str = Field(max_length=1000)
    latency_ms: int = Field(ge=0, le=120_000)
    time_limit_ms: int = Field(ge=1000, le=60_000)
    language: str = "en"


@router.post("/drills/quick-response/evaluate", dependencies=[Depends(ai_rate_limit)])
async def quick_response_eval(body: QuickResponseIn, user: CurrentUser, db: DB, providers: ProvidersDep) -> dict:
    q = next((x for x in _qr_pool(body.language) if x["id"] == body.question_id), None)
    if q is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pergunta não encontrada.")
    if providers.llm.is_generative:
        await usage.ensure_budget(db, user.id, "llm_tokens")
    result, llm_res = await drills.evaluate_quick_response(providers, language=body.language, question=q, answer=body.answer,
                                                           latency_ms=body.latency_ms, time_limit_ms=body.time_limit_ms)
    if llm_res is not None:
        await usage.record_llm(db, user.id, llm_res.provider, llm_res.usage, "quick_response")
    db.add(ActivityLog(user_id=user.id, language=body.language, activity_type="quick_response",
                       duration_seconds=max(1, body.latency_ms // 1000) + 3, score=1.0 if result["success"] else 0.0,
                       skills=["fluency", "speaking"], details={"question_id": q["id"], "latency_ms": body.latency_ms}))
    await db.commit()
    return result


@router.get("/drills/sentence-building")
async def sentence_building(level: str | None = None) -> list[dict]:
    return [{k: v for k, v in x.items() if k not in ("answer",)} | ({"shuffled": random.sample(x["chunks"], len(x["chunks"]))}
            if x["stage"] == "order" else {}) for x in SENTENCE_BUILDING_EN if level is None or x["level"] == level]


class SentenceIn(BaseModel):
    item_id: str
    answer: str = Field(max_length=1000)
    duration_seconds: int = Field(default=0, ge=0, le=3600)


@router.post("/drills/sentence-building/evaluate")
async def sentence_building_eval(body: SentenceIn, user: CurrentUser, db: DB) -> dict:
    item = next((x for x in SENTENCE_BUILDING_EN if x["id"] == body.item_id), None)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercício não encontrado.")
    result = drills.evaluate_sentence_building(item, body.answer)
    db.add(ActivityLog(user_id=user.id, language="en", activity_type="sentence_building", duration_seconds=body.duration_seconds,
                       score=1.0 if result["correct"] else 0.0, skills=["grammar", "speaking"], details={"item_id": item["id"]}))
    await db.commit()
    return result


@router.get("/drills/think-in-english")
async def think_in_english(level: str | None = None) -> list[dict]:
    return [x for x in THINK_IN_ENGLISH_EN if level is None or x["level"] == level]


# ------------------------------- Shadowing -------------------------------
@router.get("/shadowing")
async def shadowing_list(language: str = "en", level: str | None = None) -> list[dict]:
    pool = SHADOWING_EN if language == "en" else SHADOWING_OTHER.get(language, [])
    return [x for x in pool if level is None or x["level"] == level]


def _shadow_item(item_id: str) -> tuple[dict, str] | None:
    for lang, pool in [("en", SHADOWING_EN), *SHADOWING_OTHER.items()]:
        for x in pool:
            if x["id"] == item_id:
                return x, lang
    return None


@router.post("/shadowing/{item_id}/attempt", dependencies=[Depends(ai_rate_limit)])
async def shadowing_attempt(
    item_id: str, user: CurrentUser, db: DB, providers: ProvidersDep,
    audio: UploadFile | None = File(default=None),
    transcript: str | None = Form(default=None, max_length=1000),
    duration_seconds: float | None = Form(default=None, ge=0, le=120),
    rate: float = Form(default=1.0, ge=0.5, le=1.5),
) -> dict:
    """Aceita áudio (STT/avaliação no servidor) ou transcrição feita no próprio dispositivo."""
    found = _shadow_item(item_id)
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Frase não encontrada.")
    item, lang = found
    words, confidence, pron = [], None, None
    if audio is not None:
        await require_consent(db, user, "voice_processing")
        if providers.stt is None and providers.pronunciation is None:
            raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED,
                                {"code": "stt_not_configured",
                                 "message": "Reconhecimento de voz no servidor não está configurado. Use a transcrição do dispositivo."})
        data = await audio.read()
        if len(data) > get_settings().max_upload_audio_mb * 1024 * 1024:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Áudio muito grande.")
        mime = audio.content_type or "audio/mp4"
        await usage.ensure_budget(db, user.id, "stt_seconds")
        if providers.pronunciation is not None:
            pron = await providers.pronunciation.assess(data, mime_type=mime, language=lang, reference_text=item["text"])
            transcript = pron.recognized_text
        if providers.stt is not None:
            t = await providers.stt.transcribe(data, mime_type=mime, language=lang, prompt=item["text"])
            transcript = transcript or t.text
            words, confidence, duration_seconds = t.words, t.confidence, t.duration_seconds or duration_seconds
            await usage.record_stt(db, user.id, t.provider, t.duration_seconds, "shadowing")
        await _maybe_store_recording(db, user, data, "shadowing")
    if transcript is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Envie o áudio ou a transcrição.")
    fb = shadowing_feedback(reference=item["text"], transcript=transcript, duration=duration_seconds or 0.0, words=words,
                            stt_confidence=confidence, rate=rate, pronunciation=pron)
    fb["item"] = item
    score = (fb["intelligibility"] / 100) if fb["status"] == "ok" else None
    db.add(ActivityLog(user_id=user.id, language=lang, activity_type="shadowing", duration_seconds=int((duration_seconds or 0) * 2) + 5,
                       score=score, skills=["pronunciation", "fluency"],
                       details={"item_id": item_id, "status": fb["status"], "method": fb["method"]}))
    await db.commit()
    return fb


async def _maybe_store_recording(db, user, data: bytes, purpose: str) -> None:
    """Persiste o áudio apenas com consentimento explícito e com prazo de expiração."""
    if not await has_consent(db, user, "recording_storage"):
        return
    s = get_settings()
    folder = Path(s.storage_dir) / "recordings" / str(user.id)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{uuid.uuid4()}.bin"
    path.write_bytes(data)
    db.add(Recording(user_id=user.id, path=str(path), purpose=purpose,
                     expires_at=utcnow() + timedelta(days=s.recording_retention_days)))
