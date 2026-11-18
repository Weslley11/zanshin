"""Trilha (curso gamificado): progresso, XP, sequência de dias e entrada dos itens na revisão espaçada."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content.course import DAILY_GOAL_OPTIONS, LESSONS, ORDER, UNITS, xp_for
from app.content.india_missions import first_name, personalize
from app.db import utcnow
from app.models import ActivityLog, User
from app.services import vocab as vocab_service
from app.services.missions import card_for_phrase

LANGUAGE = "en"
_ITEMS = {i["id"]: i for u in UNITS for i in u["items"]}


async def _logs(db: AsyncSession, user: User) -> list[ActivityLog]:
    return list((await db.execute(select(ActivityLog).where(ActivityLog.user_id == user.id,
                                                            ActivityLog.activity_type == "lesson"))).scalars())


def _streak(days: set[date], today: date) -> int:
    start = today if today in days else today - timedelta(days=1)
    n = 0
    while start - timedelta(days=n) in days:
        n += 1
    return n


def summarize(logs: list[ActivityLog], today: date) -> dict:
    best: dict[str, float] = {}
    xp_total = xp_today = 0
    days: set[date] = set()
    for log in logs:
        d = log.details or {}
        lid = d.get("lesson_id")
        if lid:
            best[lid] = max(best.get(lid, 0.0), log.score or 0.0)
        xp = int(d.get("xp", 0))
        xp_total += xp
        day = log.started_at.date()
        days.add(day)
        if day == today:
            xp_today += xp
    current = next((lid for lid in ORDER if lid not in best), None)
    units = []
    for u in UNITS:
        lessons = []
        for lesson in u["lessons"]:
            lid = lesson["id"]
            status = "done" if lid in best else "current" if lid == current else "locked"
            lessons.append({"id": lid, "kind": lesson["kind"], "title_pt": lesson["title_pt"], "item_count": len(lesson["item_ids"]),
                            "status": status, "best_score": round(best.get(lid, 0.0), 3)})
        units.append({"id": u["id"], "order": u["order"], "title_pt": u["title_pt"], "icon": u["icon"], "levels": u["levels"],
                      "lessons": lessons, "done": sum(1 for x in lessons if x["status"] == "done")})
    return {"units": units, "current_lesson_id": current, "xp_total": xp_total, "xp_today": xp_today,
            "streak_days": _streak(days, today), "lessons_done": len(best), "total_lessons": len(ORDER),
            "daily_goal_options": DAILY_GOAL_OPTIONS}


async def overview(db: AsyncSession, user: User) -> dict:
    return summarize(await _logs(db, user), utcnow().date())


def lesson_for(user: User, lesson_id: str) -> dict | None:
    lesson = LESSONS.get(lesson_id)
    if lesson is None:
        return None
    k = next(i for i, u in enumerate(UNITS) if u["id"] == lesson["unit_id"])
    unit = UNITS[k]
    # distratores: itens da unidade e das vizinhas (mesmo tema/nível)
    pool = [i for u in UNITS[max(0, k - 1):k + 2] for i in u["items"] if i["id"] not in lesson["item_ids"]]
    name = first_name(user.display_name)
    return personalize({"id": lesson_id, "kind": lesson["kind"], "title_pt": lesson["title_pt"], "unit_id": unit["id"],
                        "unit_title_pt": unit["title_pt"], "unit_order": unit["order"],
                        "items": [_ITEMS[i] for i in lesson["item_ids"]],
                        "pool": [{"id": i["id"], "en": i["en"], "pt": i["pt"]} for i in pool]}, name)


async def complete(db: AsyncSession, user: User, lesson: dict, *, results: list[dict], correct_first: int, total: int,
                   duration_seconds: int) -> dict:
    items = {i["id"]: i for i in lesson["items"]}
    reviewed = 0
    for r in results:
        item = items.get(r["item_id"])
        if item is None:
            continue
        card, _ = await card_for_phrase(db, user, item)
        await vocab_service.review(db, user, card, r["rating"], None, "lesson")
        reviewed += 1
    total = max(1, total)
    xp = xp_for(correct_first, total)
    db.add(ActivityLog(user_id=user.id, language=LANGUAGE, activity_type="lesson", duration_seconds=duration_seconds,
                       score=min(1.0, correct_first / total), skills=["vocabulary", "grammar", "listening"],
                       details={"lesson_id": lesson["id"], "xp": xp, "correct_first": correct_first, "total": total}))
    await db.flush()
    ov = await overview(db, user)
    return {"xp": xp, "perfect": correct_first >= total, "reviewed": reviewed, "xp_today": ov["xp_today"], "xp_total": ov["xp_total"],
            "streak_days": ov["streak_days"], "next_lesson_id": ov["current_lesson_id"], "lessons_done": ov["lessons_done"],
            "total_lessons": ov["total_lessons"]}
