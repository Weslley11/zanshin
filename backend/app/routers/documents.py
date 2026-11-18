from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select

from app.ai.base import AIError, ChatMessage
from app.config import get_settings
from app.deps import DB, CurrentUser, ProvidersDep, ai_rate_limit, require_consent
from app.models import Document
from app.services import documents as doc_service
from app.services import usage
from app.services import vocab as vocab_service

router = APIRouter(prefix="/documents", tags=["documents"])


def _view(d: Document, include_text: bool = False) -> dict:
    out = {"id": str(d.id), "filename": d.filename, "status": d.status, "report": d.report, "generated": d.generated,
           "created_at": d.created_at.isoformat()}
    if include_text:
        out["redacted_text"] = d.redacted_text
    return out


@router.post("", status_code=201)
async def upload(user: CurrentUser, db: DB, file: UploadFile = File(...), authorized: bool = Form(...),
                 language: str = Form(default="en")) -> dict:
    await require_consent(db, user, "document_processing")
    if not authorized:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Confirme que você está autorizado a usar este material (sem informações confidenciais).")
    data = await file.read()
    try:
        text, report = doc_service.process_upload(file.filename or "documento.txt", data, get_settings().max_document_kb)
    except doc_service.DocumentRejected as e:
        raise HTTPException(422, {"code": "document_rejected", "reasons_pt": e.reasons}) from e
    d = Document(user_id=user.id, filename=(file.filename or "documento")[:255], language=language, redacted_text=text,
                 report=report, authorized_by_user=True)
    db.add(d)
    await db.commit()
    return _view(d, include_text=True)


@router.post("/{document_id}/generate", dependencies=[Depends(ai_rate_limit)])
async def generate(document_id: uuid.UUID, user: CurrentUser, db: DB, providers: ProvidersDep) -> dict:
    d = (await db.execute(select(Document).where(Document.id == document_id, Document.user_id == user.id))).scalar_one_or_none()
    if d is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento não encontrado.")
    terms = doc_service.extract_terms(d.redacted_text)
    generated: dict = {"terms": terms, "exercises": doc_service.offline_exercises(d.redacted_text, terms), "engine": "offline"}
    if providers.llm.is_generative:
        await require_consent(db, user, "ai_processing")
        await usage.ensure_budget(db, user.id, "llm_tokens")
        try:
            res = await providers.llm.generate_json(
                system=doc_service.DOC_SYSTEM, schema=doc_service.DOC_SCHEMA, purpose="document", max_tokens=16000,
                messages=[ChatMessage("user", f"<document>\n{d.redacted_text[:40000]}\n</document>")],
            )
            await usage.record_llm(db, user.id, res.provider, res.usage, "document")
            generated = doc_service.postfilter(res.data) | {"terms": terms, "engine": res.provider}
        except AIError as e:
            generated["ai_error"] = str(e)
    added = 0
    glossary = generated.get("glossary") or [t for t in terms if t.get("meaning_pt")]
    for g in glossary[:12]:
        if await vocab_service.add_personal_item(db, user, language=d.language, term=g["term"], meaning_pt=g.get("meaning_pt") or "-",
                                                 example=g.get("example", ""), kind="technical", source="document",
                                                 domain="engineering"):
            added += 1
    generated["added_to_review"] = added
    d.generated, d.status = generated, "generated"
    await db.commit()
    return _view(d)


@router.get("")
async def list_documents(user: CurrentUser, db: DB) -> list[dict]:
    rows = (await db.execute(select(Document).where(Document.user_id == user.id).order_by(Document.created_at.desc()))).scalars()
    return [_view(d) for d in rows]


@router.get("/{document_id}")
async def get_document(document_id: uuid.UUID, user: CurrentUser, db: DB) -> dict:
    d = (await db.execute(select(Document).where(Document.id == document_id, Document.user_id == user.id))).scalar_one_or_none()
    if d is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento não encontrado.")
    return _view(d, include_text=True)


@router.delete("/{document_id}", status_code=204)
async def delete_document(document_id: uuid.UUID, user: CurrentUser, db: DB) -> None:
    d = (await db.execute(select(Document).where(Document.id == document_id, Document.user_id == user.id))).scalar_one_or_none()
    if d is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento não encontrado.")
    await db.delete(d)
    await db.commit()
