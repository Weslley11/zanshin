"""Implementação do FSRS-5 (Free Spaced Repetition Scheduler).

Fórmulas conforme a especificação pública do projeto open-spaced-repetition
(https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm) e com os parâmetros
padrão do FSRS-5. A suíte de testes compara esta implementação, passo a passo, com a biblioteca
de referência `fsrs` (py-fsrs 4.x) para garantir equivalência.

Mantemos uma implementação própria (pura, sem I/O) para controlar persistência, logs e
testes; a otimização dos 19 parâmetros por usuário pode ser feita offline com o
`fsrs-optimizer` a partir da tabela `review_logs`.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from enum import IntEnum

DECAY = -0.5
FACTOR = 0.9 ** (1 / DECAY) - 1  # = 19/81

DEFAULT_PARAMETERS: tuple[float, ...] = (
    0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
    1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
)  # fmt: skip

_FUZZ_RANGES = ((2.5, 7.0, 0.15), (7.0, 20.0, 0.1), (20.0, math.inf, 0.05))


class Rating(IntEnum):
    AGAIN = 1
    HARD = 2
    GOOD = 3
    EASY = 4


class State:
    NEW = "new"
    LEARNING = "learning"
    REVIEW = "review"
    RELEARNING = "relearning"


@dataclass(frozen=True)
class CardState:
    state: str = State.NEW
    step: int | None = None
    stability: float | None = None
    difficulty: float | None = None
    due: datetime | None = None
    last_review: datetime | None = None
    reps: int = 0
    lapses: int = 0


@dataclass(frozen=True)
class ReviewOutcome:
    card: CardState
    retrievability_before: float | None
    interval: timedelta


def retrievability(stability: float, elapsed_days: float) -> float:
    """Probabilidade estimada de lembrar após `elapsed_days` dias, dado S."""
    return (1 + FACTOR * max(0.0, elapsed_days) / stability) ** DECAY


@dataclass
class FSRSScheduler:
    parameters: tuple[float, ...] = DEFAULT_PARAMETERS
    desired_retention: float = 0.9
    learning_steps: tuple[timedelta, ...] = (timedelta(minutes=1), timedelta(minutes=10))
    relearning_steps: tuple[timedelta, ...] = (timedelta(minutes=10),)
    maximum_interval: int = 36500
    enable_fuzzing: bool = False

    def __post_init__(self) -> None:
        if len(self.parameters) != 19:
            raise ValueError("FSRS-5 requer 19 parâmetros")
        if not 0.7 <= self.desired_retention <= 0.97:
            raise ValueError("desired_retention deve estar entre 0.70 e 0.97")

    # ---- fórmulas -----------------------------------------------------------------
    def initial_stability(self, rating: Rating) -> float:
        return max(self.parameters[rating - 1], 0.1)

    def initial_difficulty(self, rating: Rating) -> float:
        w = self.parameters
        return _clamp(w[4] - math.exp(w[5] * (rating - 1)) + 1, 1.0, 10.0)

    def next_difficulty(self, difficulty: float, rating: Rating) -> float:
        w = self.parameters
        delta = -w[6] * (rating - 3)
        damped = difficulty + (10.0 - difficulty) * delta / 9.0  # linear damping
        reverted = w[7] * self.initial_difficulty(Rating.EASY) + (1 - w[7]) * damped  # mean reversion
        return _clamp(reverted, 1.0, 10.0)

    def short_term_stability(self, stability: float, rating: Rating) -> float:
        w = self.parameters
        return stability * math.exp(w[17] * (rating - 3 + w[18]))

    def recall_stability(self, d: float, s: float, r: float, rating: Rating) -> float:
        w = self.parameters
        hard_penalty = w[15] if rating == Rating.HARD else 1.0
        easy_bonus = w[16] if rating == Rating.EASY else 1.0
        return s * (
            1
            + math.exp(w[8]) * (11 - d) * math.pow(s, -w[9]) * (math.exp((1 - r) * w[10]) - 1)
            * hard_penalty * easy_bonus
        )  # fmt: skip

    def forget_stability(self, d: float, s: float, r: float) -> float:
        w = self.parameters
        long_term = w[11] * math.pow(d, -w[12]) * (math.pow(s + 1, w[13]) - 1) * math.exp((1 - r) * w[14])
        short_term_cap = s / math.exp(w[17] * w[18])
        return min(long_term, short_term_cap)

    def next_interval_days(self, stability: float) -> int:
        ivl = (stability / FACTOR) * (self.desired_retention ** (1 / DECAY) - 1)
        return min(max(round(ivl), 1), self.maximum_interval)

    # ---- revisão -------------------------------------------------------------------
    def review(self, card: CardState, rating: Rating, now: datetime | None = None) -> ReviewOutcome:
        now = now or datetime.now(UTC)
        if now.tzinfo is None:
            raise ValueError("datetime precisa ter fuso horário (UTC)")
        rating = Rating(rating)

        state = card.state
        step = card.step
        s, d = card.stability, card.difficulty
        days_since = (now - card.last_review).days if card.last_review else None
        r_before = (
            retrievability(s, (now - card.last_review).days) if (s and card.last_review) else None
        )
        lapses = card.lapses

        if state == State.NEW:
            state, step = State.LEARNING, 0

        # 1) atualizar S e D
        if s is None or d is None:
            s, d = self.initial_stability(rating), self.initial_difficulty(rating)
        elif days_since is not None and days_since < 1:
            s, d = self.short_term_stability(s, rating), self.next_difficulty(d, rating)
        else:
            r = r_before if r_before is not None else 0.0
            if rating == Rating.AGAIN:
                s = self.forget_stability(d, s, r)
            else:
                s = self.recall_stability(d, s, r, rating)
            d = self.next_difficulty(d, rating)

        # 2) estado e intervalo
        interval: timedelta
        if state in (State.LEARNING, State.RELEARNING):
            steps = self.learning_steps if state == State.LEARNING else self.relearning_steps
            assert step is not None
            if len(steps) == 0 or step > len(steps):
                state, step = State.REVIEW, None
                interval = timedelta(days=self.next_interval_days(s))
            elif rating == Rating.AGAIN:
                step = 0
                interval = steps[0]
            elif rating == Rating.HARD:
                if step == 0 and len(steps) == 1:
                    interval = steps[0] * 1.5
                elif step == 0 and len(steps) >= 2:
                    interval = (steps[0] + steps[1]) / 2.0
                else:
                    interval = steps[step]
            elif rating == Rating.GOOD:
                if step + 1 == len(steps):
                    state, step = State.REVIEW, None
                    interval = timedelta(days=self.next_interval_days(s))
                else:
                    step += 1
                    interval = steps[step]
            else:  # EASY
                state, step = State.REVIEW, None
                interval = timedelta(days=self.next_interval_days(s))
        else:  # REVIEW
            if rating == Rating.AGAIN:
                lapses += 1
                if len(self.relearning_steps) == 0:
                    interval = timedelta(days=self.next_interval_days(s))
                else:
                    state, step = State.RELEARNING, 0
                    interval = self.relearning_steps[0]
            else:
                interval = timedelta(days=self.next_interval_days(s))

        if self.enable_fuzzing and state == State.REVIEW:
            interval = self._fuzz(interval)

        new_card = replace(
            card,
            state=state,
            step=step,
            stability=s,
            difficulty=d,
            due=now + interval,
            last_review=now,
            reps=card.reps + 1,
            lapses=lapses,
        )
        return ReviewOutcome(card=new_card, retrievability_before=r_before, interval=interval)

    def preview(self, card: CardState, now: datetime | None = None) -> dict[int, timedelta]:
        """Intervalo resultante para cada nota (útil para mostrar nos botões)."""
        now = now or datetime.now(UTC)
        return {int(r): self.review(card, r, now).interval for r in Rating}

    def _fuzz(self, interval: timedelta) -> timedelta:
        days = interval.days
        if days < 2.5:
            return interval
        delta = 1.0
        for start, end, factor in _FUZZ_RANGES:
            delta += factor * max(min(days, end) - start, 0.0)
        lo = max(2, int(round(days - delta)))
        hi = min(int(round(days + delta)), self.maximum_interval)
        lo = min(lo, hi)
        return timedelta(days=min(round(random.random() * (hi - lo + 1) + lo), self.maximum_interval))


def _clamp(x: float, lo: float, hi: float) -> float:
    return min(max(x, lo), hi)


def suggest_rating(correct: bool, similarity: float, response_ms: int | None) -> Rating:
    """Sugere uma nota a partir de uma recuperação ativa (o usuário pode alterar).

    - errado → Again
    - correto mas com pequenas falhas ou lento (> 12 s) → Hard
    - correto e rápido (< 4 s) → Easy
    - demais → Good
    """
    if not correct:
        return Rating.AGAIN
    if similarity < 0.97 or (response_ms is not None and response_ms > 12_000):
        return Rating.HARD
    if response_ms is not None and response_ms < 4_000:
        return Rating.EASY
    return Rating.GOOD
