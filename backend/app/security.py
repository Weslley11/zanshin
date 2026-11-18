"""Autenticação: Argon2id para senhas, JWT curto para acesso e refresh token opaco com rotação.

- Access token: JWT HS256, 15 min, contém apenas `sub` e `type`.
- Refresh token: aleatório (384 bits), armazenado só como SHA-256. A cada uso é revogado e
  substituído (rotação). Reuso de um token já revogado revoga toda a família (detecção de roubo).
"""

from __future__ import annotations

import hashlib
import secrets
import time
import uuid
from collections import defaultdict, deque
from datetime import timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import utcnow
from app.models import RefreshToken

_hasher = PasswordHasher()  # Argon2id com parâmetros recomendados pela RFC 9106


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


# Hash fixo para igualar o tempo de resposta quando o e-mail não existe (evita enumeração).
DUMMY_HASH = _hasher.hash("timing-equalizer-not-a-real-password")


def create_access_token(user_id: uuid.UUID) -> tuple[str, int]:
    s = get_settings()
    ttl = s.access_token_ttl_minutes * 60
    now = int(time.time())
    payload = {"sub": str(user_id), "type": "access", "iat": now, "exp": now + ttl, "jti": secrets.token_hex(8)}
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm), ttl


def decode_access_token(token: str) -> uuid.UUID | None:
    s = get_settings()
    try:
        payload = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm], options={"require": ["exp", "sub"]})
    except jwt.PyJWTError:
        return None
    if payload.get("type") != "access":
        return None
    try:
        return uuid.UUID(payload["sub"])
    except (ValueError, KeyError):
        return None


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def issue_refresh_token(
    db: AsyncSession, user_id: uuid.UUID, family_id: uuid.UUID | None = None, user_agent: str = ""
) -> str:
    s = get_settings()
    token = secrets.token_urlsafe(48)
    db.add(
        RefreshToken(
            user_id=user_id,
            token_hash=_hash_token(token),
            family_id=family_id or uuid.uuid4(),
            expires_at=utcnow() + timedelta(days=s.refresh_token_ttl_days),
            user_agent=user_agent[:255],
        )
    )
    await db.flush()
    return token


class RefreshError(Exception):
    pass


async def rotate_refresh_token(db: AsyncSession, token: str, user_agent: str = "") -> tuple[uuid.UUID, str]:
    row = (await db.execute(select(RefreshToken).where(RefreshToken.token_hash == _hash_token(token)))).scalar_one_or_none()
    if row is None:
        raise RefreshError("invalid")
    if row.revoked_at is not None:
        # Reuso de token revogado: possível roubo → revoga toda a família.
        await db.execute(
            update(RefreshToken).where(RefreshToken.family_id == row.family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=utcnow())
        )
        await db.commit()
        raise RefreshError("reused")
    if row.expires_at <= utcnow():
        raise RefreshError("expired")
    row.revoked_at = utcnow()
    new_token = await issue_refresh_token(db, row.user_id, row.family_id, user_agent)
    return row.user_id, new_token


async def revoke_refresh_token(db: AsyncSession, token: str) -> None:
    row = (await db.execute(select(RefreshToken).where(RefreshToken.token_hash == _hash_token(token)))).scalar_one_or_none()
    if row is not None:
        await db.execute(
            update(RefreshToken).where(RefreshToken.family_id == row.family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=utcnow())
        )


class SlidingWindowLimiter:
    """Limitador em memória (por processo). Em produção com várias réplicas, use Redis."""

    def __init__(self, limit: int, window_seconds: float) -> None:
        self.limit, self.window = limit, window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        q = self._hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        return True

    def reset(self) -> None:
        self._hits.clear()


login_limiter = SlidingWindowLimiter(limit=get_settings().login_rate_limit_per_minute, window_seconds=60)
ai_limiter = SlidingWindowLimiter(limit=40, window_seconds=60)
