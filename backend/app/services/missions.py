"""Missão Índia: progresso por missão e entrada das frases aprendidas na revisão espaçada (FSRS)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content.india_missions import MISSIONS, first_name, mission_summary, personalize
from app.models import ActivityLog, User, UserCard, VocabItem
from app.services import plans as plan_service
from app.services import vocab as vocab_service

LANGUAGE = "en"


async def _progress(db: AsyncSession, user: User) -> dict[str, dict]:
    logs = (await db.execute(select(ActivityLog).where(ActivityLog.user_id == user.id,
                                                       ActivityLog.activity_type == "india_mission"))).scalars().all()
    progress: dict[str, dict] = {}
    for log in logs:
        mid = (log.details or {}).get("mission_id")
        if not mid:
            continue
        p = progress.setdefault(mid, {"completions": 0, "best_score": 0.0, "last_at": None})
        p["completions"] += 1
        p["best_score"] = max(p["best_score"], log.score or 0.0)
        at = log.started_at.isoformat()
        if p["last_at"] is None or at > p["last_at"]:
            p["last_at"] = at
    return progress


async def overview(db: AsyncSession, user: User) -> dict:
    progress = await _progress(db, user)
    items = []
    for m in MISSIONS:
        p = progress.get(m["id"], {"completions": 0, "best_score": 0.0, "last_at": None})
        items.append(mission_summary(m) | {"completed": p["completions"] > 0, "completions": p["completions"],
                                           "best_score": round(p["best_score"], 3), "last_at": p["last_at"]})
    pending = [i for i in items if not i["completed"]]
    # Próxima: a primeira não concluída; com tudo concluído, a de pior resultado (para revisar).
    nxt = pending[0] if pending else min(items, key=lambda i: (i["best_score"], i["order"]))
    done = [i for i in items if i["completed"]]
    return {"missions": items, "next_mission_id": nxt["id"], "completed": len(done), "total": len(items),
            "phrases_learned": sum(i["chunk_count"] for i in done)}


def mission_for(user: User, mission_id: str) -> dict | None:
    m = next((x for x in MISSIONS if x["id"] == mission_id), None)
    return personalize(m, first_name(user.display_name)) if m else None


async def card_for_phrase(db: AsyncSession, user: User, chunk: dict) -> tuple[UserCard, bool]:
    """Reaproveita o cartão se a frase já existir (conteúdo base ou pessoal); senão cria um item pessoal."""
    card = (await db.execute(
        select(UserCard).join(VocabItem, UserCard.vocab_item_id == VocabItem.id)
        .where(UserCard.user_id == user.id, VocabItem.language == LANGUAGE, func.lower(VocabItem.term) == chunk["en"].lower())
    )).scalars().first()
    if card is not None:
        await db.refresh(card, ["item"])
        return card, False
    card = await vocab_service.add_personal_item(db, user, language=LANGUAGE, term=chunk["en"], meaning_pt=chunk["pt"],
                                                 kind="phrase", source="mission", domain="india",
                                                 definition=chunk.get("note_pt", ""))
    await db.refresh(card, ["item"])
    return card, True


async def complete(db: AsyncSession, user: User, mission: dict, *, results: list[dict], score: float,
                   duration_seconds: int, details: dict, plan_day: int | None, plan_activity_id: str | None) -> dict:
    chunks = {c["id"]: c for c in mission["chunks"]}
    added = reviewed = 0
    for r in results:
        chunk = chunks.get(r["chunk_id"])
        if chunk is None:
            continue
        card, created = await card_for_phrase(db, user, chunk)
        added += int(created)
        await vocab_service.review(db, user, card, r["rating"], None, "mission")
        reviewed += 1
    db.add(ActivityLog(user_id=user.id, language=LANGUAGE, activity_type="india_mission", duration_seconds=duration_seconds,
                       score=score, skills=["vocabulary", "speaking", "listening"],
                       details={"mission_id": mission["id"], **{k: details[k] for k in list(details)[:10]}}))
    day = None
    if plan_day and plan_activity_id:
        plan = await plan_service.current_plan(db, user, LANGUAGE)
        if plan:
            d = await plan_service.complete_activity(db, plan, plan_day, plan_activity_id)
            day = plan_service.day_view(d) if d else None
    await db.flush()
    return {"reviewed": reviewed, "added": added, "plan_day": day, "overview": await overview(db, user)}
