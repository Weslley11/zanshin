"""Provedor LLM: Claude (Anthropic) via SDK oficial.

- Saída estruturada com JSON Schema (`output_config.format`) → respostas sempre parseáveis.
- `effort` por finalidade: conversa usa esforço baixo (latência), relatórios usam médio.
- Fallback do lado do servidor (`fallbacks: "default"`) para recusas de política, habilitado
  por padrão e configurável (`ANTHROPIC_ENABLE_FALLBACKS`).
- Cache automático de prompt (`cache_control` no topo) reduz custo em conversas longas.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import anthropic

from app.ai.base import AIError, ChatMessage, LLMResult, LLMUsage, Purpose

log = logging.getLogger(__name__)

_FALLBACK_BETA = "server-side-fallback-2026-07-01"


class AnthropicLLM:
    name = "anthropic"
    is_generative = True

    def __init__(
        self,
        *,
        api_key: str | None,
        model: str,
        effort_chat: str = "low",
        effort_report: str = "medium",
        enable_fallbacks: bool = True,
        timeout_seconds: float = 90.0,
    ) -> None:
        self.model = model
        self._effort = {"chat": effort_chat, "report": effort_report, "evaluation": effort_chat, "document": effort_report}
        self._enable_fallbacks = enable_fallbacks
        # api_key=None → o SDK resolve credenciais do ambiente (ANTHROPIC_API_KEY, perfil `ant auth login`, ...)
        self._client = anthropic.AsyncAnthropic(api_key=api_key, timeout=timeout_seconds, max_retries=2)

    async def generate_json(
        self,
        *,
        system: str,
        messages: list[ChatMessage],
        schema: dict[str, Any],
        purpose: Purpose,
        max_tokens: int = 4096,
    ) -> LLMResult:
        kwargs: dict[str, Any] = {
            "model": self.model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "output_config": {
                "effort": self._effort.get(purpose, "low"),
                "format": {"type": "json_schema", "schema": schema},
            },
            "cache_control": {"type": "ephemeral"},
        }
        if self._enable_fallbacks:
            kwargs["betas"] = [_FALLBACK_BETA]
            kwargs["fallbacks"] = "default"

        try:
            response = await self._client.beta.messages.create(**kwargs)
        except anthropic.AuthenticationError as e:
            raise AIError("Credencial do provedor de IA inválida. Verifique a configuração do servidor.",
                          code="provider_auth") from e
        except anthropic.PermissionDeniedError as e:
            raise AIError("A chave do provedor de IA não tem permissão para este modelo.", code="provider_auth") from e
        except anthropic.NotFoundError as e:
            raise AIError(f"Modelo '{self.model}' não encontrado no provedor.", code="provider_config") from e
        except anthropic.RateLimitError as e:
            raise AIError("O provedor de IA está com limite de requisições. Tente novamente em instantes.",
                          retryable=True, code="rate_limited") from e
        except anthropic.BadRequestError as e:
            log.warning("anthropic bad request: %s", getattr(e, "message", e))
            raise AIError("Requisição inválida para o provedor de IA.", code="provider_bad_request") from e
        except anthropic.APIStatusError as e:
            raise AIError("O provedor de IA está indisponível no momento.", retryable=e.status_code >= 500,
                          code="provider_unavailable") from e
        except anthropic.APIConnectionError as e:
            raise AIError("Sem conexão com o provedor de IA.", retryable=True, code="provider_unreachable") from e

        if response.stop_reason == "refusal":
            raise AIError("O provedor de IA recusou esta solicitação. Reformule a mensagem.", code="refusal")
        if response.stop_reason == "max_tokens":
            raise AIError("A resposta da IA foi interrompida (limite de tokens).", retryable=True, code="truncated")

        text = "".join(block.text for block in response.content if block.type == "text")
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            raise AIError("A IA retornou uma resposta em formato inesperado.", retryable=True, code="bad_output") from e

        usage = response.usage
        return LLMResult(
            data=data,
            usage=LLMUsage(
                input_tokens=(usage.input_tokens or 0) + (usage.cache_creation_input_tokens or 0),
                output_tokens=usage.output_tokens or 0,
                cache_read_tokens=usage.cache_read_input_tokens or 0,
            ),
            model=response.model,
            provider=self.name,
        )
