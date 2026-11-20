"""Sistema integrado: plano com Turbo, mapas, missões Índia + EUA e medidor de fala semanal; API do medidor."""

from __future__ import annotations

from datetime import date

from app.services import planner
from app.services.speaking import speaking_metrics
from tests.conftest import auth, register, setup_profile

API = "/api/v1"


def _types(days):
    return [a["type"] for d in days for a in d.activities]


def test_plan_integrates_everything_for_india_and_us():
    days = planner.generate(start=date(2026, 11, 20), total_days=90, daily_minutes=45, destination="IN", extra_destinations=["US"])
    types = _types(days)
    for t in ("turbo", "mind_map", "india_mission", "us_mission", "speaking_check"):
        assert t in types, t
    # medidor de fala toda semana, no começo do dia, sempre com 5 min
    checks = [(d.day_index, a) for d in days for a in d.activities if a["type"] == "speaking_check"]
    assert [day for day, _ in checks] == list(range(7, 91, 7))
    assert all(a["minutes"] == 5 for _, a in checks)
    for d in days:
        assert sum(a["minutes"] for a in d.activities) == 45
    # mapas alternam aprender e reconstruir o mesmo mapa; destinos primeiro
    maps = [a["params"] for d in days for a in d.activities if a["type"] == "mind_map"]
    assert maps[0]["mode"] == "learn" and maps[1] == {**maps[0], "mode": "rebuild"}
    assert maps[0]["map_id"] in ("mm06", "mm07", "mm08")
    us = [a["params"]["mission_id"] for d in days for a in d.activities if a["type"] == "us_mission"]
    assert us[:6] == [f"w0{i}" for i in range(1, 7)]


def test_plan_without_destination_and_other_language():
    plain = _types(planner.generate(start=date(2026, 11, 20), total_days=60, daily_minutes=30))
    assert "turbo" in plain and "mind_map" in plain and "us_mission" not in plain and "india_mission" not in plain
    es = _types(planner.generate(start=date(2026, 11, 20), total_days=60, daily_minutes=30, language="es"))
    assert "mind_map" not in es and "turbo" in es
    us_only = planner.generate(start=date(2026, 11, 20), total_days=45, daily_minutes=40, destination="US")
    first_map = next(a for d in us_only for a in d.activities if a["type"] == "mind_map")
    assert first_map["params"]["map_id"] in ("mm07", "mm08")


def test_speaking_metrics():
    m = speaking_metrics("Um, I think the machine stops. Não sei, the sensor!", 30)
    assert m["words"] == 10 and m["wpm"] == 20 and m["fillers"] == 1 and m["pt_words"] == 1 and m["seconds"] == 30
    assert speaking_metrics("", 60)["wpm"] == 0 and speaking_metrics("hello there", 2)["seconds"] == 10


async def test_profile_extra_destinations_and_plan(client):
    h = auth(await register(client))
    await setup_profile(client, h, trip_destination="IN", extra_destinations=["US", "IN"])
    me = (await client.get(f"{API}/me", headers=h)).json()
    assert me["profiles"][0]["extra_destinations"] == ["US"]
    plan = (await client.post(f"{API}/plans", json={"language": "en"}, headers=h)).json()
    assert [i["signal"] for i in plan["insights"][:2]] == ["destination_india", "destination_us"]
    goals = plan["phases"]["1"]["measurable_goals_pt"]
    assert any("Wisconsin" in g for g in goals) and any("Índia" in g for g in goals)


async def test_speaking_api(client):
    h = auth(await register(client))
    await setup_profile(client, h)
    ov = (await client.get(f"{API}/speaking", headers=h)).json()
    assert ov["summary"] is None and ov["prompt"]["id"] == "sc01" and ov["real"]["total_minutes"] == 0
    r = await client.post(f"{API}/speaking/checks", headers=h, json={"prompt_id": "sc01", "transcript": "I work as an engineer. I like my job.",
                                                                      "seconds": 30, "confidence": 3})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["metrics"]["words"] == 9 and body["metrics"]["wpm"] == 18
    r2 = (await client.post(f"{API}/speaking/checks", headers=h, json={"prompt_id": "sc02", "transcript": "First I check my email, then I walk "
                            "to the plant and talk to the team about the daily targets.", "seconds": 30, "confidence": 4})).json()
    s = r2["overview"]["summary"]
    assert s["checks"] == 2 and s["change_wpm"] == s["last_wpm"] - 18 > 0 and r2["overview"]["prompt"]["id"] == "sc03"
    assert (await client.post(f"{API}/speaking/checks", headers=h, json={"prompt_id": "zz", "transcript": "x", "seconds": 60,
                                                                          "confidence": 3})).status_code == 422
    real = (await client.post(f"{API}/speaking/real", headers=h, json={"minutes": 20, "partner": "us"})).json()
    assert real["real"]["week_minutes"] == 20 and real["real"]["by_partner"]["us"] == 20
    assert (await client.post(f"{API}/speaking/real", headers=h, json={"minutes": 20, "partner": "xx"})).status_code == 422
