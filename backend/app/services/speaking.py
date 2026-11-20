"""Medidor de fala semanal e registro de conversas reais (com pessoas)."""

from __future__ import annotations

import re
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content.speaking_check import FILLERS, PROMPTS, PT_WORDS, REAL_PARTNERS, prompt_for
from app.db import utcnow
from app.models import ActivityLog, User
from app.services import plans as plan_service

LANGUAGE = "en"
WORD_RE = re.compile(r"[^\W\d_]+(?:'[^\W\d_]+)?")


def speaking_metrics(transcript: str, seconds: float) -> dict:
    """Medidas do minuto de fala (mesma fórmula do app: mobile/src/lib/speaking.ts)."""
    text = transcript.lower().replace("’", "'").replace("‘", "'")
    words = WORD_RE.findall(text)
    n = len(words)
    secs = min(max(float(seconds), 10.0), 180.0)
    sentences = sum(1 for part in re.split(r"[.!?]+", text) if WORD_RE.search(part))
    return {
        "words": n,
        "wpm": round(n * 60 / secs),
        "variety_pct": round(100 * len(set(words)) / n) if n else 0,
        "fillers": sum(1 for w in words if w in FILLERS),
        "pt_words": sum(1 for w in words if w in PT_WORDS),
        "mean_sentence": round(10 * n / max(1, sentences)) / 10,
        "seconds": round(secs),
    }


async def _logs(db: AsyncSession, user: User, kind: str) -> list[ActivityLog]:
    return list((await db.execute(select(ActivityLog).where(ActivityLog.user_id == user.id, ActivityLog.activity_type == kind)
                                  .order_by(ActivityLog.started_at))).scalars())


async def overview(db: AsyncSession, user: User) -> dict:
    checks = await _logs(db, user, "speaking_check")
    history = [{"date": c.started_at.date().isoformat(), "prompt_id": (c.details or {}).get("prompt_id"),
                "confidence": (c.details or {}).get("confidence"), **(c.details or {}).get("metrics", {})} for c in checks]
    real = await _logs(db, user, "real_conversation")
    week_ago = utcnow() - timedelta(days=7)
    by_partner: dict[str, int] = dict.fromkeys(REAL_PARTNERS, 0)
    for r in real:
        p = (r.details or {}).get("partner", "other")
        by_partner[p] = by_partner.get(p, 0) + round((r.duration_seconds or 0) / 60)
    summary = None
    if history:
        first, last = history[0], history[-1]
        summary = {"checks": len(history), "first_wpm": first.get("wpm", 0), "last_wpm": last.get("wpm", 0),
                   "best_wpm": max(h.get("wpm", 0) for h in history),
                   "change_wpm": last.get("wpm", 0) - first.get("wpm", 0)}
    return {
        "prompt": prompt_for(len(checks)), "seconds": 60, "history": history[-26:], "summary": summary,
        "real": {"total_minutes": sum(round((r.duration_seconds or 0) / 60) for r in real),
                 "week_minutes": sum(round((r.duration_seconds or 0) / 60) for r in real if r.started_at >= week_ago),
                 "sessions": len(real), "by_partner": by_partner, "week_goal": 60},
    }


async def save_check(db: AsyncSession, user: User, *, prompt_id: str, transcript: str, seconds: float, confidence: int,
                     plan_day: int | None, plan_activity_id: str | None) -> dict:
    if prompt_id not in {p["id"] for p in PROMPTS}:
        raise ValueError("Tema desconhecido.")
    m = speaking_metrics(transcript, seconds)
    db.add(ActivityLog(user_id=user.id, language=LANGUAGE, activity_type="speaking_check", duration_seconds=m["seconds"],
                       score=None, skills=["speaking", "fluency"],
                       details={"prompt_id": prompt_id, "confidence": confidence, "metrics": m, "transcript": transcript[:1500]}))
    day = None
    if plan_day and plan_activity_id:
        plan = await plan_service.current_plan(db, user, LANGUAGE)
        if plan:
            d = await plan_service.complete_activity(db, plan, plan_day, plan_activity_id)
            day = plan_service.day_view(d) if d else None
    await db.flush()
    return {"metrics": m, "plan_day": day, "overview": await overview(db, user)}


async def log_real(db: AsyncSession, user: User, *, minutes: int, partner: str, note: str) -> dict:
    db.add(ActivityLog(user_id=user.id, language=LANGUAGE, activity_type="real_conversation", duration_seconds=minutes * 60,
                       score=None, skills=["speaking", "interaction"], details={"partner": partner, "note": note[:200]}))
    await db.flush()
    return await overview(db, user)
