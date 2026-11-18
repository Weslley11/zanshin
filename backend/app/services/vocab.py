"""Vocabulário inteligente com repetição espaçada (FSRS) e recuperação ativa."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content.en_vocab import PRONUNCIATION_EN, VOCAB_EN
from app.content.india import VOCAB_EN_INDIA
from app.content.other_languages import VOCAB_BY_LANGUAGE
from app.db import utcnow
from app.models import LearnerProfile, ReviewLog, User, UserCard, VocabItem
from app.services.fsrs import CardState, FSRSScheduler, Rating, retrievability, suggest_rating
from app.services.text_utils import answer_matches

scheduler = FSRSScheduler()


def _seed_rows() -> list[dict]:
    rows = []
    for term, kind, meaning, example, domain, cefr, rank in VOCAB_EN + VOCAB_EN_INDIA:
        rows.append({"language": "en", "term": term, "kind": kind, "meaning_pt": meaning, "examples": [{"text": example}],
                     "domain": domain, "cefr": cefr, "frequency_rank": rank, "pronunciation": PRONUNCIATION_EN.get(term, "")})
    for lang, items in VOCAB_BY_LANGUAGE.items():
        for term, kind, meaning, example, domain, cefr, rank, pron in items:
            rows.append({"language": lang, "term": term, "kind": kind, "meaning_pt": meaning, "examples": [{"text": example}],
                         "domain": domain, "cefr": cefr, "frequency_rank": rank, "pronunciation": pron})
    for r in rows:
        r["seed_key"] = f"{r['language']}:{r['term']}"[:120]
    return rows


async def seed_vocab(db: AsyncSession) -> int:
    existing = set((await db.execute(select(VocabItem.seed_key).where(VocabItem.seed_key.is_not(None)))).scalars())
    added = 0
    for row in _seed_rows():
        if row["seed_key"] in existing:
            continue
        db.add(VocabItem(source="seed", **row))
        added += 1
    await db.commit()
    return added


def accepted_answers(term: str) -> list[str]:
    """Variações aceitas para um termo: 'fillet / chamfer', 'follow up (on)', 'It depends on…'."""
    base = re.sub(r"\s*\([^)]*\)", "", term).replace("…", "").strip(" .?!")
    variants = {term.strip(), base}
    for part in re.split(r"\s*/\s*", base):
        if part.strip():
            variants.add(part.strip(" .?!"))
    paren = re.findall(r"\(([^)]*)\)", term)
    for p in paren:  # 'bill of materials (BOM)' aceita 'BOM'
        if len(p) <= 12 and "," not in p:
            variants.add(p.strip())
    return [v for v in variants if v]


def cloze(example: str, term: str) -> str:
    for variant in sorted(accepted_answers(term), key=len, reverse=True):
        pattern = re.compile(re.escape(variant), re.IGNORECASE)
        if pattern.search(example):
            return pattern.sub("_____", example, count=1)
    return example


def _priority(item: VocabItem, focus_domains: list[str]) -> int:
    p = 10_000 - item.frequency_rank
    if item.domain in focus_domains or (item.kind == "technical" and "engineering" in focus_domains):
        p += 300
    if item.domain == "india" and "india" in focus_domains:
        p += 600  # destino Índia: expressões do inglês indiano entram cedo
    if item.source in ("error", "tutor", "document"):
        p += 2_000  # o que o próprio usuário precisou/errou vem primeiro
    return p


async def enroll(db: AsyncSession, user: User, language: str, focus_domains: list[str] | None = None) -> int:
    focus = focus_domains or []
    have = set((await db.execute(select(UserCard.vocab_item_id).where(UserCard.user_id == user.id))).scalars())
    items = (await db.execute(
        select(VocabItem).where(VocabItem.language == language,
                                (VocabItem.owner_user_id.is_(None)) | (VocabItem.owner_user_id == user.id))
    )).scalars().all()
    n = 0
    for item in items:
        if item.id in have:
            continue
        db.add(UserCard(user_id=user.id, vocab_item_id=item.id, language=language, priority=_priority(item, focus)))
        n += 1
    await db.flush()
    return n


async def reprioritize(db: AsyncSession, user: User, language: str, focus_domains: list[str]) -> None:
    """Recalcula a prioridade dos cartões ainda não introduzidos (ex.: após mudar o destino da viagem)."""
    cards = (await db.execute(select(UserCard).where(UserCard.user_id == user.id, UserCard.language == language,
                                                     UserCard.state == "new"))).scalars().all()
    for c in cards:
        await db.refresh(c, ["item"])
        c.priority = _priority(c.item, focus_domains)
    await db.flush()


def priority_domains(profile) -> list[str]:
    """Domínios que recebem prioridade: áreas profissionais + destino da viagem."""
    domains = list(profile.focus_domains or [])
    if getattr(profile, "trip_destination", None) == "IN":
        domains.append("india")
    return domains


async def add_personal_item(
    db: AsyncSession, user: User, *, language: str, term: str, meaning_pt: str, example: str = "",
    kind: str = "phrase", source: str = "user", domain: str = "general", definition: str = "",
) -> UserCard | None:
    """Cria item pessoal (do tutor, de erro, de documento ou manual) e o cartão FSRS correspondente."""
    term = term.strip()[:200]
    if not term:
        return None
    dup = (await db.execute(
        select(VocabItem).where(VocabItem.owner_user_id == user.id, VocabItem.language == language,
                                func.lower(VocabItem.term) == term.lower())
    )).scalar_one_or_none()
    if dup is not None:
        return None
    item = VocabItem(language=language, term=term, kind=kind, meaning_pt=meaning_pt[:500], definition=definition[:500],
                     examples=[{"text": example[:300]}] if example else [], domain=domain, source=source,
                     owner_user_id=user.id, frequency_rank=100)
    db.add(item)
    await db.flush()
    card = UserCard(user_id=user.id, vocab_item_id=item.id, language=language, priority=_priority(item, []))
    db.add(card)
    await db.flush()
    return card


def _to_state(card: UserCard) -> CardState:
    return CardState(state=card.state, step=card.step, stability=card.stability, difficulty=card.difficulty,
                     due=card.due, last_review=card.last_review, reps=card.reps, lapses=card.lapses)


def card_view(card: UserCard, now: datetime | None = None) -> dict:
    now = now or utcnow()
    item = card.item
    example = item.examples[0]["text"] if item.examples else ""
    preview = {str(k): round(v.total_seconds() / 86400, 3) for k, v in scheduler.preview(_to_state(card), now).items()}
    return {
        "card_id": str(card.id),
        "state": card.state,
        "due": card.due.isoformat(),
        "reps": card.reps,
        "item": {"id": str(item.id), "term": item.term, "kind": item.kind, "meaning_pt": item.meaning_pt,
                 "example": example, "pronunciation": item.pronunciation, "domain": item.domain, "cefr": item.cefr,
                 "source": item.source, "definition": item.definition},
        "prompt": {"meaning_pt": item.meaning_pt,
                   "cloze": cloze(example, item.term) if example and item.kind != "correction" else ""},
        "intervals_days": preview,
    }


async def session_cards(db: AsyncSession, user: User, language: str, limit: int = 20) -> dict:
    now = utcnow()
    due = (await db.execute(
        select(UserCard).where(UserCard.user_id == user.id, UserCard.language == language,
                               UserCard.state != "new", UserCard.due <= now)
        .order_by(UserCard.due).limit(limit)
    )).scalars().all()

    profile = (await db.execute(select(LearnerProfile).where(LearnerProfile.user_id == user.id,
                                                             LearnerProfile.language == language))).scalar_one_or_none()
    per_day = profile.new_cards_per_day if profile else 12
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    introduced_today = (await db.execute(
        select(func.count()).select_from(UserCard).where(UserCard.user_id == user.id, UserCard.language == language,
                                                         UserCard.introduced_at >= start_of_day)
    )).scalar_one()
    new_quota = max(0, min(per_day - introduced_today, limit - len(due)))
    new = []
    if new_quota:
        new = (await db.execute(
            select(UserCard).where(UserCard.user_id == user.id, UserCard.language == language, UserCard.state == "new")
            .order_by(UserCard.priority.desc()).limit(new_quota)
        )).scalars().all()

    cards = list(due) + list(new)
    for c in cards:
        await db.refresh(c, ["item"])
    return {"cards": [card_view(c, now) for c in cards], "due_count": len(due), "new_count": len(new),
            "new_remaining_today": max(0, per_day - introduced_today - len(new))}


async def get_user_card(db: AsyncSession, user: User, card_id: uuid.UUID) -> UserCard | None:
    card = (await db.execute(select(UserCard).where(UserCard.id == card_id, UserCard.user_id == user.id))).scalar_one_or_none()
    if card is not None:
        await db.refresh(card, ["item"])
    return card


def check_answer(card: UserCard, answer: str, response_ms: int | None) -> dict:
    accepted = accepted_answers(card.item.term)
    correct, sim, target = answer_matches(answer, accepted)
    rating = suggest_rating(correct, sim, response_ms)
    return {"correct": correct, "similarity": round(sim, 3), "expected": card.item.term, "closest": target,
            "suggested_rating": int(rating)}


async def review(
    db: AsyncSession, user: User, card: UserCard, rating: int, response_ms: int | None = None, mode: str = "recall_text"
) -> dict:
    now = utcnow()
    state_before = card.state
    outcome = scheduler.review(_to_state(card), Rating(rating), now)
    c = outcome.card
    if card.state == "new":
        card.introduced_at = now
    card.state, card.step, card.stability, card.difficulty = c.state, c.step, c.stability, c.difficulty
    card.due, card.last_review, card.reps, card.lapses = c.due, c.last_review, c.reps, c.lapses
    db.add(ReviewLog(user_id=user.id, card_id=card.id, rating=rating, state_before=state_before,
                     retrievability=outcome.retrievability_before, scheduled_days=outcome.interval.total_seconds() / 86400,
                     response_ms=response_ms, mode=mode, reviewed_at=now))
    await db.flush()
    return {"card_id": str(card.id), "state": card.state, "due": card.due.isoformat(),
            "interval_days": round(outcome.interval.total_seconds() / 86400, 3),
            "stability": round(card.stability or 0, 3), "difficulty": round(card.difficulty or 0, 3)}


async def stats(db: AsyncSession, user: User, language: str) -> dict:
    now = utcnow()
    cards = (await db.execute(select(UserCard).where(UserCard.user_id == user.id, UserCard.language == language))).scalars().all()
    by_state: dict[str, int] = {}
    retained = 0
    r_values = []
    for c in cards:
        by_state[c.state] = by_state.get(c.state, 0) + 1
        if c.state == "review" and c.stability and c.last_review:
            r = retrievability(c.stability, (now - c.last_review).days)
            r_values.append(r)
            if r >= 0.85:
                retained += 1
    since = now - timedelta(days=30)
    logs = (await db.execute(
        select(ReviewLog.rating, ReviewLog.state_before).join(UserCard, UserCard.id == ReviewLog.card_id)
        .where(ReviewLog.user_id == user.id, UserCard.language == language, ReviewLog.reviewed_at >= since)
    )).all()
    review_logs = [r for r in logs if r.state_before == "review"]
    true_retention = (sum(1 for r in review_logs if r.rating > 1) / len(review_logs)) if review_logs else None
    due_now = sum(1 for c in cards if c.state != "new" and c.due <= now)
    return {
        "total": len(cards),
        "by_state": by_state,
        "learned": by_state.get("review", 0),
        "retained_estimate": retained,
        "mean_retrievability": round(sum(r_values) / len(r_values), 3) if r_values else None,
        "true_retention_30d": round(true_retention, 3) if true_retention is not None else None,
        "reviews_30d": len(logs),
        "due_now": due_now,
        "note_pt": "‘Retidas’ = itens em revisão com probabilidade estimada de lembrança ≥ 85% hoje (modelo FSRS).",
    }
