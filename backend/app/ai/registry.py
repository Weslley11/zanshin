"""Monta os provedores a partir da configuração e expõe as capacidades REAIS ao cliente.

O app nunca apresenta como operacional algo que não está configurado: `capabilities()`
informa ao frontend o que de fato funciona (ex.: sem STT → entrada por texto).
"""

from __future__ import annotations

from dataclasses import dataclass

from app.ai.anthropic_provider import AnthropicLLM
from app.ai.audio import ffmpeg_available
from app.ai.azure_speech import AzurePronunciation, AzureSTT, AzureTTS
from app.ai.base import LLMProvider, PronunciationProvider, STTProvider, TTSProvider
from app.ai.openai_compat import OpenAICompatLLM, OpenAICompatSTT, OpenAICompatTTS
from app.config import Settings
from app.content.languages import LANGUAGES


class OfflineLLM:
    """Marcador para 'sem IA generativa'. Os serviços usam caminhos determinísticos quando ativo."""

    name = "offline"
    model = "rules"
    is_generative = False

    async def generate_json(self, **_kwargs):  # pragma: no cover - nunca chamado pelos serviços
        raise RuntimeError("OfflineLLM não gera texto; use os caminhos determinísticos.")


@dataclass
class Providers:
    llm: LLMProvider
    stt: STTProvider | None
    tts: TTSProvider | None
    pronunciation: PronunciationProvider | None

    def capabilities(self) -> dict:
        return {
            "llm": {"provider": self.llm.name, "model": self.llm.model, "generative": self.llm.is_generative},
            "stt": {"provider": self.stt.name if self.stt else None, "available": self.stt is not None},
            "tts": {"provider": self.tts.name if self.tts else "device", "server_available": self.tts is not None},
            "pronunciation_assessment": {
                "provider": self.pronunciation.name if self.pronunciation else None,
                "available": self.pronunciation is not None,
                "fallback": "transcript_alignment" if self.stt else "client_transcript_only",
            },
            "realtime_streaming": False,
        }


def build_providers(settings: Settings) -> Providers:
    voices = {code: lang["tts_voices"] for code, lang in LANGUAGES.items()}
    locales = {code: lang["stt_locale"] for code, lang in LANGUAGES.items()}

    llm: LLMProvider
    if settings.llm_provider == "anthropic":
        llm = AnthropicLLM(
            api_key=settings.anthropic_api_key, model=settings.anthropic_model,
            effort_chat=settings.anthropic_effort_chat, effort_report=settings.anthropic_effort_report,
            enable_fallbacks=settings.anthropic_enable_fallbacks,
        )
    elif settings.llm_provider == "openai_compatible":
        llm = OpenAICompatLLM(api_key=settings.openai_api_key, base_url=settings.openai_base_url, model=settings.openai_model)
    else:
        llm = OfflineLLM()

    stt: STTProvider | None = None
    if settings.stt_provider == "openai_compatible" and settings.openai_api_key:
        stt = OpenAICompatSTT(api_key=settings.openai_api_key, base_url=settings.openai_base_url, model=settings.openai_stt_model)
    elif settings.stt_provider == "azure" and settings.azure_speech_key and settings.azure_speech_region and ffmpeg_available():
        stt = AzureSTT(key=settings.azure_speech_key, region=settings.azure_speech_region, locales=locales)

    tts: TTSProvider | None = None
    if settings.tts_provider == "openai_compatible" and settings.openai_api_key:
        tts = OpenAICompatTTS(api_key=settings.openai_api_key, base_url=settings.openai_base_url,
                              model=settings.openai_tts_model, voices=voices)
    elif settings.tts_provider == "azure" and settings.azure_speech_key and settings.azure_speech_region:
        tts = AzureTTS(key=settings.azure_speech_key, region=settings.azure_speech_region, voices=voices)

    pron: PronunciationProvider | None = None
    if settings.pronunciation_provider == "azure" and settings.azure_speech_key and settings.azure_speech_region and ffmpeg_available():
        pron = AzurePronunciation(key=settings.azure_speech_key, region=settings.azure_speech_region, locales=locales)

    return Providers(llm=llm, stt=stt, tts=tts, pronunciation=pron)
