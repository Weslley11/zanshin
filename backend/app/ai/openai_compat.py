"""Provedores compatíveis com a API OpenAI (OpenAI, Azure OpenAI, ou servidores locais como vLLM/Ollama).

Existe para cumprir o requisito de não depender de um único fornecedor. Usa HTTP direto
(httpx) para funcionar com qualquer servidor que implemente o mesmo contrato.
"""

from __future__ import annotations

import json
from typing import Any

import httpx

from app.ai.base import AIError, ChatMessage, LLMResult, LLMUsage, Purpose, Transcript, WordTiming


def _raise_for(resp: httpx.Response, what: str) -> None:
    if resp.status_code == 401:
        raise AIError(f"Credencial inválida para {what}.", code="provider_auth")
    if resp.status_code == 429:
        raise AIError(f"Limite de requisições atingido em {what}.", retryable=True, code="rate_limited")
    if resp.status_code >= 500:
        raise AIError(f"{what} indisponível.", retryable=True, code="provider_unavailable")
    if resp.status_code >= 400:
        raise AIError(f"Requisição rejeitada por {what} ({resp.status_code}).", code="provider_bad_request")


class OpenAICompatLLM:
    name = "openai_compatible"
    is_generative = True

    def __init__(self, *, api_key: str | None, base_url: str, model: str, timeout_seconds: float = 90.0) -> None:
        self.model = model
        self._base = base_url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._timeout = timeout_seconds

    async def generate_json(
        self, *, system: str, messages: list[ChatMessage], schema: dict[str, Any], purpose: Purpose, max_tokens: int = 4096
    ) -> LLMResult:
        body = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": [{"role": "system", "content": system}] + [{"role": m.role, "content": m.content} for m in messages],
            "response_format": {"type": "json_schema", "json_schema": {"name": f"fluent_{purpose}", "schema": schema, "strict": False}},
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(f"{self._base}/chat/completions", json=body, headers=self._headers)
        except httpx.HTTPError as e:
            raise AIError("Sem conexão com o provedor de IA.", retryable=True, code="provider_unreachable") from e
        _raise_for(resp, "o provedor de IA")
        payload = resp.json()
        choice = payload["choices"][0]
        if choice.get("finish_reason") == "length":
            raise AIError("A resposta da IA foi interrompida (limite de tokens).", retryable=True, code="truncated")
        try:
            data = json.loads(choice["message"]["content"] or "")
        except json.JSONDecodeError as e:
            raise AIError("A IA retornou uma resposta em formato inesperado.", retryable=True, code="bad_output") from e
        u = payload.get("usage", {})
        return LLMResult(
            data=data,
            usage=LLMUsage(input_tokens=u.get("prompt_tokens", 0), output_tokens=u.get("completion_tokens", 0)),
            model=payload.get("model", self.model),
            provider=self.name,
        )


class OpenAICompatSTT:
    name = "openai_compatible"

    def __init__(self, *, api_key: str | None, base_url: str, model: str = "whisper-1") -> None:
        self._base = base_url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._model = model

    async def transcribe(self, audio: bytes, *, mime_type: str, language: str, prompt: str | None = None) -> Transcript:
        ext = {"audio/mp4": "m4a", "audio/m4a": "m4a", "audio/x-m4a": "m4a", "audio/webm": "webm", "audio/wav": "wav",
               "audio/x-wav": "wav", "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/aac": "aac"}.get(mime_type, "m4a")
        data: dict[str, Any] = {"model": self._model, "language": language.split("-")[0]}
        if self._model.startswith("whisper"):
            data["response_format"] = "verbose_json"
            data["timestamp_granularities[]"] = "word"
        else:
            data["response_format"] = "json"
        if prompt:
            data["prompt"] = prompt[:400]
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    f"{self._base}/audio/transcriptions", headers=self._headers, data=data,
                    files={"file": (f"audio.{ext}", audio, mime_type)},
                )
        except httpx.HTTPError as e:
            raise AIError("Sem conexão com o serviço de transcrição.", retryable=True, code="provider_unreachable") from e
        _raise_for(resp, "o serviço de transcrição")
        p = resp.json()
        words = [WordTiming(w["word"], float(w["start"]), float(w["end"])) for w in p.get("words", []) or []]
        duration = float(p.get("duration") or (words[-1].end if words else 0.0))
        # Whisper não retorna confiança por palavra; usamos avg_logprob dos segmentos quando disponível.
        confidence = None
        segs = p.get("segments") or []
        if segs:
            import math

            lp = [s.get("avg_logprob") for s in segs if s.get("avg_logprob") is not None]
            if lp:
                confidence = max(0.0, min(1.0, math.exp(sum(lp) / len(lp))))
        return Transcript(text=p.get("text", "").strip(), language=language, duration_seconds=duration,
                          words=words, confidence=confidence, provider=self.name)


class OpenAICompatTTS:
    name = "openai_compatible"

    def __init__(self, *, api_key: str | None, base_url: str, model: str, voices: dict[str, dict]) -> None:
        self._base = base_url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._model = model
        self._voices = voices

    async def synthesize(self, text: str, *, language: str, accent: str | None, speed: float) -> tuple[bytes, str]:
        voice = "alloy"
        lang_voices = self._voices.get(language, {})
        if accent and accent in lang_voices:
            voice = lang_voices[accent].get("openai", voice)
        elif lang_voices:
            voice = next(iter(lang_voices.values())).get("openai", voice)
        body = {"model": self._model, "voice": voice, "input": text[:4000], "speed": max(0.5, min(1.5, speed)),
                "response_format": "mp3"}
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(f"{self._base}/audio/speech", json=body, headers=self._headers)
        except httpx.HTTPError as e:
            raise AIError("Sem conexão com o serviço de voz.", retryable=True, code="provider_unreachable") from e
        _raise_for(resp, "o serviço de voz")
        return resp.content, "audio/mpeg"
