"""Guia "Como eles falam" (Índia e EUA): pronúncia, fala do dia a dia, gírias, estilo e sotaques + treino de ouvido."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.content.speech_guide import guide_for
from app.deps import DB, CurrentUser
from app.services import speech_guide as guide_service

router = APIRouter(prefix="/guides", tags=["guides"])


@router.get("")
async def list_guides(user: CurrentUser, db: DB) -> dict:
    return await guide_service.overview(db, user)


@router.get("/{code}")
async def get_guide(code: str, user: CurrentUser) -> dict:
    g = guide_for(code)
    if g is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Guia não encontrado.")
    return g


class ItemResult(BaseModel):
    item_id: str = Field(max_length=20)
    rating: int = Field(ge=1, le=4)


class CompleteIn(BaseModel):
    results: list[ItemResult] = Field(max_length=40)
    duration_seconds: int = Field(ge=0, le=7_200)


@router.post("/{code}/complete")
async def complete_quiz(code: str, body: CompleteIn, user: CurrentUser, db: DB) -> dict:
    g = guide_for(code)
    if g is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Guia não encontrado.")
    out = await guide_service.complete(db, user, g, results=[r.model_dump() for r in body.results], duration_seconds=body.duration_seconds)
    await db.commit()
    return out
