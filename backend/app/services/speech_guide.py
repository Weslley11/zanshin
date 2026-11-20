"""Guia "Como eles falam": progresso do treino de ouvido e frases na revisão espaçada (FSRS)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content.speech_guide import GUIDES, guide_items, guide_summary
from app.models import ActivityLog, User
from app.services import vocab as vocab_service
from app.services.missions import card_for_phrase

LANGUAGE = "en"
DOMAIN = {"IN": "india", "US": "usa"}


async def overview(db: AsyncSession, user: User) -> dict:
    logs = (await db.execute(select(ActivityLog).where(ActivityLog.user_id == user.id,
                                                       ActivityLog.activity_type == "guide_quiz"))).scalars().all()
    stats: dict[str, dict] = {}
    for log in logs:
        code = (log.details or {}).get("guide")
        if not code:
            continue
        s = stats.setdefault(code, {"sessions": 0, "best_score": 0.0})
        s["sessions"] += 1
        s["best_score"] = max(s["best_score"], log.score or 0.0)
    return {"guides": [guide_summary(g) | {"sessions": stats.get(g["code"], {}).get("sessions", 0),
                                           "best_score": round(stats.get(g["code"], {}).get("best_score", 0.0), 3)} for g in GUIDES]}


async def complete(db: AsyncSession, user: User, g: dict, *, results: list[dict], duration_seconds: int) -> dict:
    by_id = {i["id"]: i for i in guide_items(g)}
    added = reviewed = good = 0
    for r in results:
        item = by_id.get(r["item_id"])
        if item is None:
            continue
        card, created = await card_for_phrase(db, user, item, source="guide", domain=DOMAIN.get(g["code"], "general"))
        added += int(created)
        await vocab_service.review(db, user, card, r["rating"], None, "guide")
        reviewed += 1
        good += int(r["rating"] >= 3)
    score = round(good / reviewed, 3) if reviewed else 0.0
    db.add(ActivityLog(user_id=user.id, language=LANGUAGE, activity_type="guide_quiz", duration_seconds=duration_seconds,
                       score=score, skills=["listening", "vocabulary"], details={"guide": g["code"]}))
    await db.flush()
    return {"reviewed": reviewed, "added": added, "score": score, "overview": await overview(db, user)}
