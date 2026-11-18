"""Configuração centralizada (variáveis de ambiente / .env).

Nenhuma credencial é codificada no código. Em produção (`ENV=production`) a aplicação
se recusa a iniciar sem um `JWT_SECRET` forte.
"""

from __future__ import annotations

import secrets
import warnings
from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: Literal["development", "test", "production"] = "development"
    app_name: str = "Fluent AI"
    api_prefix: str = "/api/v1"

    # Banco de dados. PostgreSQL em produção; SQLite apenas para desenvolvimento/testes.
    database_url: str = "sqlite+aiosqlite:///./fluent_dev.db"

    # Autenticação
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30
    login_rate_limit_per_minute: int = 10

    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:8081", "http://localhost:19006", "http://localhost:3000"]
    )

    # --- Provedores de IA (camada de abstração; ver app/ai) ---
    llm_provider: Literal["anthropic", "openai_compatible", "offline"] = "offline"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-opus-5-5"
    # Esforço por finalidade: conversa precisa de baixa latência; relatórios toleram mais.
    anthropic_effort_chat: Literal["low", "medium", "high"] = "low"
    anthropic_effort_report: Literal["low", "medium", "high"] = "medium"
    anthropic_enable_fallbacks: bool = True

    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"

    stt_provider: Literal["none", "openai_compatible", "azure"] = "none"
    openai_stt_model: str = "whisper-1"
    tts_provider: Literal["device", "openai_compatible", "azure"] = "device"
    openai_tts_model: str = "gpt-4o-mini-tts"
    azure_speech_key: str | None = None
    azure_speech_region: str | None = None
    pronunciation_provider: Literal["none", "azure"] = "none"

    # --- Controle de custos ---
    daily_llm_tokens_per_user: int = 250_000
    daily_stt_seconds_per_user: int = 3_600
    daily_tts_chars_per_user: int = 60_000
    global_daily_cost_limit_usd: float = 50.0
    # Preços estimados (USD) — revise conforme a tabela vigente do seu provedor.
    price_llm_input_per_mtok: float = 4.0
    price_llm_output_per_mtok: float = 20.0
    price_stt_per_minute: float = 0.006
    price_tts_per_mchar: float = 15.0

    # --- Privacidade ---
    store_recordings_default: bool = False
    recording_retention_days: int = 30
    storage_dir: str = "./storage"
    max_upload_audio_mb: int = 10
    max_document_kb: int = 400

    @model_validator(mode="after")
    def _check_secret(self) -> Settings:
        if not self.jwt_secret:
            if self.env == "production":
                raise ValueError("JWT_SECRET é obrigatório em produção (use 64+ caracteres aleatórios).")
            self.jwt_secret = secrets.token_urlsafe(64)
            if self.env == "development":
                warnings.warn(
                    "JWT_SECRET não definido: usando segredo aleatório temporário (sessões expiram ao reiniciar).",
                    stacklevel=2,
                )
        elif self.env == "production" and len(self.jwt_secret) < 32:
            raise ValueError("JWT_SECRET muito curto para produção.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
