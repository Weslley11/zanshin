"""Preparação para a Índia: compreensão do inglês indiano no plano, no tutor e no conteúdo."""

from __future__ import annotations

from datetime import date

from app.content.en_listening import LISTENING_EN
from app.content.india import LISTENING_INDIA, SCENARIOS_INDIA, VOCAB_EN_INDIA, variety_guide
from app.content.scenarios import SCENARIOS
from app.services import planner
from app.services.tutor_prompts import build_system_prompt
from tests.conftest import FakeLLM, auth, register, setup_profile

API = "/api/v1"
LST = {x["id"]: x for x in LISTENING_EN}
SCN = {s["id"]: s for s in SCENARIOS}


def test_india_content_is_consistent():
    assert all(x["accents"] == ["IN"] and x["country"] == "IN" for x in LISTENING_INDIA)
    for x in LISTENING_INDIA:
        for q in x["questions"]:
            assert 0 <= q["answer"] < len(q["options"])
    for s in SCENARIOS_INDIA:
        assert s["country"] == "IN" and s["unexpected_events"] and s["goals"]
        assert all(c["accent"] == "IN" for c in s["characters"])
    terms = {t[0] for t in VOCAB_EN_INDIA}
    assert {"do the needful", "prepone", "lakh", "crore", "revert (back)"} <= terms
    guide = variety_guide("in")
    assert guide["numbers"]["table"][0]["value"] == 100_000 and guide["pronunciation"] and guide["culture"]
    assert variety_guide("US") is None


def test_plan_prioritizes_indian_english_when_destination_is_india():
    days = planner.generate(start=date(2026, 11, 10), total_days=90, daily_minutes=45, destination="IN")
    lst = [a["params"]["listening_id"] for d in days for a in d.activities if a["type"] == "listening"]
    share_in = sum("IN" in LST[i]["accents"] for i in lst) / len(lst)
    assert share_in >= 0.6
    by_phase = {}
    for d in days:
        for a in d.activities:
            if a["type"] == "scenario":
                by_phase.setdefault(d.phase, []).append(SCN[a["params"]["scenario_id"]].get("country") == "IN")
    shares = [sum(v) / len(v) for _, v in sorted(by_phase.items())]
    assert shares[0] >= 0.4 and shares[2] >= shares[0]
    conv = [a for d in days for a in d.activities if a["type"] == "conversation"]
    assert all(a["params"]["accent"] == "IN" for a in conv)

    neutral = planner.generate(start=date(2026, 11, 10), total_days=90, daily_minutes=45)
    scen = [a["params"]["scenario_id"] for d in neutral for a in d.activities if a["type"] == "scenario"]
    assert not any(SCN[s].get("country") == "IN" for s in scen)  # sem destino, nada de cenários na Índia


def test_tutor_prompt_switches_to_indian_english():
    p = build_system_prompt(language="en", mode="natural", level="B1", profile={"trip_destination": "IN"}, memory={},
                            scenario=None, settings={"accent": "IN"})
    assert "Indian English" in p and "India" in p and "do the needful" in p
    p_uk = build_system_prompt(language="en", mode="natural", level="B1", profile={}, memory={}, scenario=None,
                               settings={"accent": "UK"})
    assert "British English" in p_uk and "do the needful" not in p_uk


async def test_profile_with_india_destination_end_to_end(app_factory):
    llm = FakeLLM()
    _app, client = await app_factory(llm=llm)
    async with client:
        h = auth(await register(client))
        prof = await setup_profile(client, h, trip_destination="IN")
        assert prof["trip_destination"] == "IN" and prof["preferred_accents"][0] == "IN"

        # vocabulário: expressões do inglês indiano entram entre os primeiros cartões novos
        session = (await client.get(f"{API}/vocab/session?limit=12", headers=h)).json()
        assert any(c["item"]["kind"] == "indian_english" for c in session["cards"])

        # plano: insight do destino, meta extra e conteúdo indiano
        plan = (await client.post(f"{API}/plans", json={"language": "en"}, headers=h)).json()
        assert plan["insights"][0]["signal"] == "destination_india"
        goals_p2 = plan["phases"]["2"]["measurable_goals_pt"] if "2" in plan["phases"] else plan["phases"][2]["measurable_goals_pt"]
        assert any("indianos" in g for g in goals_p2)

        # tutor: sotaque padrão vem do destino e o prompt inclui o inglês indiano
        s = (await client.post(f"{API}/tutor/sessions", json={"mode": "natural"}, headers=h)).json()
        assert s["settings"]["accent"] == "IN"
        assert "Indian English" in llm.calls[-1]["system"]

        # rotas de conteúdo
        guide = (await client.get(f"{API}/varieties/IN")).json()
        assert guide["title_pt"] == "Inglês da Índia"
        india_sc = (await client.get(f"{API}/scenarios?country=IN")).json()
        assert len(india_sc) == len(SCENARIOS_INDIA)
        qr = (await client.get(f"{API}/drills/quick-response?destination=IN&level=B1")).json()
        assert any(q["theme"] == "india" for q in qr["questions"])
        ev = (await client.post(f"{API}/drills/quick-response/evaluate", headers=h, json={
            "question_id": "qr-in-4", "answer": "That is 1.2 million rupees", "latency_ms": 3000, "time_limit_ms": 8000})).json()
        assert ev["in_time"]

        # mudar o destino reprioriza o vocabulário
        prof2 = await setup_profile(client, h, trip_destination="US", preferred_accents=[])
        assert prof2["preferred_accents"][0] == "US"
