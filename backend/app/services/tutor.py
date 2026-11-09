"""Orquestração do professor particular com IA: sessões, turnos, memória, relatório e caderno de erros."""

from __future__ import annotations

import logging
import statistics
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.base import AIError, ChatMessage
from app.ai.registry import Providers
from app.content.languages import LANGUAGES
from app.content.scenarios import get_scenario
from app.db import utcnow
from app.models import ActivityLog, ConversationSession, ConversationTurn, ErrorRecord, LearnerProfile, User
from app.services import offline_tutor, usage
from app.services import vocab as vocab_service
from app.services.error_analyzer import Correction, analyze
from app.services.text_utils import count_words, lexical_diversity, looks_portuguese
from app.services.tutor_prompts import REPORT_SCHEMA, TURN_SCHEMA, build_report_prompt, build_system_prompt

log = logging.getLogger(__name__)

MODES = {"natural", "immediate", "no_native", "quick_response", "scenario", "challenge"}
MAX_HISTORY_TURNS = 40
_START = "[The session has started. Open the conversation as instructed.]"


class TutorError(Exception):
    pass


async def _profile(db: AsyncSession, user: User, language: str) -> LearnerProfile | None:
    return (await db.execute(select(LearnerProfile).where(LearnerProfile.user_id == user.id,
                                                          LearnerProfile.language == language))).scalar_one_or_none()


async def _memory(db: AsyncSession, user: User, language: str) -> dict:
    """Memória entre sessões: tópicos recentes e erros recorrentes (para 'retomar assuntos anteriores')."""
    recent = (await db.execute(
        select(ConversationSession).where(ConversationSession.user_id == user.id, ConversationSession.language == language,
                                          ConversationSession.ended_at.is_not(None))
        .order_by(ConversationSession.ended_at.desc()).limit(3)
    )).scalars().all()
    topics = [t for s in recent for t in ((s.report or {}).get("topics") or [])][:6]
    errs = (await db.execute(
        select(ErrorRecord).where(ErrorRecord.user_id == user.id, ErrorRecord.language == language,
                                  ErrorRecord.resolved.is_(False))
        .order_by(ErrorRecord.occurrences.desc()).limit(4)
    )).scalars().all()
    return {"previous_topics": topics,
            "recurring_errors": [f"{e.subtype or e.category}: '{e.original[:60]}' → '{e.corrected[:60]}'" for e in errs]}


def _system_prompt(session: ConversationSession, profile: LearnerProfile | None, memory: dict) -> str:
    scenario = get_scenario(session.scenario_id) if session.scenario_id else None
    p = {"skill_scores": profile.skill_scores if profile else {}, "goals": profile.goals if profile else [],
         "focus_domains": profile.focus_domains if profile else [], "difficulties": profile.difficulties if profile else []}
    level = session.settings.get("level") or (profile.cefr_estimate if profile and profile.cefr_estimate else "B1")
    return build_system_prompt(language=session.language, mode=session.mode, level=level, profile=p, memory=memory,
                               scenario=scenario, settings=session.settings)


def _history(turns: list[ConversationTurn]) -> list[ChatMessage]:
    msgs: list[ChatMessage] = [ChatMessage("user", _START)]
    for t in turns[-MAX_HISTORY_TURNS:]:
        role = "assistant" if t.role == "assistant" else "user"
        if msgs and msgs[-1].role == role:
            msgs[-1] = ChatMessage(role, msgs[-1].content + "\n" + t.text)
        else:
            msgs.append(ChatMessage(role, t.text))
    return msgs


async def _llm_turn(db: AsyncSession, user: User, providers: Providers, session: ConversationSession,
                    turns: list[ConversationTurn], profile: LearnerProfile | None) -> dict:
    await usage.ensure_budget(db, user.id, "llm_tokens")
    memory = session.state.get("memory") or {}
    res = await providers.llm.generate_json(system=_system_prompt(session, profile, memory), messages=_history(turns),
                                            schema=TURN_SCHEMA, purpose="chat", max_tokens=4096)
    await usage.record_llm(db, user.id, res.provider, res.usage, "tutor_turn")
    return res.data


def _use_llm(providers: Providers, session: ConversationSession) -> bool:
    return providers.llm.is_generative and session.provider != "offline"


