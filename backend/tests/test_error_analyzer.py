import pytest

from app.services.error_analyzer import analyze, analyze_english, correct_text

POSITIVE = [
    ("I am agree with you.", "I agree with you.", "am_agree"),
    ("It depends of the budget.", "It depends on the budget.", "depend_of"),
    ("I work here since 5 years.", "I have been working here for 5 years.", "present_since"),
    ("I have 35 years.", "I am 35 years old.", "have_age"),
    ("Can I make a question?", "Can I ask a question?", "make_question"),
    ("I did a mistake yesterday.", "I made a mistake yesterday.", "do_mistake"),
    ("The people is very friendly.", "The people are very friendly.", "people_is"),
    ("He don't like coffee.", "He doesn't like coffee.", "third_person_dont"),
    ("She have two kids.", "She has two kids.", "third_person_have"),
    ("I have went to London.", "I have gone to London.", "have_past"),
    ("I didn't went to the office.", "I didn't go to the office.", "did_past"),
    ("He can goes now.", "He can go now.", "modal_s"),
    ("Do you can help me?", "Can you help me?", "do_you_can"),
    ("It is more easy than I thought.", "It is easier than I thought.", "more_comparative"),
    ("I need some informations.", "I need some information.", "uncountable_plural"),
    ("I assisted the meeting yesterday.", "I attended the meeting yesterday.", "assist_event"),
    ("I pretend to travel next year.", "I intend to travel next year.", "pretend_to"),
    ("I lost my flight.", "I missed my flight.", "lose_flight"),
    ("I have a doubt about the drawing.", "I have a question about the drawing.", "have_doubt"),
    ("Let's discuss about the deadline.", "Let's discuss the deadline.", "discuss_about"),
    ("We arrived to the hotel.", "We arrived at the hotel.", "arrive_to"),
    ("Is possible to change the date?", "Is it possible to change the date?", "dummy_subject"),
    ("Is necessary to sign here.", "It is necessary to sign here.", "dummy_subject"),
    ("I like very much the new office.", "I like the new office very much.", "like_very_much"),
    ("How do you call this part?", "What do you call this part?", "how_call"),
    ("We realized a test on the line.", "We carried out a test on the line.", "realize_event"),
    ("I born in 1990.", "I was born in 1990.", "born"),
]

NEGATIVE = [
    "I have 15 years of experience.",
    "Does she have a car?",
    "I need more good examples.",
    "He pretended to be sick.",
    "I lost my passport.",
    "Is it possible?",
    "Actually, I think it's fine.",
    "I realized the problem.",
    "Did you finish the report?",
    "I've been working here since 2019.",
    "I agree with you.",
    "Why does he have to leave?",
    "She researches new materials.",
    "The managers don't agree.",
]


@pytest.mark.parametrize(("text", "expected", "rule"), POSITIVE)
def test_detects_and_corrects(text, expected, rule):
    found = {c.rule_id for c in analyze_english(text)}
    assert rule in found
    assert correct_text(text) == expected


@pytest.mark.parametrize("text", NEGATIVE)
def test_no_false_positives(text):
    assert analyze_english(text) == []


def test_correction_metadata():
    c = analyze_english("I assisted the meeting.")[0]
    assert c.category == "false_friend" and c.severity == "may_confuse" and "attend" in c.explanation_pt


def test_spanish_false_friends_and_unsupported_languages():
    assert analyze("La comida estaba exquisita y el polvo…", "es")[0].category == "false_friend"
    assert analyze("Ciao, come stai?", "it") == []


def test_feedback_eval_baseline_for_rules():
    """Linha de base do harness de avaliação (evals/feedback_eval.py): regras não podem regredir."""
    from evals.feedback_eval import load_cases, run_rules, score

    cases = load_cases()
    covered = [c for c in cases if c.get("rule_covered", True)]
    report = score(covered, run_rules(covered))
    assert report["recall"] >= 0.9
    assert report["false_positive_rate"] == 0.0
