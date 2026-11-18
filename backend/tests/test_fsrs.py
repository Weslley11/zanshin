import random
from datetime import UTC, datetime, timedelta

import pytest

from app.services.fsrs import CardState, FSRSScheduler, Rating, State, retrievability, suggest_rating

NOW = datetime(2026, 1, 1, 12, tzinfo=UTC)


def test_retrievability_at_stability_is_90_percent():
    assert retrievability(10.0, 10.0) == pytest.approx(0.9)
    assert retrievability(10.0, 0) == pytest.approx(1.0)
    assert retrievability(10.0, 30) < retrievability(10.0, 20)


def test_new_card_learning_steps():
    s = FSRSScheduler()
    o = s.review(CardState(), Rating.GOOD, NOW)
    assert o.card.state == State.LEARNING and o.card.step == 1
    assert o.interval == timedelta(minutes=10)
    o2 = s.review(o.card, Rating.GOOD, NOW + timedelta(minutes=10))
    assert o2.card.state == State.REVIEW and o2.interval >= timedelta(days=1)
    easy = s.review(CardState(), Rating.EASY, NOW)
    assert easy.card.state == State.REVIEW and easy.interval.days >= 1


def test_review_interval_ordering_and_lapse():
    s = FSRSScheduler()
    card = s.review(CardState(), Rating.EASY, NOW).card
    later = card.due + timedelta(days=1)
    ivl = {r: s.review(card, r, later).interval for r in Rating}
    assert ivl[Rating.AGAIN] < ivl[Rating.HARD] <= ivl[Rating.GOOD] <= ivl[Rating.EASY]
    lapsed = s.review(card, Rating.AGAIN, later).card
    assert lapsed.state == State.RELEARNING and lapsed.lapses == 1
    assert lapsed.stability < card.stability


def test_naive_datetime_rejected():
    with pytest.raises(ValueError):
        FSRSScheduler().review(CardState(), Rating.GOOD, datetime(2026, 1, 1))


def test_matches_reference_implementation():
    ref = pytest.importorskip("fsrs")
    rng = random.Random(42)
    mine, theirs = FSRSScheduler(), ref.Scheduler(enable_fuzzing=False)
    for _ in range(200):
        now = NOW
        c1, c2 = CardState(), ref.Card()
        for _ in range(10):
            r = rng.choice([1, 2, 3, 3, 3, 4])
            c1 = mine.review(c1, Rating(r), now).card
            c2, _log = theirs.review_card(c2, ref.Rating(r), now)
            assert c1.stability == pytest.approx(c2.stability, abs=1e-9)
            assert c1.difficulty == pytest.approx(c2.difficulty, abs=1e-9)
            assert c1.due == c2.due
            now = c1.due + timedelta(hours=rng.choice([0, 2, 30, 300]))


def test_suggest_rating():
    assert suggest_rating(False, 0.2, 2000) == Rating.AGAIN
    assert suggest_rating(True, 1.0, 2000) == Rating.EASY
    assert suggest_rating(True, 1.0, 6000) == Rating.GOOD
    assert suggest_rating(True, 0.9, 3000) == Rating.HARD
    assert suggest_rating(True, 1.0, 20000) == Rating.HARD


def test_fuzz_stays_within_bounds():
    s = FSRSScheduler(enable_fuzzing=True)
    card = s.review(CardState(), Rating.EASY, NOW).card
    for _ in range(50):
        o = s.review(card, Rating.GOOD, card.due + timedelta(days=3))
        assert 1 <= o.interval.days <= s.maximum_interval
