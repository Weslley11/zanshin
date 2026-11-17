"""Trilha (curso gamificado): estrutura, XP, desbloqueio, sequência de dias e revisão espaçada."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from app.content.course import LESSON_SIZE, LESSONS, ORDER, UNITS, xp_for
from app.content.india_missions import personalize
from app.models import ActivityLog
from app.services.course import summarize
from app.services.text_utils import answer_matches
from tests.conftest import auth, register, setup_profile

API = "/api/v1"


def test_course_structure():
    assert len(UNITS) >= 30 and len(ORDER) == len(LESSONS)
    ids: set[str] = set()
    for u in UNITS:
        assert u["lessons"][-1]["kind"] == "review" and set(u["lessons"][-1]["item_ids"]) == {i["id"] for i in u["items"]}
        for lesson in u["lessons"][:-1]:
            assert 3 <= len(lesson["item_ids"]) <= LESSON_SIZE + 2
        for i in u["items"]:
            assert i["id"] not in ids and i["en"].strip() and i["pt"].strip()
            ids.add(i["id"])
            accepted = personalize([i["en"], *i["alts"]], "Ana")
            assert answer_matches(personalize(i["en"], "Ana"), accepted)[0]
    assert len(ids) >= 300


def test_xp_rules():
    assert xp_for(10, 10) == 10 + 10 + 5
    assert xp_for(7, 11) == 17
    assert xp_for(0, 11) == 10


def test_streak_and_unlock_summary():
    today = date(2026, 11, 17)

    def log(day: date, lid: str, xp: int) -> ActivityLog:
        return ActivityLog(activity_type="lesson", started_at=datetime(day.year, day.month, day.day, 12, tzinfo=UTC),
                           score=1.0, details={"lesson_id": lid, "xp": xp})

    s = summarize([log(today - timedelta(days=2), ORDER[0], 20), log(today - timedelta(days=1), ORDER[1], 15),
                   log(today, ORDER[2], 12)], today)
    assert s["streak_days"] == 3 and s["xp_today"] == 12 and s["xp_total"] == 47
    assert s["current_lesson_id"] == ORDER[3]
    statuses = [x["status"] for u in s["units"] for x in u["lessons"]]
    assert statuses[:4] == ["done", "done", "done", "current"] and set(statuses[4:]) == {"locked"}
    # sem lição hoje, a sequência continua até o fim do dia (conta até ontem)
    assert summarize([log(today - timedelta(days=1), ORDER[0], 10)], today)["streak_days"] == 1
    assert summarize([log(today - timedelta(days=3), ORDER[0], 10)], today)["streak_days"] == 0


async def test_course_flow(client):
    h = auth(await register(client))
    await setup_profile(client, h)
    ov = (await client.get(f"{API}/course", headers=h)).json()
    assert ov["current_lesson_id"] == ORDER[0] and ov["xp_total"] == 0 and ov["lessons_done"] == 0

    lesson = (await client.get(f"{API}/course/lessons/{ORDER[0]}", headers=h)).json()
    assert len(lesson["items"]) == len(LESSONS[ORDER[0]]["item_ids"]) and len(lesson["pool"]) >= 10
    assert (await client.get(f"{API}/course/lessons/zz", headers=h)).status_code == 404

    m = (await client.get(f"{API}/course/lessons/u02-l1", headers=h)).json()
    assert "{name}" not in str(m) and any("Ana" in i["en"] for i in m["items"])

    results = [{"item_id": i["id"], "rating": 3} for i in lesson["items"]]
    r = (await client.post(f"{API}/course/lessons/{ORDER[0]}/complete", headers=h,
                           json={"results": results, "correct_first": 11, "total": 11, "duration_seconds": 180})).json()
    assert r["xp"] == 25 and r["perfect"] and r["xp_today"] == 25 and r["streak_days"] == 1
    assert r["next_lesson_id"] == ORDER[1] and r["reviewed"] == len(results)

    stats = (await client.get(f"{API}/vocab/stats?language=en", headers=h)).json()
    assert stats
    bad = await client.post(f"{API}/course/lessons/{ORDER[1]}/complete", headers=h,
                            json={"results": [{"item_id": "x", "rating": 7}], "correct_first": 1, "total": 1, "duration_seconds": 1})
    assert bad.status_code == 422