async def start_session(db: AsyncSession, user: User, providers: Providers, *, language: str, mode: str,
                        scenario_id: str | None, settings: dict) -> ConversationSession:
    if language not in LANGUAGES:
        raise TutorError("Idioma não suportado.")
    if mode not in MODES:
        raise TutorError("Modo de conversa inválido.")
    scenario = None
    if mode == "scenario":
        scenario = get_scenario(scenario_id or "")
        if scenario is None:
            raise TutorError("Cenário não encontrado.")
    profile = await _profile(db, user, language)
    level = settings.get("level") or (profile.cefr_estimate if profile and profile.cefr_estimate else "B1")
    settings = {**settings, "level": level}
    if scenario:
        settings.setdefault("event_index", int(utcnow().timestamp()) % max(1, len(scenario["unexpected_events"])))

    session = ConversationSession(
        user_id=user.id, language=language, mode=mode, scenario_id=scenario["id"] if scenario else None,
        title=scenario["title_pt"] if scenario else {"natural": "Conversa livre", "immediate": "Treino com correção imediata",
                                                     "no_native": "No Portuguese Mode", "quick_response": "Quick Response",
                                                     "challenge": f"Conversation Challenge — {settings.get('challenge_minutes', 5)} min"}[mode],
        settings=settings, state={"user_turns": 0, "goals_achieved": []},
        provider=providers.llm.name if providers.llm.is_generative else "offline",
    )
    db.add(session)
    await db.flush()
    session.state = {**session.state, "memory": await _memory(db, user, language)}

    opening_text: str
    if scenario:
        opening_text = scenario["opening"]  # fala de abertura fixa: sem custo nem latência de IA
        state = dict(session.state)
        offline_tutor.opening(language, mode, level, scenario, state)
        session.state = state
    elif _use_llm(providers, session):
        try:
            data = await _llm_turn(db, user, providers, session, [], profile)
            opening_text = data["reply"]
        except AIError as e:
            log.warning("tutor opening fell back to offline: %s", e)
            state = dict(session.state)
            opening_text = offline_tutor.opening(language, mode, level, None, state)
            session.state = state | {"degraded": e.code}
    else:
        state = dict(session.state)
        opening_text = offline_tutor.opening(language, mode, level, None, state)
        session.state = state
    db.add(ConversationTurn(session_id=session.id, seq=0, role="assistant", text=opening_text))
    await db.flush()
    return session


def _visible(mode: str, corrections: list[dict]) -> list[dict]:
    if mode == "immediate":
        return corrections
    return [c for c in corrections if c["severity"] == "blocks_understanding"]


def _merge_corrections(rule_based: list[Correction], llm: list[dict]) -> list[dict]:
    out = [dict(c) | {"source": "ai"} for c in llm]
    seen = {(c["original"].strip().lower(), c["subtype"]) for c in out}
    llm_originals = {c["original"].strip().lower() for c in out}
    for c in rule_based:
        key = (c.original.strip().lower(), c.subtype)
        # se a IA analisou a mesma frase e não apontou este erro, confiamos na IA (evita falso positivo de regra)
        if key in seen or (out and c.original.strip().lower() in llm_originals):
            continue
        out.append(c.to_dict())
        seen.add(key)
    return out


async def load_turns(db: AsyncSession, session: ConversationSession) -> list[ConversationTurn]:
    return list((await db.execute(select(ConversationTurn).where(ConversationTurn.session_id == session.id)
                                  .order_by(ConversationTurn.seq))).scalars())


