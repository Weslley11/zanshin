from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.registry import Providers
from app.db import get_db
from app.models import Consent, User
from app.security import ai_limiter, decode_access_token

_bearer = HTTPBearer(auto_error=False)

DB = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    db: DB, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Não autenticado", headers={"WWW-Authenticate": "Bearer"})
    user_id = decode_access_token(creds.credentials)
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido ou expirado", headers={"WWW-Authenticate": "Bearer"})
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário não encontrado")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_providers(request: Request) -> Providers:
    return request.app.state.providers


ProvidersDep = Annotated[Providers, Depends(get_providers)]


async def ai_rate_limit(user: CurrentUser) -> None:
    if not ai_limiter.allow(str(user.id)):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Muitas requisições de IA em pouco tempo. Aguarde um instante.")


async def has_consent(db: AsyncSession, user: User, kind: str) -> bool:
    row = (await db.execute(select(Consent).where(Consent.user_id == user.id, Consent.kind == kind))).scalar_one_or_none()
    return bool(row and row.granted)


async def require_consent(db: AsyncSession, user: User, kind: str) -> None:
    if not await has_consent(db, user, kind):
        labels = {
            "voice_processing": "processamento de voz",
            "document_processing": "processamento de documentos",
            "ai_processing": "processamento por IA",
        }
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"code": "consent_required", "consent": kind,
                    "message": f"É necessário consentir com o {labels.get(kind, kind)} nas configurações de privacidade."},
        )
