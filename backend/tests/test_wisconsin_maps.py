"""Missão Wisconsin (EUA) e mapas mentais: integridade do conteúdo e fluxo da API (→ FSRS)."""

from __future__ import annotations

from app.content.india_missions import MISSIONS
from app.content.mind_maps import MAPS, leaves
from app.content.us_missions import MISSIONS_US
from app.services.text_utils import answer_matches
from tests.conftest import auth, register

API = "/api/v1"


def test_us_mission_content_is_consistent():
    ids = {c["id"] for m in MISSIONS for c in m["chunks"]}
    for i, m in enumerate(MISSIONS_US, start=1):
        assert m["order"] == i and m["id"] == f"w{i:02d}" and m["track"] == "us" and m["accent"] == "US"
        assert len(m["chunks"]) >= 8 and len(m["listen"]) >= 3 and len(m["dialog"]["turns"]) >= 3
        for c in m["chunks"]:
            assert c["id"].startswith(m["id"] + "-") and c["id"] not in ids
            ids.add(c["id"])
            assert c["kind"] in ("say", "hear") and c["en"].strip() and c["pt"].strip()
            accepted = [c["en"], *c.get("alts", [])]
            for alt in accepted:
                assert answer_matches(alt, accepted)[0], alt
        for q in m["listen"]:
            assert 0 <= q["answer"] < len(q["options_pt"]) and q["say"].strip()
        for t in m["dialog"]["turns"]:
            assert any(k in t["model"].lower() for k in t["keywords"]), t["model"]
    assert all(m["track"] == "india" for m in MISSIONS)


def test_mind_map_content_is_consistent():
    ids: set[str] = set()
    for i, m in enumerate(MAPS, start=1):
        assert m["order"] == i and m["id"] == f"mm{i:02d}"
        assert m["track"] in ("work", "travel", "india", "us") and m["center_en"] and m["center_pt"]
        assert len(m["branches"]) == 4
        for b in m["branches"]:
            assert b["id"].startswith(m["id"] + "-") and b["en"] and b["pt"] and b["icon"]
            assert 3 <= len(b["leaves"]) <= 4
        for leaf in leaves(m):
            assert leaf["id"] not in ids and leaf["en"].strip() and leaf["pt"].strip() and len(leaf["id"]) <= 20
            ids.add(leaf["id"])
    assert len(ids) >= 90
    assert {m["track"] for m in MAPS} >= {"india", "us"}


async def test_us_missions_flow(client):
    h = auth(await register(client))
    ov = (await client.get(f"{API}/india/missions?track=us", headers=h)).json()
    assert ov["track"] == "us" and ov["total"] == len(MISSIONS_US) and ov["next_mission_id"] == "w01"
    assert all(m["accent"] == "US" for m in ov["missions"])
    assert (await client.get(f"{API}/india/missions?track=xx", headers=h)).status_code == 422
    india = (await client.get(f"{API}/india/missions", headers=h)).json()
    assert india["track"] == "india" and india["total"] == len(MISSIONS)

    m = (await client.get(f"{API}/india/missions/w03", headers=h)).json()
    assert m["accent"] == "US"
    r = await client.post(f"{API}/india/missions/w03/complete", headers=h, json={
        "results": [{"chunk_id": c["id"], "rating": 3} for c in m["chunks"]], "score": 0.9, "duration_seconds": 600})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["added"] == len(m["chunks"]) and body["overview"]["track"] == "us" and body["overview"]["completed"] == 1
    # a Missão Índia continua intacta
    assert (await client.get(f"{API}/india/missions", headers=h)).json()["completed"] == 0


async def test_mind_map_flow(client):
    h = auth(await register(client))
    ov = (await client.get(f"{API}/maps", headers=h)).json()
    assert ov["total"] == len(MAPS) and ov["practiced"] == 0 and ov["next_map_id"] == "mm01"
    assert (await client.get(f"{API}/maps/nope", headers=h)).status_code == 404

    m = (await client.get(f"{API}/maps/mm07", headers=h)).json()
    ls = leaves(m)
    results = [{"leaf_id": leaf["id"], "rating": 3 if k % 4 else 1} for k, leaf in enumerate(ls)]
    r = await client.post(f"{API}/maps/mm07/complete", headers=h, json={"mode": "rebuild", "results": results, "duration_seconds": 420})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["reviewed"] == len(ls) and body["added"] == len(ls) and body["score"] == 0.75
    mm = next(x for x in body["overview"]["maps"] if x["id"] == "mm07")
    assert mm["sessions"] == 1 and mm["rebuilt"] and body["overview"]["practiced"] == 1

    # repetir não duplica cartões
    r2 = (await client.post(f"{API}/maps/mm07/complete", headers=h,
                            json={"mode": "recall", "results": results[:3], "duration_seconds": 60})).json()
    assert r2["added"] == 0 and r2["reviewed"] == 3
    bad = await client.post(f"{API}/maps/mm07/complete", headers=h, json={"mode": "xx", "results": [], "duration_seconds": 1})
    assert bad.status_code == 422
