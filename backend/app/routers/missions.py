"""Missões: trilhas rápidas de frases para a Índia e para Wisconsin (EUA)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.deps import DB, CurrentUser
from app.services import missions as mission_service

router = APIRouter(prefix="/india/missions", tags=["missions"])


@router.get("")
async def list_missions(user: CurrentUser, db: DB, track: str = Query("india", pattern="^(india|us)$")) -> dict:
    return await mission_service.overview(db, user, track)


@router.get("/{mission_id}")
async def get_mission(mission_id: str, user: CurrentUser) -> dict:
    m = mission_service.mission_for(user, mission_id)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Missão não encontrada.")
    return m


class ChunkResult(BaseModel):
    chunk_id: str = Field(max_length=20)
    rating: int = Field(ge=1, le=4)  # 1 errou · 2 acertou após tentar de novo · 3 acertou de primeira · 4 fácil


class CompleteIn(BaseModel):
    results: list[ChunkResult] = Field(max_length=40)
    score: float = Field(ge=0, le=1)
    duration_seconds: int = Field(ge=0, le=7_200)
    details: dict = Field(default_factory=dict)
    plan_day: int | None = None
    plan_activity_id: str | None = Field(default=None, max_length=40)


@router.post("/{mission_id}/complete")
async def complete_mission(mission_id: str, body: CompleteIn, user: CurrentUser, db: DB) -> dict:
    m = mission_service.mission_for(user, mission_id)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Missão não encontrada.")
    details = {k: v for k, v in body.details.items() if isinstance(v, (int, float, str, bool))}
    result = await mission_service.complete(
        db, user, m, results=[r.model_dump() for r in body.results], score=body.score,
        duration_seconds=body.duration_seconds, details=details, plan_day=body.plan_day, plan_activity_id=body.plan_activity_id)
    await db.commit()
    return result
