"""Guia "Como eles falam": integridade do conteúdo e treino de ouvido → FSRS."""

from __future__ import annotations

from app.content.speech_guide import GUIDES, guide_items
from tests.conftest import auth, register

API = "/api/v1"


def test_guide_content_is_consistent():
    ids: set[str] = set()
    assert [g["code"] for g in GUIDES] == ["IN", "US"]
    for g in GUIDES:
        assert g["intro_pt"] and len(g["accents"]) >= 3 and len(g["listening_tips"]) >= 3
        assert [s["id"] for s in g["sections"]] == ["pron", "daily", "slang", "style"]
        for s in g["sections"]:
            assert len(s["items"]) >= 8 and s["intro_pt"]
        for i in guide_items(g):
            assert i["id"] not in ids and len(i["id"]) <= 20
            ids.add(i["id"])
            assert i["en"].strip() and i["pt"].strip() and i["note_pt"].strip()
            assert "{" not in i["en"]
        # cada seção tem significados distintos o bastante para o quiz de 3 opções
        for s in g["sections"]:
            assert len({i["pt"] for i in s["items"]}) == len(s["items"])
    assert len(ids) >= 80


async def test_guide_quiz_flow(client):
    h = auth(await register(client))
    ov = (await client.get(f"{API}/guides", headers=h)).json()
    assert [g["code"] for g in ov["guides"]] == ["IN", "US"] and ov["guides"][0]["sessions"] == 0
    g = (await client.get(f"{API}/guides/us", headers=h)).json()
    assert g["code"] == "US" and g["sections"][0]["items"][0]["fast"]
    assert (await client.get(f"{API}/guides/xx", headers=h)).status_code == 404
    items = guide_items(g)[:6]
    r = await client.post(f"{API}/guides/US/complete", headers=h, json={
        "results": [{"item_id": i["id"], "rating": 3 if k % 2 else 1} for k, i in enumerate(items)], "duration_seconds": 120})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["reviewed"] == 6 and body["added"] == 6 and body["score"] == 0.5
    us = next(x for x in body["overview"]["guides"] if x["code"] == "US")
    assert us["sessions"] == 1 and us["best_score"] == 0.5
