"""Contrato dos provedores de IA (sem rede): formato das requisições e mapeamento de erros."""

from __future__ import annotations

import json
from types import SimpleNamespace

import anthropic
import httpx
import pytest

from app.ai.anthropic_provider import AnthropicLLM
from app.ai.base import AIError, ChatMessage
from app.ai.openai_compat import OpenAICompatLLM, OpenAICompatSTT
from app.ai.registry import build_providers
from app.config import Settings
from app.services.tutor_prompts import TURN_SCHEMA


class _FakeMessages:
    def __init__(self, response=None, exc=None):
        self.response, self.exc, self.kwargs = response, exc, None

    async def create(self, **kwargs):
        self.kwargs = kwargs
        if self.exc:
            raise self.exc
        return self.response


def _response(data: dict, stop_reason: str = "end_turn"):
    return SimpleNamespace(
        stop_reason=stop_reason, model="claude-opus-5-5",
        content=[SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text=json.dumps(data))],
        usage=SimpleNamespace(input_tokens=120, output_tokens=40, cache_creation_input_tokens=10, cache_read_input_tokens=500),
    )


def _llm(fake: _FakeMessages, **kw) -> AnthropicLLM:
    llm = AnthropicLLM(api_key="test-key", model="claude-opus-5-5", **kw)
    llm._client = SimpleNamespace(beta=SimpleNamespace(messages=fake))
    return llm


async def test_anthropic_request_shape():
    data = {"reply": "Hi!", "corrections": [], "new_vocabulary": [], "goals_achieved": [], "comprehension_issue": False}
    fake = _FakeMessages(_response(data))
    res = await _llm(fake).generate_json(system="sys", messages=[ChatMessage("user", "hello")], schema=TURN_SCHEMA,
                                         purpose="chat", max_tokens=4096)
    k = fake.kwargs
    assert k["model"] == "claude-opus-5-5" and k["system"] == "sys"
    assert k["output_config"] == {"effort": "low", "format": {"type": "json_schema", "schema": TURN_SCHEMA}}
    assert k["fallbacks"] == "default" and k["betas"] == ["server-side-fallback-2026-07-01"]
    assert k["cache_control"] == {"type": "ephemeral"}
    assert "thinking" not in k and "temperature" not in k
    assert res.data == data and res.usage.input_tokens == 130 and res.usage.cache_read_tokens == 500


async def test_anthropic_report_effort_and_no_fallbacks():
    fake = _FakeMessages(_response({"ok": True}))
    await _llm(fake, enable_fallbacks=False).generate_json(system="s", messages=[ChatMessage("user", "x")],
                                                           schema={"type": "object"}, purpose="report")
    assert fake.kwargs["output_config"]["effort"] == "medium" and "fallbacks" not in fake.kwargs


@pytest.mark.parametrize(("stop", "code"), [("refusal", "refusal"), ("max_tokens", "truncated")])
async def test_anthropic_stop_reasons(stop, code):
    with pytest.raises(AIError) as e:
        await _llm(_FakeMessages(_response({}, stop))).generate_json(
            system="s", messages=[ChatMessage("user", "x")], schema={"type": "object"}, purpose="chat")
    assert e.value.code == code


def _api_error(cls, status: int):
    import httpx2

    req = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    return cls("boom", response=httpx2.Response(status, request=req), body=None)


@pytest.mark.parametrize(("cls", "status", "code", "retryable"), [
    (anthropic.RateLimitError, 429, "rate_limited", True),
    (anthropic.AuthenticationError, 401, "provider_auth", False),
    (anthropic.InternalServerError, 500, "provider_unavailable", True),
    (anthropic.BadRequestError, 400, "provider_bad_request", False),
])
async def test_anthropic_error_mapping(cls, status, code, retryable):
    with pytest.raises(AIError) as e:
        await _llm(_FakeMessages(exc=_api_error(cls, status))).generate_json(
            system="s", messages=[ChatMessage("user", "x")], schema={"type": "object"}, purpose="chat")
    assert e.value.code == code and e.value.retryable is retryable


async def test_openai_compatible_llm_and_stt(monkeypatch):
    sent = {}

    async def fake_post(self, url, **kwargs):
        sent[url] = kwargs
        if url.endswith("/chat/completions"):
            return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": '{"a": 1}'}}],
                                             "usage": {"prompt_tokens": 5, "completion_tokens": 2}, "model": "m"})
        return httpx.Response(200, json={"text": " hello there ", "duration": 1.5,
                                         "words": [{"word": "hello", "start": 0.0, "end": 0.5}, {"word": "there", "start": 0.6, "end": 1.0}],
                                         "segments": [{"avg_logprob": -0.1}]})

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    res = await OpenAICompatLLM(api_key="k", base_url="http://local/v1", model="m").generate_json(
        system="s", messages=[ChatMessage("user", "x")], schema={"type": "object"}, purpose="chat")
    assert res.data == {"a": 1} and res.usage.total == 7
    body = sent["http://local/v1/chat/completions"]["json"]
    assert body["messages"][0] == {"role": "system", "content": "s"} and body["response_format"]["type"] == "json_schema"
    t = await OpenAICompatSTT(api_key="k", base_url="http://local/v1").transcribe(b"x", mime_type="audio/mp4", language="en")
    assert t.text == "hello there" and len(t.words) == 2 and 0.85 < t.confidence < 0.95


def test_registry_only_enables_configured_providers():
    p = build_providers(Settings(jwt_secret="x" * 40, llm_provider="offline", stt_provider="openai_compatible"))
    caps = p.capabilities()
    assert caps["llm"]["generative"] is False
    assert caps["stt"]["available"] is False  # sem chave → não habilitado (nada é apresentado como operacional)
    p2 = build_providers(Settings(jwt_secret="x" * 40, llm_provider="anthropic", anthropic_api_key="k",
                                  stt_provider="openai_compatible", openai_api_key="k"))
    assert p2.capabilities()["llm"]["provider"] == "anthropic" and p2.capabilities()["stt"]["available"]
