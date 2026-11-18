from __future__ import annotations

import os
from collections.abc import AsyncIterator

import pytest

os.environ.setdefault("ENV", "test")
os.environ.setdefault("JWT_SECRET", "test-secret-" + "x" * 40)

from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.ai.base import AIError, LLMResult, LLMUsage  # noqa: E402
from app.ai.registry import OfflineLLM, Providers  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.db import reset_engine  # noqa: E402
from app.security import ai_limiter, login_limiter  # noqa: E402


class FakeLLM:
    """LLM determinístico para testar o caminho 'com IA' sem rede."""

    name = "fake"
    model = "fake-1"
    is_generative = True

    def __init__(self, fail: bool = False) -> None:
        self.calls: list[dict] = []
        self.fail = fail

    async def generate_json(self, *, system, messages, schema, purpose, max_tokens=4096):
        self.calls.append({"system": system, "messages": messages, "schema": schema, "purpose": purpose})
        if self.fail:
            raise AIError("simulated outage", retryable=True, code="provider_unavailable")
        props = schema.get("properties", {})
        if "reply" in props:
            last = messages[-1].content
            corrections = []
            if "I have went" in last:
                corrections.append({"original": last, "corrected": last.replace("have went", "have gone"),
                                    "explanation_pt": "Use o particípio.", "category": "grammar",
                                    "subtype": "past_participle", "severity": "minor"})
            return LLMResult(data={"reply": "That sounds great! What happened next?", "corrections": corrections,
                                   "new_vocabulary": [{"term": "to be swamped", "meaning_pt": "estar atolado",
                                                       "example": "I'm swamped this week."}],
                                   "goals_achieved": ["purpose"] if "business" in last.lower() else [],
                                   "comprehension_issue": False},
                             usage=LLMUsage(100, 30), model=self.model, provider=self.name)
        if "summary_pt" in props:
            return LLMResult(data={
                "summary_pt": "Boa conversa.", "strengths_pt": ["Fluência"],
                "main_errors": [{"original": "I have went there.", "corrected": "I have gone there.",
                                 "explanation_pt": "Particípio.", "category": "grammar", "subtype": "past_participle",
                                 "severity": "minor", "count": 2}],
                "corrected_sentences": [{"original": "I have went there.", "corrected": "I have gone there."}],
                "natural_expressions": [{"learner_said": "I am very busy", "more_natural": "I'm swamped", "note_pt": "informal"}],
                "new_vocabulary": [{"term": "to be swamped", "meaning_pt": "estar atolado", "example": "I'm swamped."}],
                "recommendations_pt": ["Pratique present perfect."],
                "exercises": [{"type": "rewrite", "instruction_pt": "Reescreva", "prompt": "I have went", "answer": "I have gone"}],
                "topics": ["weekend trip"], "cefr_observation_pt": "Consistente com B1."},
                usage=LLMUsage(500, 300), model=self.model, provider=self.name)
        if "overall" in props:  # rubrica de fala
            return LLMResult(data={"range": "B1", "accuracy": "B1", "fluency": "A2", "coherence": "B1", "overall": "B1",
                                   "strengths_pt": ["Boa organização"], "improvements_pt": ["Mais conectores"]},
                             usage=LLMUsage(200, 50), model=self.model, provider=self.name)
        if "glossary" in props:
            return LLMResult(data={"glossary": [{"term": "housing bore", "meaning_pt": "furo da carcaça",
                                                 "example": "Check the housing bore. See http://evil.example.com"}],
                                   "exercises": [], "dialogue": [{"speaker": "A", "text": "Hi"}],
                                   "roleplay": {"setting": "plant", "learner_role": "engineer", "partner_role": "tech",
                                                "goals_pt": ["Explicar"]}},
                             usage=LLMUsage(300, 200), model=self.model, provider=self.name)
        if "relevant" in props:
            return LLMResult(data={"relevant": True, "natural_version": "I'm an engineer.", "feedback_pt": "Boa!"},
                             usage=LLMUsage(50, 20), model=self.model, provider=self.name)
        raise AssertionError(f"unexpected schema {list(props)}")


@pytest.fixture
async def app_factory(tmp_path) -> AsyncIterator:
    created = []

    async def make(llm=None, stt=None):
        # TEST_DATABASE_URL=postgresql+asyncpg://... executa a suíte contra PostgreSQL real (como no CI).
        pg_url = os.environ.get("TEST_DATABASE_URL")
        os.environ["DATABASE_URL"] = pg_url or f"sqlite+aiosqlite:///{tmp_path}/test_{len(created)}.db"
        os.environ["STORAGE_DIR"] = str(tmp_path / "storage")
        get_settings.cache_clear()
        reset_engine()
        login_limiter.reset()
        ai_limiter.reset()
        if pg_url:
            from app.db import Base, get_engine

            async with get_engine().begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
        from app.main import create_app

        app = create_app()
        app.state.providers = Providers(llm=llm or OfflineLLM(), stt=stt, tts=None, pronunciation=None)
        ctx = app.router.lifespan_context(app)
        await ctx.__aenter__()
        created.append(ctx)
        client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        return app, client

    yield make
    for ctx in created:
        await ctx.__aexit__(None, None, None)
    reset_engine()


@pytest.fixture
async def client(app_factory):
    _app, c = await app_factory()
    async with c:
        yield c


async def register(client, email="ana@example.com", consents=None) -> dict:
    r = await client.post("/api/v1/auth/register", json={
        "email": email, "password": "senhaForte123", "display_name": "Ana", "accept_terms": True,
        "consents": consents if consents is not None else {"ai_processing": True, "voice_processing": True,
                                                           "document_processing": True},
    })
    assert r.status_code == 201, r.text
    return r.json()


def auth(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def setup_profile(client, headers, **kw) -> dict:
    body = {"daily_minutes": 45, "goals": ["viagem a trabalho"], "focus_domains": ["engineering"],
            "difficulties": ["listening", "speaking"], "self_level": "B1"} | kw
    r = await client.put("/api/v1/me/profiles/en", json=body, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()
