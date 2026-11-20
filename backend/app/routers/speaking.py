"""Medidor de fala semanal e registro de conversas com pessoas reais."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.deps import DB, CurrentUser
from app.services import speaking as speaking_service

router = APIRouter(prefix="/speaking", tags=["speaking"])


@router.get("")
async def get_overview(user: CurrentUser, db: DB) -> dict:
    return await speaking_service.overview(db, user)


class CheckIn(BaseModel):
    prompt_id: str = Field(max_length=10)
    transcript: str = Field(max_length=4000)
    seconds: float = Field(ge=1, le=600)
    confidence: int = Field(ge=1, le=5)
    plan_day: int | None = None
    plan_activity_id: str | None = Field(default=None, max_length=40)


@router.post("/checks")
async def save_check(body: CheckIn, user: CurrentUser, db: DB) -> dict:
    try:
        out = await speaking_service.save_check(db, user, prompt_id=body.prompt_id, transcript=body.transcript, seconds=body.seconds,
                                                confidence=body.confidence, plan_day=body.plan_day, plan_activity_id=body.plan_activity_id)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    await db.commit()
    return out


class RealIn(BaseModel):
    minutes: int = Field(ge=1, le=240)
    partner: str = Field(pattern="^(india|us|other)$")
    note: str = Field(default="", max_length=200)


@router.post("/real")
async def log_real(body: RealIn, user: CurrentUser, db: DB) -> dict:
    out = await speaking_service.log_real(db, user, minutes=body.minutes, partner=body.partner, note=body.note)
    await db.commit()
    return out
