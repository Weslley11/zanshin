"""Motor adaptativo: identifica padrões de dificuldade e ajusta a proporção de atividades.

Regras transparentes (cada ajuste gera uma explicação mostrada ao usuário). Os objetivos de
cada fase do plano não mudam — apenas a dosagem de atividades.
"""

from __future__ import annotations

import statistics
from collections import Counter
from dataclasses import dataclass, field
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import utcnow
from app.models import ActivityLog, ConversationSession, ErrorRecord, LearnerProfile, User
from app.services import vocab as vocab_service

SUBTYPE_LABELS_PT = {
    "present_perfect": "present perfect (I have worked…)", "for_since": "for × since", "third_person": "3ª pessoa (-s, doesn't, has)",
    "did_base_form": "passado com did/didn't", "past_participle": "particípio (have gone/done)", "preposition": "preposições",
    "modal_base_form": "verbos modais", "uncountable": "substantivos incontáveis", "dummy_subject": "sujeito obrigatório (It is…)",
    "collocation": "collocations (make/do, ask a question)", "agreement": "concordância", "comparative": "comparativos",
    "word_order": "ordem das palavras", "verb_tense": "tempos verbais", "question_form": "formação de perguntas",
}


@dataclass
class Signals:
    skill_scores: dict = field(default_factory=dict)
    listening_accuracy_14d: float | None = None
    quick_response_latency_ms: float | None = None
    conversation_words_per_turn: float | None = None
    conversation_latency_ms: float | None = None
    error_subtypes: dict[str, int] = field(default_factory=dict)
    vocab_true_retention: float | None = None


@dataclass
class Adjustment:
    multipliers: dict[str, float]
    insights: list[dict]


def compute_adjustments(s: Signals) -> Adjustment:
    m: dict[str, float] = {}
    insights: list[dict] = []

    def bump(t: str, f: float) -> None:
        m[t] = round(m.get(t, 1.0) * f, 3)

    sc = s.skill_scores
    reading, listening = sc.get("reading"), sc.get("listening")
    if reading is not None and listening is not None and reading - listening >= 12:
        bump("listening", 1.4)
        bump("shadowing", 1.2)
        insights.append({"signal": "reading_gt_listening",
                         "finding_pt": f"Sua leitura ({reading:.0f}) está bem acima da compreensão auditiva ({listening:.0f}).",
                         "action_pt": "Aumentamos listening com sotaques variados e shadowing para conectar som e escrita."})
    if s.listening_accuracy_14d is not None and s.listening_accuracy_14d < 0.65:
        bump("listening", 1.25)
        insights.append({"signal": "low_listening_practice",
                         "finding_pt": f"Acerto recente em listening: {s.listening_accuracy_14d:.0%}.",
                         "action_pt": "Mais exercícios de listening em velocidade reduzida, com ditado de trechos-chave."})

    vocab_s, speaking = sc.get("vocabulary"), sc.get("speaking")
    slow = s.quick_response_latency_ms is not None and s.quick_response_latency_ms > 5000
    if slow or (vocab_s is not None and speaking is not None and vocab_s - speaking >= 10):
        bump("quick_response", 1.5)
        bump("think_in_english", 1.3)
        bump("conversation", 1.2)
        detail = f" (tempo médio de resposta: {s.quick_response_latency_ms / 1000:.1f} s)" if slow else ""
        insights.append({"signal": "knows_but_slow",
                         "finding_pt": f"Você conhece o vocabulário, mas a resposta oral ainda é lenta{detail}.",
                         "action_pt": "Mais Quick Response e Think in English para recuperar palavras sem tradução mental."})

    recurring = {k: v for k, v in s.error_subtypes.items() if v >= 3}
    if recurring:
        bump("error_review", 1.6)
        bump("sentence_building", 1.3)
        top = sorted(recurring.items(), key=lambda kv: -kv[1])[:3]
        names = ", ".join(SUBTYPE_LABELS_PT.get(k, k) for k, _ in top)
        insights.append({"signal": "recurring_errors", "focus": [k for k, _ in top],
                         "finding_pt": f"Erros recorrentes: {names}.",
                         "action_pt": "Inserimos revisões contextualizadas desses pontos e construção de frases com eles."})

    if (vocab_s is not None and vocab_s < 45) or (s.vocab_true_retention is not None and s.vocab_true_retention < 0.8):
        bump("vocab_review", 1.3)
        insights.append({"signal": "vocab_retention",
                         "finding_pt": "Vocabulário ou retenção abaixo do ideal.",
                         "action_pt": "Mais tempo de revisão espaçada (com recuperação ativa) no início das sessões."})

    pron = sc.get("pronunciation")
    if pron is not None and pron < 50:
        bump("shadowing", 1.4)
        insights.append({"signal": "pronunciation", "finding_pt": "Inteligibilidade da pronúncia pode melhorar.",
                         "action_pt": "Mais shadowing focado em ritmo e connected speech (sotaque não é penalizado)."})

    if s.conversation_words_per_turn is not None and s.conversation_words_per_turn < 6:
        bump("sentence_building", 1.2)
        bump("conversation", 1.1)
        insights.append({"signal": "short_turns",
                         "finding_pt": f"Suas falas nas conversas são curtas (média de {s.conversation_words_per_turn:.1f} palavras).",
                         "action_pt": "Treinos de expansão de frases (quando, por quê, contraste, próximo passo)."})
    return Adjustment(multipliers=m, insights=insights)


