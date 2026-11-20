"""Mapas mentais para fixação (recuperação ativa sobre o mapa + revisão espaçada)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.content.mind_maps import get_map
from app.deps import DB, CurrentUser
from app.services import mind_maps as map_service

router = APIRouter(prefix="/maps", tags=["mind-maps"])


@router.get("")
async def list_maps(user: CurrentUser, db: DB) -> dict:
    return await map_service.overview(db, user)


@router.get("/{map_id}")
async def get_one(map_id: str, user: CurrentUser) -> dict:
    m = get_map(map_id)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mapa não encontrado.")
    return m


class LeafResult(BaseModel):
    leaf_id: str = Field(max_length=20)
    rating: int = Field(ge=1, le=4)


class CompleteIn(BaseModel):
    mode: str = Field(pattern="^(study|recall|rebuild)$")
    results: list[LeafResult] = Field(max_length=40)
    duration_seconds: int = Field(ge=0, le=7_200)


@router.post("/{map_id}/complete")
async def complete_map(map_id: str, body: CompleteIn, user: CurrentUser, db: DB) -> dict:
    m = get_map(map_id)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mapa não encontrado.")
    result = await map_service.complete(db, user, m, mode=body.mode, results=[r.model_dump() for r in body.results],
                                        duration_seconds=body.duration_seconds)
    await db.commit()
    return result
