"""Exporta o conteúdo pedagógico (fonte única: backend/app/content) para o app funcionar sem servidor.

Gera:
  mobile/src/content/content.json            — conteúdo consumido pelo modo local (PWA/offline)
  mobile/src/lib/local/__tests__/parity.json — fixtures de paridade Python ↔ TypeScript

Uso: cd backend && uv run python scripts/export_content.py [--check]
Com --check, falha se os arquivos versionados estiverem desatualizados (usado no CI).
"""

from __future__ import annotations

import json
import random
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.content import drills, en_assessment, en_listening, india, languages, other_languages, scenarios  # noqa: E402
from app.services import planner  # noqa: E402
from app.services.assessment import estimate_level, score_item  # noqa: E402
from app.services.error_analyzer import analyze_english, correct_text  # noqa: E402
from app.services.fsrs import CardState, FSRSScheduler, Rating  # noqa: E402
from app.services.speech_metrics import shadowing_feedback  # noqa: E402
from app.services.text_utils import answer_matches, normalize, word_error_rate  # noqa: E402
from app.services.vocab import _seed_rows, accepted_answers, cloze  # noqa: E402

CONTENT_OUT = ROOT / "mobile" / "src" / "content" / "content.json"
PARITY_OUT = ROOT / "mobile" / "src" / "lib" / "local" / "__tests__" / "parity.json"


def build_content() -> dict:
    return {
        "languages": languages.LANGUAGES,
        "cefr": {"levels": languages.CEFR_LEVELS, "anchors": languages.CEFR_SCORE_ANCHORS,
                 "descriptors_pt": languages.CEFR_DESCRIPTORS_PT},
        "skill_labels_pt": languages.SKILL_LABELS_PT,
        "vocab": _seed_rows(),
        "assessment": {"items": en_assessment.ITEMS_EN, "speaking": en_assessment.SPEAKING_PROMPTS_EN,
                       "self_assessment": en_assessment.SELF_ASSESSMENT_EN, "section_plan": en_assessment.SECTION_PLAN},
        "listening": en_listening.LISTENING_EN,
        "scenarios": scenarios.SCENARIOS,
        "drills": {
            "quick_response": drills.QUICK_RESPONSE_EN, "quick_response_india": india.QUICK_RESPONSE_INDIA,
            "quick_response_other": other_languages.QUICK_RESPONSE_OTHER,
            "sentence_building": drills.SENTENCE_BUILDING_EN, "think_in_english": drills.THINK_IN_ENGLISH_EN,
            "shadowing": drills.SHADOWING_EN, "shadowing_other": other_languages.SHADOWING_OTHER,
            "topics": drills.CONVERSATION_TOPICS_EN, "follow_ups": drills.FOLLOW_UPS_EN, "backchannels": drills.BACKCHANNELS_EN,
            "elaborate": drills.ELABORATE_EN, "transitions": drills.TOPIC_TRANSITIONS_EN,
        },
        "starter": {"hiragana": other_languages.HIRAGANA_BASIC, "katakana": other_languages.KATAKANA_BASIC,
                    "tone_pairs": other_languages.ZH_TONE_PAIRS},
        "india_guide": india.variety_guide("IN"),
        "planner": {"activity_info": planner.ACTIVITY_INFO, "phase_weights": planner.PHASE_WEIGHTS,
                    "phases": planner.PHASES, "week_themes": planner.WEEK_THEMES_PT, "destinations": planner.DESTINATIONS},
    }