async def collect_signals(db: AsyncSession, user: User, language: str) -> Signals:
    now = utcnow()
    profile = (await db.execute(select(LearnerProfile).where(LearnerProfile.user_id == user.id,
                                                             LearnerProfile.language == language))).scalar_one_or_none()
    logs = (await db.execute(select(ActivityLog).where(ActivityLog.user_id == user.id, ActivityLog.language == language,
                                                       ActivityLog.started_at >= now - timedelta(days=14)))).scalars().all()
    lst = [log.score for log in logs if log.activity_type == "listening" and log.score is not None]
    lat = [log.details.get("latency_ms") for log in logs if log.activity_type == "quick_response" and log.details.get("latency_ms")]

    sessions = (await db.execute(select(ConversationSession).where(
        ConversationSession.user_id == user.id, ConversationSession.language == language,
        ConversationSession.ended_at.is_not(None), ConversationSession.started_at >= now - timedelta(days=14)))).scalars().all()
    wpt = [s.metrics.get("avg_words_per_turn") for s in sessions if s.metrics.get("avg_words_per_turn")]
    clat = [s.metrics.get("avg_response_latency_ms") for s in sessions if s.metrics.get("avg_response_latency_ms")]

    errs = (await db.execute(select(ErrorRecord.subtype, ErrorRecord.occurrences).where(
        ErrorRecord.user_id == user.id, ErrorRecord.language == language, ErrorRecord.resolved.is_(False),
        ErrorRecord.last_seen_at >= now - timedelta(days=30)))).all()
    counts: Counter[str] = Counter()
    for subtype, occ in errs:
        if subtype:
            counts[subtype] += occ

    vstats = await vocab_service.stats(db, user, language)
    return Signals(
        skill_scores=dict(profile.skill_scores) if profile else {},
        listening_accuracy_14d=statistics.mean(lst) if len(lst) >= 3 else None,
        quick_response_latency_ms=statistics.median(lat) if len(lat) >= 5 else None,
        conversation_words_per_turn=statistics.mean(wpt) if wpt else None,
        conversation_latency_ms=statistics.mean(clat) if clat else None,
        error_subtypes=dict(counts),
        vocab_true_retention=vstats["true_retention_30d"] if vstats["reviews_30d"] >= 30 else None,
    )
