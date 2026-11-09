"""Persistência e adaptação do plano intensivo."""

from __future__ import annotations

from datetime import date

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import utcnow
from app.models import Assessment, LearnerProfile, PlanDay, StudyPlan, User
from app.services import adaptive, planner


async def _placement_done(db: AsyncSession, user: User, language: str) -> bool:
    return (await db.execute(select(Assessment.id).where(Assessment.user_id == user.id, Assessment.language == language,
                                                         Assessment.completed_at.is_not(None)).limit(1))).first() is not None


async def _adjustments(db: AsyncSession, user: User, profile: LearnerProfile) -> tuple[dict, list]:
    """Ajustes do motor adaptativo + preparação para o destino da viagem."""
    adj = adaptive.compute_adjustments(await adaptive.collect_signals(db, user, profile.language))
    multipliers, insights = dict(adj.multipliers), list(adj.insights)
    dest = planner.DESTINATIONS.get(profile.trip_destination or "") if profile.language == "en" else None
    if dest:
        for t, f in dest["multipliers"].items():
            multipliers[t] = round(multipliers.get(t, 1.0) * f, 3)
        insights.insert(0, dest["insight"])
    return multipliers, insights


def _phases_for(destination: str | None) -> dict:
    dest = planner.DESTINATIONS.get(destination or "")
    phases = {k: dict(v) for k, v in planner.PHASES.items()}
    if dest:
        for ph, goals in dest["goals_pt"].items():
            phases[ph]["measurable_goals_pt"] = list(phases[ph]["measurable_goals_pt"]) + goals
    return phases


async def create_plan(db: AsyncSession, user: User, profile: LearnerProfile, *, start: date | None = None,
                      title: str | None = None) -> StudyPlan:
    start = start or utcnow().date()
    total = planner.plan_length(start, profile.trip_date)
    multipliers, insights = await _adjustments(db, user, profile)
    level = profile.cefr_estimate or "B1"
    days = planner.generate(start=start, total_days=total, daily_minutes=profile.daily_minutes, learner_level=level,
                            multipliers=multipliers, focus_domains=profile.focus_domains,
                            placement_done=await _placement_done(db, user, profile.language),
                            destination=profile.trip_destination)
    await db.execute(update(StudyPlan).where(StudyPlan.user_id == user.id, StudyPlan.language == profile.language,
                                             StudyPlan.status == "active").values(status="archived"))
    plan = StudyPlan(
        user_id=user.id, language=profile.language,
        title=title or f"Programa Intensivo de {'Inglês Profissional' if profile.language == 'en' else 'Idioma'} — {total} dias",
        start_date=start, end_date=days[-1].date, total_days=total, daily_minutes=profile.daily_minutes,
        config={"phases": _phases_for(profile.trip_destination), "multipliers": multipliers, "insights": insights,
                "destination": profile.trip_destination,
                "expected_outcomes": planner.expected_outcomes(total, profile.daily_minutes, profile.cefr_estimate),
                "trip_date": profile.trip_date.isoformat() if profile.trip_date else None, "level_at_start": level},
    )
    db.add(plan)
    await db.flush()
    for d in days:
        db.add(PlanDay(plan_id=plan.id, day_index=d.day_index, date=d.date, phase=d.phase, focus=d.focus,
                       activities=d.activities, is_assessment_day=d.is_assessment_day))
    await db.flush()
    return plan


async def current_plan(db: AsyncSession, user: User, language: str) -> StudyPlan | None:
    return (await db.execute(select(StudyPlan).where(StudyPlan.user_id == user.id, StudyPlan.language == language,
                                                     StudyPlan.status == "active").order_by(StudyPlan.created_at.desc()))).scalars().first()


async def plan_days(db: AsyncSession, plan: StudyPlan) -> list[PlanDay]:
    return list((await db.execute(select(PlanDay).where(PlanDay.plan_id == plan.id).order_by(PlanDay.day_index))).scalars())


def day_view(d: PlanDay) -> dict:
    return {"day": d.day_index, "date": d.date.isoformat(), "phase": d.phase, "focus": d.focus,
            "is_assessment_day": d.is_assessment_day, "completed": d.completed_at is not None,
            "minutes": sum(a["minutes"] for a in d.activities), "activities": d.activities}


def plan_view(plan: StudyPlan, days: list[PlanDay], today: date) -> dict:
    today_idx = min(max((today - plan.start_date).days + 1, 1), plan.total_days)
    return {
        "id": str(plan.id), "title": plan.title, "language": plan.language, "start_date": plan.start_date.isoformat(),
        "end_date": plan.end_date.isoformat(), "total_days": plan.total_days, "daily_minutes": plan.daily_minutes,
        "today": today_idx, "phases": plan.config.get("phases"), "insights": plan.config.get("insights", []),
        "expected_outcomes": plan.config.get("expected_outcomes"),
        "last_adapted_at": plan.last_adapted_at.isoformat() if plan.last_adapted_at else None,
        "days": [{"day": d.day_index, "date": d.date.isoformat(), "phase": d.phase, "focus": d.focus,
                  "is_assessment_day": d.is_assessment_day, "completed": d.completed_at is not None,
                  "done": sum(1 for a in d.activities if a.get("done")), "total": len(d.activities)} for d in days],
    }


async def complete_activity(db: AsyncSession, plan: StudyPlan, day_index: int, activity_id: str) -> PlanDay | None:
    day = (await db.execute(select(PlanDay).where(PlanDay.plan_id == plan.id, PlanDay.day_index == day_index))).scalar_one_or_none()
    if day is None:
        return None
    acts = [dict(a) for a in day.activities]
    found = False
    for a in acts:
        if a["id"] == activity_id:
            a["done"] = True
            a["done_at"] = utcnow().isoformat()
            found = True
    if not found:
        return None
    day.activities = acts
    if all(a.get("done") for a in acts):
        day.completed_at = utcnow()
    await db.flush()
    return day


async def adapt(db: AsyncSession, user: User, plan: StudyPlan, profile: LearnerProfile) -> dict:
    """Recalcula a dosagem das atividades nos dias futuros ainda não iniciados, mantendo fases e objetivos."""
    multipliers, insights = await _adjustments(db, user, profile)
    regenerated = planner.generate(start=plan.start_date, total_days=plan.total_days, daily_minutes=profile.daily_minutes,
                                   learner_level=profile.cefr_estimate or "B1", multipliers=multipliers,
                                   focus_domains=profile.focus_domains, placement_done=True,
                                   destination=profile.trip_destination)
    by_idx = {d.day_index: d for d in regenerated}
    today = utcnow().date()
    changed = 0
    for d in await plan_days(db, plan):
        if d.date <= today or any(a.get("done") for a in d.activities):
            continue
        new = by_idx[d.day_index]
        d.activities = new.activities
        d.is_assessment_day = new.is_assessment_day
        changed += 1
    plan.config = {**plan.config, "multipliers": multipliers, "insights": insights,
                   "phases": _phases_for(profile.trip_destination), "destination": profile.trip_destination}
    plan.last_adapted_at = utcnow()
    await db.flush()
    return {"changed_days": changed, "insights": insights, "multipliers": multipliers}