def build_parity() -> dict:
    rng = random.Random(2026)
    sched = FSRSScheduler()
    fsrs_cases = []
    for _ in range(40):
        now = datetime(2026, 1, 1, 12, tzinfo=UTC)
        card = CardState()
        steps = []
        for _ in range(8):
            rating = rng.choice([1, 2, 3, 3, 3, 4])
            card = sched.review(card, Rating(rating), now).card
            steps.append({"rating": rating, "at": now.isoformat(), "state": card.state, "step": card.step,
                          "stability": card.stability, "difficulty": card.difficulty, "due": card.due.isoformat(),
                          "lapses": card.lapses})
            now = card.due + timedelta(hours=rng.choice([0, 3, 30, 200]))
        fsrs_cases.append(steps)

    sentences = [
        "I am agree with you.", "It depends of the budget.", "Can you explain me the process?", "I work here since 5 years.",
        "I have 35 years.", "I have 15 years of experience.", "Can I make a question?", "I did a mistake yesterday.",
        "We need to make a meeting tomorrow.", "The people is very friendly.", "He don't like coffee.", "Does she have a car?",
        "She have two kids.", "I have went to London.", "I didn't went to the office.", "He can goes now.", "I can to help you.",
        "Do you can help me?", "It is more easy than I thought.", "I need more good examples.", "I need some informations.",
        "I assisted the meeting yesterday.", "I pretend to travel next year.", "He pretended to be sick.", "I lost my flight.",
        "I lost my passport.", "I have a doubt about the drawing.", "Let's discuss about the deadline.", "We arrived to the hotel.",
        "Is possible to change the date?", "Is necessary to sign here.", "Is it possible?", "I like very much the new office.",
        "How do you call this part?", "I work at Embraer since 2019.", "Actually I work with SAP.", "Actually, I think it's fine.",
        "We realized a test on the line.", "I realized the problem.", "Did you finish the report?", "I will see you in the weekend.",
        "I born in 1990.", "I'm agree, but we need a decision. He have a meeting.", "Hi! I work here since 5 years as an engineer.",
        "Why does he have to leave?", "She researches new materials.", "The managers don't agree.",
    ]
    analyzer = [{"text": s, "rules": [c.rule_id for c in analyze_english(s)], "corrected": correct_text(s),
                 "explanations": [c.explanation_pt for c in analyze_english(s)]} for s in sentences]

    planner_cases = []
    for cfg in [dict(total_days=90, daily_minutes=45, learner_level="B1"),
                dict(total_days=60, daily_minutes=20, learner_level="A2", placement_done=True),
                dict(total_days=90, daily_minutes=90, learner_level="B2", destination="IN",
                     multipliers={"listening": 1.2, "shadowing": 1.1}),
                dict(total_days=75, daily_minutes=30, learner_level="B1", destination="IN", focus_domains=["engineering"])]:
        days = planner.generate(start=date(2026, 11, 10), **cfg)
        planner_cases.append({"config": cfg, "days": [
            {"day": d.day_index, "phase": d.phase, "focus": d.focus, "assessment": d.is_assessment_day,
             "activities": [[a["type"], a["minutes"], a["params"]] for a in d.activities]} for d in days]})

    matches = [(a, acc) for a, acc in [("bottlenek", ["bottleneck"]), ("the workaround", ["workaround"]), ("in", ["on"]),
                                         ("deadline", ["bottleneck"]), ("I'll look into it", ["I will look into it"]),
                                         ("make", ["make", "reach", "take"]), ("trade off", ["trade-off", "tradeoff"])]]
    shadow = [
        dict(reference="Could you say that again, please?", transcript="", duration=2.0),
        dict(reference="Could you say that again, please?", transcript="could you say that again please", duration=2.2),
        dict(reference="I'm gonna check with the team and get back to you.", transcript="I'm going to check with the tim and get back to you", duration=3.5),
        dict(reference="Kindly do the needful and revert by end of day.", transcript="kindly do the needful", duration=0.8),
    ]
    return {
        "fsrs": fsrs_cases,
        "analyzer": analyzer,
        "planner": planner_cases,
        "estimate_level": [{"acc": acc, "result": list(estimate_level(acc))} for acc in [
            {"A2": 1.0, "B1": 0.75, "B2": 0.25, "C1": 0.0}, {"A2": 0.5, "B1": 0.9}, {"A2": 1, "B1": 1, "B2": 1, "C1": 1},
            {"A2": 1, "B1": 0.5}, {"A2": 0.8, "B1": 0.6, "B2": 0.7, "C1": 0.3}]],
        "answer_matches": [{"answer": a, "accepted": acc, "result": list(answer_matches(a, acc))} for a, acc in matches],
        "normalize": [{"text": t, "result": normalize(t)} for t in ["I'm gonna CHECK it!", "We’ve done it — don't worry", "Olá, você está?"]],
        "wer": [{"ref": r, "hyp": h, "result": word_error_rate(r, h)} for r, h in [
            ("could you send me the file", "could you send the file"), ("is breakfast included", "is breakfast included")]],
        "score_item": [{"item": it, "response": resp, "result": score_item(it, resp)} for it, resp in [
            ({"type": "gap", "answer": ["bottleneck"]}, "botleneck"), ({"type": "mc", "answer": 2}, 2),
            ({"type": "dictation", "audio_text": "Could you send me the file?"}, "could you send the file")]],
        "accepted_answers": [{"term": t, "result": sorted(accepted_answers(t))} for t in
                             ["bill of materials (BOM)", "follow up (on)", "fillet / chamfer", "It depends on…"]],
        "cloze": [{"example": e, "term": t, "result": cloze(e, t)} for e, t in [
            ("The BOM is missing two fasteners.", "bill of materials (BOM)"), ("Let's touch base next week.", "touch base")]],
        "shadowing": [{"args": a, "result": {k: v for k, v in shadowing_feedback(**a).items()
                                             if k in ("status", "intelligibility", "missing_words", "substitutions")}} for a in shadow],
    }


def main() -> None:
    check = "--check" in sys.argv
    outputs = {CONTENT_OUT: build_content(), PARITY_OUT: build_parity()}
    stale = []
    for path, data in outputs.items():
        text = json.dumps(data, ensure_ascii=False, indent=1, sort_keys=False) + "\n"
        if check:
            if not path.exists() or path.read_text(encoding="utf-8") != text:
                stale.append(str(path.relative_to(ROOT)))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
            print(f"escrito: {path.relative_to(ROOT)} ({len(text) // 1024} KB)")
    if stale:
        raise SystemExit("Conteúdo exportado desatualizado; rode scripts/export_content.py: " + ", ".join(stale))


if __name__ == "__main__":
    main()
