"""Fluent AI — API (FastAPI)."""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.ai.base import AIError
from app.ai.registry import build_providers
from app.config import get_settings
from app.db import Base, get_engine, get_sessionmaker
from app.jobs import purge_expired_recordings
from app.routers import auth, content, documents, learning, me, speech, tutor
from app.services.vocab import seed_vocab

log = logging.getLogger("fluent")


def _configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format='{"ts":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}')


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    _configure_logging()
    app.state.providers = getattr(app.state, "providers", None) or build_providers(settings)
    if settings.env != "production":
        # Em desenvolvimento/teste criamos as tabelas automaticamente; em produção use `alembic upgrade head`.
        async with get_engine().begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    async with get_sessionmaker()() as db:
        await seed_vocab(db)
        removed = await purge_expired_recordings(db)
        if removed:
            log.info("purged %s expired recordings", removed)
    caps = app.state.providers.capabilities()
    log.info("providers: llm=%s generative=%s stt=%s tts=%s", caps["llm"]["provider"], caps["llm"]["generative"],
             caps["stt"]["provider"], caps["tts"]["provider"])
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan,
                  docs_url="/docs" if settings.env != "production" else None, redoc_url=None)
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"],
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        start = time.perf_counter()
        response = await call_next(request)
        ms = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = rid
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        # Sem corpo/conteúdo do usuário nos logs (privacidade); apenas rota, status e latência.
        log.info("rid=%s %s %s %s %.0fms", rid, request.method, request.url.path, response.status_code, ms)
        return response

    @app.exception_handler(AIError)
    async def ai_error_handler(_request: Request, exc: AIError) -> JSONResponse:
        return JSONResponse(status_code=503 if exc.retryable else 502,
                            content={"detail": {"code": exc.code, "message": str(exc), "retryable": exc.retryable}})

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok"}

    for r in (auth.router, me.router, content.router, learning.router, tutor.router, speech.router, documents.router):
        app.include_router(r, prefix=settings.api_prefix)
    return app


app = create_app()
