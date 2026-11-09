"""Tarefas de manutenção (executar via cron/agendador): `python -m app.jobs purge`."""

from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_sessionmaker, utcnow
from app.models import Recording


async def purge_expired_recordings(db: AsyncSession) -> int:
    """Aplica a política de retenção: apaga arquivos e registros de gravações expiradas."""
    expired = (await db.execute(select(Recording).where(Recording.expires_at <= utcnow()))).scalars().all()
    for r in expired:
        try:
            os.remove(r.path)
        except OSError:
            pass
    if expired:
        await db.execute(delete(Recording).where(Recording.id.in_([r.id for r in expired])))
        await db.commit()
    return len(expired)


async def _main(cmd: str) -> None:
    async with get_sessionmaker()() as db:
        if cmd == "purge":
            n = await purge_expired_recordings(db)
            print(f"gravações expiradas removidas: {n}")
        elif cmd == "seed":
            from app.services.vocab import seed_vocab

            print(f"itens de vocabulário adicionados: {await seed_vocab(db)}")
        else:
            raise SystemExit(f"comando desconhecido: {cmd}")


if __name__ == "__main__":
    asyncio.run(_main(sys.argv[1] if len(sys.argv) > 1 else "purge"))
