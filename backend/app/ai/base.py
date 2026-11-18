"""Interfaces da camada de IA.

O domínio (tutor, avaliação, documentos) depende apenas destas interfaces. Trocar de
fornecedor = configurar outra implementação em `registry.py`; nenhum serviço importa SDKs.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Protocol

Purpose = Literal["chat", "report", "evaluation", "document"]


class AIError(Exception):
    """Falha recuperável de provedor (rede, limite, recusa). A mensagem é segura para o usuário."""

    def __init__(self, message: str, *, retryable: bool = False, code: str = "ai_error") -> None:
        super().__init__(message)
        self.retryable = retryable
        self.code = code


@dataclass
class ChatMessage:
    role: Literal["user", "assistant"]
    content: str


@dataclass
class LLMUsage:
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0

    @property
    def total(self) -> int:
        return self.input_tokens + self.output_tokens


@dataclass
class LLMResult:
    data: dict[str, Any]
    usage: LLMUsage = field(default_factory=LLMUsage)
    model: str = ""
    provider: str = ""


class LLMProvider(Protocol):
    name: str
    model: str
    is_generative: bool

    async def generate_json(
        self,
        *,
        system: str,
        messages: list[ChatMessage],
        schema: dict[str, Any],
        purpose: Purpose,
        max_tokens: int = 2048,
    ) -> LLMResult:
        """Gera uma resposta estruturada que obedece ao JSON Schema fornecido."""
        ...


@dataclass
class WordTiming:
    word: str
    start: float
    end: float
    confidence: float | None = None


@dataclass
class Transcript:
    text: str
    language: str
    duration_seconds: float
    words: list[WordTiming] = field(default_factory=list)
    confidence: float | None = None  # 0..1 quando o provedor informa
    provider: str = ""


class STTProvider(Protocol):
    name: str

    async def transcribe(self, audio: bytes, *, mime_type: str, language: str, prompt: str | None = None) -> Transcript: ...


class TTSProvider(Protocol):
    name: str

    async def synthesize(self, text: str, *, language: str, accent: str | None, speed: float) -> tuple[bytes, str]:
        """Retorna (bytes de áudio, mime type)."""
        ...


@dataclass
class PronunciationResult:
    accuracy: float | None
    fluency: float | None
    completeness: float | None
    prosody: float | None
    overall: float | None
    words: list[dict] = field(default_factory=list)
    recognized_text: str = ""
    provider: str = ""


class PronunciationProvider(Protocol):
    name: str

    async def assess(self, audio: bytes, *, mime_type: str, language: str, reference_text: str) -> PronunciationResult: ...
