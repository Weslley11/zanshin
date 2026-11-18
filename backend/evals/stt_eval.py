"""Avaliação do reconhecimento de voz (WER) com gravações reais de aprendizes.

Coloque pares em evals/data/stt/: `<nome>.m4a|wav|webm` + `<nome>.txt` (transcrição de referência).
Recomenda-se gravar com sotaque brasileiro, em ambientes silencioso e ruidoso, em celulares diferentes.

  STT_PROVIDER=openai_compatible OPENAI_API_KEY=... uv run python -m evals.stt_eval   # custa por minuto de áudio
"""

from __future__ import annotations

import asyncio
import json
import mimetypes
from pathlib import Path

from app.ai.registry import build_providers
from app.config import get_settings
from app.services.text_utils import word_error_rate

DIR = Path(__file__).parent / "data" / "stt"


async def main() -> None:
    providers = build_providers(get_settings())
    if providers.stt is None:
        raise SystemExit("Nenhum STT configurado (STT_PROVIDER + credenciais).")
    rows = []
    for audio in sorted(p for p in DIR.glob("*") if p.suffix in {".m4a", ".wav", ".webm", ".mp3", ".ogg"}):
        ref = audio.with_suffix(".txt")
        if not ref.exists():
            continue
        mime = mimetypes.guess_type(audio.name)[0] or "audio/mp4"
        t = await providers.stt.transcribe(audio.read_bytes(), mime_type=mime, language="en")
        rows.append({"file": audio.name, "wer": round(word_error_rate(ref.read_text(), t.text), 3),
                     "confidence": t.confidence, "hypothesis": t.text})
    if not rows:
        raise SystemExit(f"Nenhum par áudio/.txt encontrado em {DIR}")
    mean = sum(r["wer"] for r in rows) / len(rows)
    print(json.dumps({"provider": providers.stt.name, "files": len(rows), "mean_wer": round(mean, 3), "rows": rows},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
