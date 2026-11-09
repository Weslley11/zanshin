"""Dashboard de evolução. Separa explicitamente tempo de estudo (esforço) de domínio (desempenho medido)."""

from __future__ import annotations

import statistics
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content.languages import SKILL_LABELS_PT, public_language
from app.db import utcnow
from app.models import ActivityLog, Assessment, ConversationSession, LearnerProfile, PlanDay, StudyPlan, User
from app.services import vocab as vocab_service


def streak(days_with_activity: set[date], today: date) -> int:
    """Dias consecutivos com prática; hoje ainda sem prática não quebra a sequência."""
    d = today if today in days_with_activity else today - timedelta(days=1)
    n = 0
    while d in days_with_activity:
        n += 1
        d -= timedelta(days=1)
    return n


async def build(db: AsyncSession, user: User, language: str) -> dict:
    now = utcnow()
    today = now.date()
    profile = (await db.execute(select(LearnerProfile).where(LearnerProfile.user_id == user.id,
                                                             LearnerProfile.language == language))).scalar_one_or_none()
    logs = (await db.execute(select(ActivityLog).where(ActivityLog.user_id == user.id, ActivityLog.language == language)
                             .order_by(ActivityLog.started_at))).scalars().all()

    minutes_by_day: dict[date, float] = {}
    for log in logs:
        d = log.started_at.date()
        minutes_by_day[d] = minutes_by_day.get(d, 0) + log.duration_seconds / 60
    active_days = {d for d, m in minutes_by_day.items() if m >= 1}
    daily_goal = profile.daily_minutes if profile else 45
    week = [{"date": (today - timedelta(days=i)).isoformat(),
             "minutes": round(minutes_by_day.get(today - timedelta(days=i), 0), 1)} for i in range(6, -1, -1)]

    def series(activity: str, field: str = "score", n: int = 12) -> list[dict]:
        pts = [{"date": log.started_at.date().isoformat(), "value": round(getattr(log, field) * 100, 1)}
               for log in logs if log.activity_type == activity and getattr(log, field) is not None]
        return pts[-n:]

    sessions = (await db.execute(select(ConversationSession).where(
        ConversationSession.user_id == user.id, ConversationSession.language == language,
        ConversationSession.ended_at.is_not(None)).order_by(ConversationSession.ended_at))).scalars().all()
    conv = [{"date": s.ended_at.date().isoformat(), "avg_words_per_turn": s.metrics.get("avg_words_per_turn"),
             "latency_ms": s.metrics.get("avg_response_latency_ms"), "wpm": s.metrics.get("speech_rate_wpm"),
             "minutes": round((s.metrics.get("duration_seconds") or 0) / 60, 1), "mode": s.mode} for s in sessions][-12:]
    qr = [log.details.get("latency_ms") for log in logs if log.activity_type == "quick_response" and log.details.get("latency_ms")]

    assessments = (await db.execute(select(Assessment).where(Assessment.user_id == user.id, Assessment.language == language,
                                                             Assessment.completed_at.is_not(None))
                                    .order_by(Assessment.completed_at))).scalars().all()
    skill_history = [{"date": a.completed_at.date().isoformat(), "kind": a.kind, "overall": a.overall_cefr,
                      "scores": a.section_scores} for a in assessments]

    plan = (await db.execute(select(StudyPlan).where(StudyPlan.user_id == user.id, StudyPlan.language == language,
                                                     StudyPlan.status == "active").order_by(StudyPlan.created_at.desc()))).scalars().first()
    plan_info = None
    pending_today: list[dict] = []
    if plan:
        days = (await db.execute(select(PlanDay).where(PlanDay.plan_id == plan.id))).scalars().all()
        total_acts = sum(len(d.activities) for d in days)
        done_acts = sum(1 for d in days for a in d.activities if a.get("done"))
        day_idx = min(max((today - plan.start_date).days + 1, 1), plan.total_days)
        today_day = next((d for d in days if d.day_index == day_idx), None)
        if today_day:
            pending_today = [a for a in today_day.activities if not a.get("done")]
        next_assessment = min((d.day_index for d in days if d.is_assessment_day and d.day_index >= day_idx), default=None)
        plan_info = {"id": str(plan.id), "day": day_idx, "total_days": plan.total_days,
                     "phase": today_day.phase if today_day else None,
                     "percent_activities_done": round(done_acts / total_acts * 100, 1) if total_acts else 0,
                     "days_completed": sum(1 for d in days if d.completed_at), "next_assessment_day": next_assessment,
                     "end_date": plan.end_date.isoformat()}

    vstats = await vocab_service.stats(db, user, language)
    scores = dict(profile.skill_scores) if profile else {}
    return {
        "language": public_language(language),
        "level_estimate": profile.cefr_estimate if profile else None,
        "level_note_pt": "Estimativa interna (descritores CEFR) — não é certificação.",
        "skills": [{"skill": k, "label_pt": SKILL_LABELS_PT[k], "score": scores.get(k)} for k in SKILL_LABELS_PT],
        "effort": {
            "total_minutes": round(sum(minutes_by_day.values()), 1),
            "today_minutes": round(minutes_by_day.get(today, 0), 1),
            "daily_goal_minutes": daily_goal,
            "streak_days": streak(active_days, today),
            "week": week,
            "note_pt": "Tempo de estudo mede esforço, não domínio. Seu nível é medido pelas avaliações e desempenho.",
        },
        "vocabulary": vstats,
        "pending": {"cards_due": vstats["due_now"], "plan_activities_today": pending_today},
        "conversation": {"sessions": len(sessions), "history": conv,
                         "quick_response_median_ms": round(statistics.median(qr)) if qr else None},
        "listening": {"history": series("listening")},
        "shadowing": {"history": series("shadowing")},
        "skill_history": skill_history,
        "plan": plan_info,
    }
