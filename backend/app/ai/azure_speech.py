"""Azure AI Speech (REST): reconhecimento de fala, avaliação de pronúncia e síntese neural.

A avaliação de pronúncia do Azure fornece notas de acurácia, fluência, completude e prosódia
por palavra/fonema — é o caminho recomendado para feedback de pronúncia confiável.
Requer AZURE_SPEECH_KEY e AZURE_SPEECH_REGION (serviço pago; há camada gratuita limitada).
"""

from __future__ import annotations

import base64
import json
from xml.sax.saxutils import escape

import httpx

from app.ai.audio import to_wav_pcm16k, wav_duration_seconds
from app.ai.base import AIError, PronunciationResult, Transcript, WordTiming

_TICKS = 10_000_000  # Azure usa unidades de 100 ns


def _stt_url(region: str, locale: str) -> str:
    return (f"https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1"
            f"?language={locale}&format=detailed&wordLevelTimestamps=true")


async def _recognize(key: str, region: str, wav: bytes, locale: str, extra_headers: dict | None = None) -> dict:
    headers = {"Ocp-Apim-Subscription-Key": key, "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
               "Accept": "application/json"}
    headers.update(extra_headers or {})
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(_stt_url(region, locale), content=wav, headers=headers)
    except httpx.HTTPError as e:
        raise AIError("Sem conexão com o Azure Speech.", retryable=True, code="provider_unreachable") from e
    if resp.status_code in (401, 403):
        raise AIError("Credencial do Azure Speech inválida.", code="provider_auth")
    if resp.status_code == 429:
        raise AIError("Limite do Azure Speech atingido.", retryable=True, code="rate_limited")
    if resp.status_code >= 400:
        raise AIError("O Azure Speech rejeitou o áudio.", code="provider_bad_request")
    return resp.json()


class AzureSTT:
    name = "azure"

    def __init__(self, *, key: str, region: str, locales: dict[str, str]) -> None:
        self._key, self._region, self._locales = key, region, locales

    async def transcribe(self, audio: bytes, *, mime_type: str, language: str, prompt: str | None = None) -> Transcript:
        wav = await to_wav_pcm16k(audio, mime_type)
        p = await _recognize(self._key, self._region, wav, self._locales.get(language, language))
        if p.get("RecognitionStatus") != "Success" or not p.get("NBest"):
            return Transcript(text="", language=language, duration_seconds=wav_duration_seconds(wav), provider=self.name, confidence=0.0)
        best = p["NBest"][0]
        words = [WordTiming(w["Word"], w["Offset"] / _TICKS, (w["Offset"] + w["Duration"]) / _TICKS, w.get("Confidence"))
                 for w in best.get("Words", [])]
        return Transcript(text=best.get("Display", best.get("Lexical", "")), language=language,
                          duration_seconds=wav_duration_seconds(wav), words=words,
                          confidence=best.get("Confidence"), provider=self.name)


class AzurePronunciation:
    name = "azure"

    def __init__(self, *, key: str, region: str, locales: dict[str, str]) -> None:
        self._key, self._region, self._locales = key, region, locales

    async def assess(self, audio: bytes, *, mime_type: str, language: str, reference_text: str) -> PronunciationResult:
        wav = await to_wav_pcm16k(audio, mime_type)
        cfg = {"ReferenceText": reference_text, "GradingSystem": "HundredMark", "Granularity": "Phoneme",
               "Dimension": "Comprehensive", "EnableProsodyAssessment": "True"}
        header = base64.b64encode(json.dumps(cfg).encode()).decode()
        p = await _recognize(self._key, self._region, wav, self._locales.get(language, language),
                             {"Pronunciation-Assessment": header})
        if p.get("RecognitionStatus") != "Success" or not p.get("NBest"):
            return PronunciationResult(None, None, None, None, None, provider=self.name)
        best = p["NBest"][0]
        pa = best.get("PronunciationAssessment", best)
        words = [
            {"word": w["Word"],
             "accuracy": (w.get("PronunciationAssessment") or {}).get("AccuracyScore"),
             "error_type": (w.get("PronunciationAssessment") or {}).get("ErrorType", "None")}
            for w in best.get("Words", [])
        ]
        return PronunciationResult(
            accuracy=pa.get("AccuracyScore"), fluency=pa.get("FluencyScore"), completeness=pa.get("CompletenessScore"),
            prosody=pa.get("ProsodyScore"), overall=pa.get("PronScore"), words=words,
            recognized_text=best.get("Display", ""), provider=self.name,
        )


class AzureTTS:
    name = "azure"

    def __init__(self, *, key: str, region: str, voices: dict[str, dict]) -> None:
        self._key, self._region, self._voices = key, region, voices

    async def synthesize(self, text: str, *, language: str, accent: str | None, speed: float) -> tuple[bytes, str]:
        lang_voices = self._voices.get(language, {})
        v = lang_voices.get(accent or "") or (next(iter(lang_voices.values())) if lang_voices else None)
        if not v:
            raise AIError("Nenhuma voz configurada para este idioma.", code="server_config")
        rate = f"{round((speed - 1) * 100):+d}%"
        ssml = (f"<speak version='1.0' xml:lang='{v['locale']}'><voice name='{v['azure']}'>"
                f"<prosody rate='{rate}'>{escape(text[:3000])}</prosody></voice></speak>")
        headers = {"Ocp-Apim-Subscription-Key": self._key, "Content-Type": "application/ssml+xml",
                   "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "fluent-ai"}
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(f"https://{self._region}.tts.speech.microsoft.com/cognitiveservices/v1",
                                         content=ssml.encode(), headers=headers)
        except httpx.HTTPError as e:
            raise AIError("Sem conexão com o Azure Speech.", retryable=True, code="provider_unreachable") from e
        if resp.status_code >= 400:
            raise AIError("Falha na síntese de voz do Azure.", retryable=resp.status_code >= 500, code="provider_unavailable")
        return resp.content, "audio/mpeg"
