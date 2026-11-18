"""Missão Índia: integridade do conteúdo, API (lista, missão personalizada, conclusão → FSRS) e plano."""

from __future__ import annotations

from datetime import date

from app.content.india_missions import MISSIONS, first_name, personalize
from app.services import planner
from app.services.text_utils import answer_matches
from tests.conftest import auth, register, setup_profile

API = "/api/v1"


def test_mission_content_is_consistent():
    ids: set[str] = set()
    for i, m in enumerate(MISSIONS, start=1):
        assert m["order"] == i and m["id"] == f"m{i:02d}"
        assert len(m["chunks"]) >= 8 and len(m["listen"]) >= 3 and len(m["dialog"]["turns"]) >= 3
        for c in m["chunks"]:
            assert c["id"].startswith(m["id"] + "-") and c["id"] not in ids
            ids.add(c["id"])
            assert c["kind"] in ("say", "hear") and c["en"].strip() and c["pt"].strip()
            # a forma principal e as variações precisam ser aceitas pelo próprio corretor
            accepted = [c["en"], *c.get("alts", [])]
            for alt in accepted:
                assert answer_matches(personalize(alt, "Ana"), personalize(accepted, "Ana"))[0], alt
        for q in m["listen"]:
            assert q["id"] not in ids
            ids.add(q["id"])
            assert 0 <= q["answer"] < len(q["options_pt"]) and q["say"].strip()
        for t in m["dialog"]["turns"]:
            assert t["say"] and t["hint_pt"] and t["model"] and t["keywords"]
            # a resposta-modelo precisa passar no critério de palavras-chave
            assert any(k in personalize(t["model"], "Ana").lower() for k in t["keywords"]), t["model"]
    assert sum(len(m["chunks"]) for m in MISSIONS) >= 120


def test_personalize_uses_first_name():
    assert first_name("Ana Souza") == "Ana" and first_name("") == "Alex"
    m = personalize(MISSIONS[0], "Ana")
    assert "Ana" in m["chunks"][0]["en"] and "{name}" not in str(m)


def test_plan_includes_missions_only_for_india():
    days = planner.generate(start=date(2026, 11, 17), total_days=84, daily_minutes=45, destination="IN")
    missions = [a for d in days for a in d.activities if a["type"] == "india_mission"]
    assert [a["params"]["mission_id"] for a in missions[:len(MISSIONS)]] == [m["id"] for m in MISSIONS]
    first_round = [d.day_index for d in days for a in d.activities if a["type"] == "india_mission"][:len(MISSIONS)]
    assert first_round[-1] <= 30  # com 45 min/dia, todas as missões cabem no primeiro mês
    assert all(10 <= a["minutes"] <= 15 for a in missions)
    plain = planner.generate(start=date(2026, 11, 17), total_days=84, daily_minutes=45)
    assert not any(a["type"] == "india_mission" for d in plain for a in d.activities)


async def test_mission_flow(client):
    h = auth(await register(client))
    await setup_profile(client, h, trip_destination="IN")

    ov = (await client.get(f"{API}/india/missions", headers=h)).json()
    assert ov["total"] == len(MISSIONS) and ov["completed"] == 0 and ov["next_mission_id"] == "m01"

    m = (await client.get(f"{API}/india/missions/m01", headers=h)).json()
    assert "I'm Ana, from Brazil" in m["chunks"][0]["en"]
    assert (await client.get(f"{API}/india/missions/nope", headers=h)).status_code == 404

    # plano com a missão no dia em que ela aparece
    plan = (await client.post(f"{API}/plans", json={"language": "en"}, headers=h)).json()
    assert plan["id"]
    day, act = None, None
    for i in range(1, 8):
        d = (await client.get(f"{API}/plans/current/days/{i}?language=en", headers=h)).json()
        act = next((a for a in d["activities"] if a["type"] == "india_mission"), None)
        if act:
            day = i
            break
    assert act and act["params"]["mission_id"] == "m01"

    results = [{"chunk_id": c["id"], "rating": 3 if i % 3 else 1} for i, c in enumerate(m["chunks"])]
    r = await client.post(f"{API}/india/missions/m01/complete", headers=h, json={
        "results": results, "score": 0.8, "duration_seconds": 600, "details": {"listen_correct": 3, "nested": {"x": 1}},
        "plan_day": day, "plan_activity_id": act["id"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["reviewed"] == len(results) and body["added"] >= 1
    assert body["overview"]["completed"] == 1 and body["overview"]["next_mission_id"] == "m02"
    assert any(a["id"] == act["id"] and a["done"] for a in body["plan_day"]["activities"])

    # as frases agora estão na revisão espaçada, sem duplicar ao repetir a missão
    stats1 = (await client.get(f"{API}/vocab/stats?language=en", headers=h)).json()
    r2 = (await client.post(f"{API}/india/missions/m01/complete", headers=h, json={
        "results": results, "score": 1.0, "duration_seconds": 300})).json()
    assert r2["added"] == 0
    stats2 = (await client.get(f"{API}/vocab/stats?language=en", headers=h)).json()
    assert stats1 == stats2 or stats1.get("total") == stats2.get("total")

    bad = await client.post(f"{API}/india/missions/m01/complete", headers=h, json={
        "results": [{"chunk_id": "m01-c01", "rating": 9}], "score": 1, "duration_seconds": 1})
    assert bad.status_code == 422
