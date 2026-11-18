"""Controle de custos de APIs pagas: orçamento diário por usuário e teto global diário."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import LLMUsage
from app.config import get_settings
from app.db import utcnow
from app.models import UsageLedger


def _today() -> date:
    return utcnow().date()


async def _sum(db: AsyncSession, *, user_id: uuid.UUID | None, kind: str | None, field) -> float:
    q = select(func.coalesce(func.sum(field), 0.0)).where(UsageLedger.day == _today())
    if user_id is not None:
        q = q.where(UsageLedger.user_id == user_id)
    if kind is not None:
        q = q.where(UsageLedger.kind == kind)
    return float((await db.execute(q)).scalar_one())


async def ensure_budget(db: AsyncSession, user_id: uuid.UUID, kind: str) -> None:
    """Bloqueia a chamada antes de gastar se o orçamento diário já foi atingido."""
    s = get_settings()
    limits = {
        "llm_tokens": s.daily_llm_tokens_per_user,
        "stt_seconds": s.daily_stt_seconds_per_user,
        "tts_chars": s.daily_tts_chars_per_user,
    }
    used = await _sum(db, user_id=user_id, kind=kind, field=UsageLedger.amount)
    if used >= limits[kind]:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "daily_budget_exceeded", "kind": kind,
                    "message": "Você atingiu o limite diário deste recurso de IA. Ele é renovado amanhã; "
                               "enquanto isso, use os exercícios offline (vocabulário, listening e drills)."},
        )
    global_cost = await _sum(db, user_id=None, kind=None, field=UsageLedger.cost_usd)
    if global_cost >= s.global_daily_cost_limit_usd:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "global_budget_exceeded",
                    "message": "Os recursos de IA estão temporariamente indisponíveis (limite operacional diário)."},
        )


def llm_cost(usage: LLMUsage) -> float:
    s = get_settings()
    return (
        usage.input_tokens * s.price_llm_input_per_mtok
        + usage.cache_read_tokens * s.price_llm_input_per_mtok * 0.1
        + usage.output_tokens * s.price_llm_output_per_mtok
    ) / 1_000_000


async def record(
    db: AsyncSession, *, user_id: uuid.UUID, provider: str, kind: str, amount: float, cost_usd: float, purpose: str
) -> None:
    db.add(UsageLedger(user_id=user_id, day=_today(), provider=provider, kind=kind, amount=amount,
                       cost_usd=round(cost_usd, 6), purpose=purpose))


async def record_llm(db: AsyncSession, user_id: uuid.UUID, provider: str, usage: LLMUsage, purpose: str) -> None:
    await record(db, user_id=user_id, provider=provider, kind="llm_tokens", amount=usage.total,
                 cost_usd=llm_cost(usage), purpose=purpose)


async def record_stt(db: AsyncSession, user_id: uuid.UUID, provider: str, seconds: float, purpose: str) -> None:
    await record(db, user_id=user_id, provider=provider, kind="stt_seconds", amount=seconds,
                 cost_usd=seconds / 60 * get_settings().price_stt_per_minute, purpose=purpose)


async def record_tts(db: AsyncSession, user_id: uuid.UUID, provider: str, chars: int, purpose: str) -> None:
    await record(db, user_id=user_id, provider=provider, kind="tts_chars", amount=chars,
                 cost_usd=chars / 1_000_000 * get_settings().price_tts_per_mchar, purpose=purpose)


async def usage_summary(db: AsyncSession, user_id: uuid.UUID) -> dict:
    s = get_settings()
    return {
        "llm_tokens": {"used": await _sum(db, user_id=user_id, kind="llm_tokens", field=UsageLedger.amount),
                       "limit": s.daily_llm_tokens_per_user},
        "stt_seconds": {"used": await _sum(db, user_id=user_id, kind="stt_seconds", field=UsageLedger.amount),
                        "limit": s.daily_stt_seconds_per_user},
        "tts_chars": {"used": await _sum(db, user_id=user_id, kind="tts_chars", field=UsageLedger.amount),
                      "limit": s.daily_tts_chars_per_user},
    }