async def post_message(db: AsyncSession, user: User, providers: Providers, session: ConversationSession, text: str,
                       meta: dict) -> dict:
    if session.ended_at is not None:
        raise TutorError("Esta sessão já foi encerrada.")
    text = text.strip()[:2000]
    if not text:
        raise TutorError("Mensagem vazia.")
    turns = await load_turns(db, session)
    seq = (turns[-1].seq + 1) if turns else 0
    state = dict(session.state)
    state["user_turns"] = state.get("user_turns", 0) + 1
    meta = {**meta, "words": count_words(text)}
    meta["portuguese"] = looks_portuguese(text)

    user_turn = ConversationTurn(session_id=session.id, seq=seq, role="user", text=text, meta=meta)
    db.add(user_turn)
    await db.flush()
    turns.append(user_turn)
    rule_corrections = analyze(text, session.language)

    profile = await _profile(db, user, session.language)
    result: dict | None = None
    degraded = None
    if _use_llm(providers, session):
        try:
            result = await _llm_turn(db, user, providers, session, turns, profile)
        except AIError as e:
            degraded = e.code
            log.warning("tutor turn degraded to offline: %s", e)
    if result is None:
        scenario = get_scenario(session.scenario_id) if session.scenario_id else None
        level = session.settings.get("level", "B1")
        off = offline_tutor.reply(language=session.language, mode=session.mode, level=level, scenario=scenario,
                                  state=state, user_text=text, corrections=rule_corrections)
        result = {"reply": off["reply"], "corrections": [], "new_vocabulary": [], "goals_achieved": [],
                  "comprehension_issue": off["comprehension_issue"]}

    corrections = _merge_corrections(rule_corrections, result.get("corrections", []))
    user_turn.corrections = corrections
    goals = list(dict.fromkeys(state.get("goals_achieved", []) + [g for g in result.get("goals_achieved", []) if g]))
    state["goals_achieved"] = goals
    if result.get("new_vocabulary"):
        state["new_vocabulary"] = (state.get("new_vocabulary", []) + result["new_vocabulary"])[-12:]
    if degraded:
        state["degraded"] = degraded
    session.state = state

    assistant_turn = ConversationTurn(session_id=session.id, seq=seq + 1, role="assistant", text=result["reply"],
                                      meta={"comprehension_issue": bool(result.get("comprehension_issue"))})
    db.add(assistant_turn)
    await db.flush()

    scenario = get_scenario(session.scenario_id) if session.scenario_id else None
    return {
        "user_turn_id": str(user_turn.id),
        "reply": result["reply"],
        "visible_corrections": _visible(session.mode, corrections),
        "hidden_corrections_count": len(corrections) - len(_visible(session.mode, corrections)),
        "new_vocabulary": result.get("new_vocabulary", []),
        "goals": [{"id": g["id"], "pt": g["pt"], "achieved": g["id"] in goals} for g in scenario["goals"]] if scenario else [],
        "comprehension_issue": bool(result.get("comprehension_issue")),
        "portuguese_detected": bool(meta.get("portuguese")),
        "degraded": degraded,
        "engine": "offline" if (degraded or not _use_llm(providers, session)) else providers.llm.name,
    }


def compute_metrics(session: ConversationSession, turns: list[ConversationTurn]) -> dict:
    user = [t for t in turns if t.role == "user"]
    texts = [t.text for t in user]
    words = [count_words(t) for t in texts]
    lat = [t.meta.get("latency_ms") for t in user if t.meta.get("latency_ms")]
    audio = [t.meta.get("audio_seconds") for t in user if t.meta.get("audio_seconds")]
    audio_words = [count_words(t.text) for t in user if t.meta.get("audio_seconds")]
    end = session.ended_at or utcnow()
    return {
        "user_turns": len(user),
        "user_words": sum(words),
        "avg_words_per_turn": round(statistics.mean(words), 1) if words else 0,
        "longest_turn_words": max(words) if words else 0,
        "avg_response_latency_ms": round(statistics.mean(lat)) if lat else None,
        "speaking_seconds": round(sum(audio), 1) if audio else None,
        "speech_rate_wpm": round(sum(audio_words) / sum(audio) * 60, 1) if audio and sum(audio) > 3 else None,
        "lexical_diversity": round(lexical_diversity(" ".join(texts)), 3) if texts else None,
        "portuguese_turns": sum(1 for t in user if t.meta.get("portuguese")),
        "voice_turns": sum(1 for t in user if t.meta.get("source") == "voice"),
        "duration_seconds": int((end - session.started_at).total_seconds()),
    }


async def _save_errors(db: AsyncSession, user: User, session: ConversationSession, errors: list[dict]) -> int:
    n = 0
    for e in errors:
        original = (e.get("original") or "").strip()
        corrected = (e.get("corrected") or "").strip()
        if not original or not corrected or original.lower() == corrected.lower():
            continue
        existing = (await db.execute(select(ErrorRecord).where(
            ErrorRecord.user_id == user.id, ErrorRecord.language == session.language,
            ErrorRecord.subtype == (e.get("subtype") or ""), func.lower(ErrorRecord.corrected) == corrected.lower()
        ))).scalar_one_or_none()
        if existing:
            existing.occurrences += int(e.get("count") or 1)
            existing.last_seen_at = utcnow()
            existing.correct_streak = 0
            existing.resolved = False
        else:
            db.add(ErrorRecord(user_id=user.id, language=session.language, category=e.get("category", "grammar"),
                               subtype=(e.get("subtype") or "")[:60], original=original[:1000], corrected=corrected[:1000],
                               explanation_pt=(e.get("explanation_pt") or "")[:500], severity=e.get("severity", "minor"),
                               source="tutor", source_id=str(session.id), occurrences=int(e.get("count") or 1)))
            n += 1
    await db.flush()
    return n


