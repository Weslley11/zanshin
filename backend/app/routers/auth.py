from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select

from app.deps import DB
from app.models import Consent, User
from app.security import (
    DUMMY_HASH,
    RefreshError,
    create_access_token,
    hash_password,
    issue_refresh_token,
    login_limiter,
    revoke_refresh_token,
    rotate_refresh_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    display_name: str = Field(default="", max_length=120)
    accept_terms: bool
    consents: dict[str, bool] = Field(default_factory=dict)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class RefreshIn(BaseModel):
    refresh_token: str = Field(max_length=200)


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105
    expires_in: int


CONSENT_KINDS = {"voice_processing", "recording_storage", "document_processing", "ai_processing"}


def _password_ok(pw: str) -> bool:
    return any(c.isalpha() for c in pw) and any(c.isdigit() for c in pw)


@router.post("/register", response_model=TokenOut, status_code=201)
async def register(body: RegisterIn, request: Request, db: DB) -> TokenOut:
    if not body.accept_terms:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "É necessário aceitar os termos e a política de privacidade.")
    if not _password_ok(body.password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A senha deve ter ao menos 10 caracteres, com letras e números.")
    email = body.email.lower()
    if (await db.execute(select(User.id).where(func.lower(User.email) == email))).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe uma conta com este e-mail.")
    user = User(email=email, password_hash=hash_password(body.password), display_name=body.display_name.strip())
    db.add(user)
    await db.flush()
    for kind in CONSENT_KINDS:
        db.add(Consent(user_id=user.id, kind=kind, granted=bool(body.consents.get(kind, False))))
    access, ttl = create_access_token(user.id)
    refresh = await issue_refresh_token(db, user.id, user_agent=request.headers.get("user-agent", ""))
    await db.commit()
    return TokenOut(access_token=access, refresh_token=refresh, expires_in=ttl)


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, request: Request, db: DB) -> TokenOut:
    ip = request.client.host if request.client else "unknown"
    if not login_limiter.allow(f"{ip}:{body.email.lower()}"):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Muitas tentativas. Aguarde um minuto.")
    user = (await db.execute(select(User).where(func.lower(User.email) == body.email.lower()))).scalar_one_or_none()
    if user is None:
        verify_password(body.password, DUMMY_HASH)  # tempo constante
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-mail ou senha incorretos.")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-mail ou senha incorretos.")
    access, ttl = create_access_token(user.id)
    refresh = await issue_refresh_token(db, user.id, user_agent=request.headers.get("user-agent", ""))
    await db.commit()
    return TokenOut(access_token=access, refresh_token=refresh, expires_in=ttl)


@router.post("/refresh", response_model=TokenOut)
async def refresh(body: RefreshIn, request: Request, db: DB) -> TokenOut:
    try:
        user_id, new_refresh = await rotate_refresh_token(db, body.refresh_token, request.headers.get("user-agent", ""))
    except RefreshError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão expirada. Faça login novamente.") from e
    access, ttl = create_access_token(user_id)
    await db.commit()
    return TokenOut(access_token=access, refresh_token=new_refresh, expires_in=ttl)


@router.post("/logout", status_code=204)
async def logout(body: RefreshIn, db: DB) -> None:
    await revoke_refresh_token(db, body.refresh_token)
    await db.commit()
