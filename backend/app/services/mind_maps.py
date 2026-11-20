"""Mapas mentais: progresso por mapa e entrada das frases na revisão espaçada (FSRS)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content.mind_maps import MAPS, leaves, map_summary
from app.models import ActivityLog, User
from app.services import vocab as vocab_service
from app.services.missions import card_for_phrase

LANGUAGE = "en"
MODES = ("study", "recall", "rebuild")


async def _progress(db: AsyncSession, user: User) -> dict[str, dict]:
    logs = (await db.execute(select(ActivityLog).where(ActivityLog.user_id == user.id,
                                                       ActivityLog.activity_type == "mind_map"))).scalars().all()
    progress: dict[str, dict] = {}
    for log in logs:
        d = log.details or {}
        mid = d.get("map_id")
        if not mid:
            continue
        p = progress.setdefault(mid, {"sessions": 0, "best_score": 0.0, "rebuilt": False, "last_at": None})
        p["sessions"] += 1
        p["best_score"] = max(p["best_score"], log.score or 0.0)
        p["rebuilt"] = p["rebuilt"] or d.get("mode") == "rebuild"
        at = log.started_at.isoformat()
        if p["last_at"] is None or at > p["last_at"]:
            p["last_at"] = at
    return progress


async def overview(db: AsyncSession, user: User) -> dict:
    progress = await _progress(db, user)
    items = []
    for m in MAPS:
        p = progress.get(m["id"], {"sessions": 0, "best_score": 0.0, "rebuilt": False, "last_at": None})
        items.append(map_summary(m) | {"sessions": p["sessions"], "best_score": round(p["best_score"], 3),
                                       "rebuilt": p["rebuilt"], "last_at": p["last_at"]})
    # Sugestão: o primeiro mapa nunca praticado; depois, o de pior resultado.
    fresh = [i for i in items if i["sessions"] == 0]
    nxt = fresh[0] if fresh else min(items, key=lambda i: (i["best_score"], i["order"]))
    return {"maps": items, "next_map_id": nxt["id"], "practiced": sum(1 for i in items if i["sessions"]), "total": len(items),
            "mastered": sum(1 for i in items if i["best_score"] >= 0.8 and i["rebuilt"])}


async def complete(db: AsyncSession, user: User, m: dict, *, mode: str, results: list[dict], duration_seconds: int) -> dict:
    by_id = {leaf["id"]: leaf for leaf in leaves(m)}
    added = reviewed = 0
    for r in results:
        leaf = by_id.get(r["leaf_id"])
        if leaf is None:
            continue
        card, created = await card_for_phrase(db, user, leaf, source="mind_map", domain=m["track"])
        added += int(created)
        await vocab_service.review(db, user, card, r["rating"], None, "mind_map")
        reviewed += 1
    good = sum(1 for r in results if r["rating"] >= 3 and r["leaf_id"] in by_id)
    score = round(good / reviewed, 3) if reviewed else 0.0
    db.add(ActivityLog(user_id=user.id, language=LANGUAGE, activity_type="mind_map", duration_seconds=duration_seconds,
                       score=score, skills=["vocabulary", "speaking"], details={"map_id": m["id"], "mode": mode}))
    await db.flush()
    return {"reviewed": reviewed, "added": added, "score": score, "overview": await overview(db, user)}
