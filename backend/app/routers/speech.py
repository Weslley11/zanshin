from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from pydantic import BaseModel, Field

from app.config import get_settings
from app.content.languages import LANGUAGES
from app.deps import DB, CurrentUser, ProvidersDep, ai_rate_limit, require_consent
from app.services import usage
from app.services.speech_metrics import fluency_metrics

router = APIRouter(tags=["speech"])


@router.get("/system/capabilities")
async def capabilities(request: Request) -> dict:
    """O que está REALMENTE operacional neste servidor (o app adapta a interface a isto)."""
    caps = request.app.state.providers.capabilities()
    s = get_settings()
    caps["limits"] = {"daily_llm_tokens_per_user": s.daily_llm_tokens_per_user,
                      "daily_stt_seconds_per_user": s.daily_stt_seconds_per_user}
    caps["notes_pt"] = []
    if not caps["llm"]["generative"]:
        caps["notes_pt"].append("Tutor em modo offline (sem IA generativa): roteiros e correções por regras. "
                                "Configure LLM_PROVIDER para conversas abertas e relatórios completos.")
    if not caps["stt"]["available"]:
        caps["notes_pt"].append("Sem reconhecimento de voz no servidor: o app usa o reconhecimento do dispositivo/navegador "
                                "quando disponível, ou entrada por texto.")
    return caps


@router.post("/speech/transcribe", dependencies=[Depends(ai_rate_limit)])
async def transcribe(user: CurrentUser, db: DB, providers: ProvidersDep, language: str = "en",
                     audio: UploadFile = File(...)) -> dict:
    await require_consent(db, user, "voice_processing")
    if providers.stt is None:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED,
                            {"code": "stt_not_configured", "message": "Reconhecimento de voz no servidor não configurado."})
    if language not in LANGUAGES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Idioma não suportado.")
    data = await audio.read()
    if len(data) > get_settings().max_upload_audio_mb * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Áudio muito grande.")
    await usage.ensure_budget(db, user.id, "stt_seconds")
    t = await providers.stt.transcribe(data, mime_type=audio.content_type or "audio/mp4", language=language)
    await usage.record_stt(db, user.id, t.provider, t.duration_seconds, "transcribe")
    await db.commit()
    return {"text": t.text, "duration_seconds": t.duration_seconds, "confidence": t.confidence,
            "fluency": fluency_metrics(t.words, t.duration_seconds, t.text)}


class TTSIn(BaseModel):
    text: str = Field(min_length=1, max_length=3000)
    language: str = "en"
    accent: str | None = Field(default=None, max_length=10)
    speed: float = Field(default=1.0, ge=0.5, le=1.5)


@router.post("/speech/tts", dependencies=[Depends(ai_rate_limit)])
async def tts(body: TTSIn, user: CurrentUser, db: DB, providers: ProvidersDep) -> Response:
    if providers.tts is None:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED,
                            {"code": "tts_device", "message": "Síntese de voz no servidor não configurada; use a voz do dispositivo."})
    await usage.ensure_budget(db, user.id, "tts_chars")
    audio, mime = await providers.tts.synthesize(body.text, language=body.language, accent=body.accent, speed=body.speed)
    await usage.record_tts(db, user.id, providers.tts.name, len(body.text), "tts")
    await db.commit()
    return Response(content=audio, media_type=mime, headers={"Cache-Control": "private, max-age=86400"})


@router.get("/speech/tts", dependencies=[Depends(ai_rate_limit)])
async def tts_get(user: CurrentUser, db: DB, providers: ProvidersDep, text: str = Query(min_length=1, max_length=500),
                  language: str = "en", accent: str | None = Query(default=None, max_length=10),
                  speed: float = Query(default=1.0, ge=0.5, le=1.5)) -> Response:
    """Variante GET (usada diretamente como fonte de áudio pelo player do app, com cabeçalho Authorization)."""
    return await tts(TTSIn(text=text, language=language, accent=accent, speed=speed), user, db, providers)
