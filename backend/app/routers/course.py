"""Trilha: curso gamificado com lições curtas, XP e sequência de dias."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.deps import DB, CurrentUser
from app.services import course as course_service

router = APIRouter(prefix="/course", tags=["course"])


@router.get("")
async def course_overview(user: CurrentUser, db: DB) -> dict:
    return await course_service.overview(db, user)


@router.get("/lessons/{lesson_id}")
async def get_lesson(lesson_id: str, user: CurrentUser) -> dict:
    lesson = course_service.lesson_for(user, lesson_id)
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lição não encontrada.")
    return lesson


class ItemResult(BaseModel):
    item_id: str = Field(max_length=60)
    rating: int = Field(ge=1, le=4)


class CompleteIn(BaseModel):
    results: list[ItemResult] = Field(max_length=20)
    correct_first: int = Field(ge=0, le=100)
    total: int = Field(ge=1, le=100)
    duration_seconds: int = Field(ge=0, le=7_200)


@router.post("/lessons/{lesson_id}/complete")
async def complete_lesson(lesson_id: str, body: CompleteIn, user: CurrentUser, db: DB) -> dict:
    lesson = course_service.lesson_for(user, lesson_id)
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lição não encontrada.")
    result = await course_service.complete(db, user, lesson, results=[r.model_dump() for r in body.results],
                                           correct_first=body.correct_first, total=body.total,
                                           duration_seconds=body.duration_seconds)
    await db.commit()
    return result