async def end_session(db: AsyncSession, user: User, providers: Providers, session: ConversationSession) -> dict:
    if session.ended_at is not None and session.report:
        return session.report
    session.ended_at = utcnow()
    turns = await load_turns(db, session)
    metrics = compute_metrics(session, turns)
    session.metrics = metrics
    user_texts = [t.text for t in turns if t.role == "user"]
    all_corrections = [c for t in turns if t.role == "user" for c in (t.corrections or [])]
    scenario = get_scenario(session.scenario_id) if session.scenario_id else None

    report: dict | None = None
    if _use_llm(providers, session) and user_texts:
        try:
            await usage.ensure_budget(db, user.id, "llm_tokens")
            transcript = "\n".join(f"{'LEARNER' if t.role == 'user' else 'TUTOR'}: {t.text}" for t in turns)
            candidates = "\n".join(f"- '{c['original']}' → '{c['corrected']}' ({c['subtype']})" for c in all_corrections[:30])
            content = (f"<transcript>\n{transcript[:60000]}\n</transcript>\n\n<candidate_errors>\n{candidates or '(none)'}\n"
                       f"</candidate_errors>\n\nSession metrics: {metrics}")
            res = await providers.llm.generate_json(system=build_report_prompt(session.language),
                                                    messages=[ChatMessage("user", content)], schema=REPORT_SCHEMA,
                                                    purpose="report", max_tokens=16000)
            await usage.record_llm(db, user.id, res.provider, res.usage, "tutor_report")
            report = res.data | {"engine": providers.llm.name}
        except AIError as e:
            log.warning("report fell back to offline: %s", e)
    if report is None:
        report = offline_tutor.report(language=session.language, scenario=scenario, user_texts=user_texts,
                                      corrections=all_corrections, metrics=metrics) | {"engine": "offline"}

    if scenario:
        achieved = set(session.state.get("goals_achieved", []))
        report["goals"] = [{"id": g["id"], "pt": g["pt"], "achieved": g["id"] in achieved} for g in scenario["goals"]]
        if session.provider == "offline":
            report["goals_note_pt"] = "Verificação automática de objetivos disponível apenas com IA generativa."
    report["metrics"] = metrics

    # Persistência: caderno de erros + revisão espaçada (vocabulário novo e frases corrigidas)
    await _save_errors(db, user, session, report.get("main_errors", []))
    added = 0
    for v in (report.get("new_vocabulary") or [])[:6]:
        if await vocab_service.add_personal_item(db, user, language=session.language, term=v["term"],
                                                 meaning_pt=v.get("meaning_pt", ""), example=v.get("example", ""),
                                                 kind="phrase", source="tutor"):
            added += 1
    for e in (report.get("main_errors") or [])[:3]:
        if await vocab_service.add_personal_item(
            db, user, language=session.language, term=e["corrected"][:200],
            meaning_pt=f"Diga de forma correta: “{e['original'][:200]}”", definition=e.get("explanation_pt", ""),
            example=e["corrected"], kind="correction", source="error",
        ):
            added += 1
    report["added_to_review"] = added

    db.add(ActivityLog(user_id=user.id, language=session.language,
                       activity_type="scenario" if session.mode == "scenario" else "conversation",
                       started_at=session.started_at, duration_seconds=metrics["duration_seconds"],
                       score=_goal_score(report, session),
                       skills=["speaking", "interaction", "fluency"],
                       details={"session_id": str(session.id), "mode": session.mode,
                                "avg_words_per_turn": metrics["avg_words_per_turn"],
                                "latency_ms": metrics["avg_response_latency_ms"]}))
    session.report = report
    await db.flush()
    return report


def _goal_score(report: dict, session: ConversationSession) -> float | None:
    goals = report.get("goals") or []
    if not goals or session.provider == "offline":
        return None
    return sum(1 for g in goals if g["achieved"]) / len(goals)


async def recent_sessions(db: AsyncSession, user: User, language: str, days: int = 90) -> list[ConversationSession]:
    return list((await db.execute(
        select(ConversationSession).where(ConversationSession.user_id == user.id, ConversationSession.language == language,
                                          ConversationSession.started_at >= utcnow() - timedelta(days=days))
        .order_by(ConversationSession.started_at.desc())
    )).scalars())
