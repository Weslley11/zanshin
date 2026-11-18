#!/usr/bin/env python3
"""Gera áudios MP3 das frases em inglês do app (para tocar como mídia, sem depender da voz do sistema).

Por quê: no iPhone, a voz do sistema na web (speechSynthesis) é instável no app instalado na tela de início e é
silenciada pelo modo silencioso; um arquivo de áudio tocado como mídia funciona de forma confiável.

Uso (no CI, que tem acesso aos modelos):
  pip install piper-tts==1.8.0
  python -m piper.download_voices en_US-ljspeech-medium --data-dir voices
  python scripts/make_audio.py --model voices/en_US-ljspeech-medium.onnx --out dist/audio
Teste local sem modelo: --engine tone (gera um tom curto por frase, só para validar o encadeamento).

Saída: <out>/<chave>.mp3 e <out>/index.json = {"voice": ..., "clips": {chave: arquivo}}.
A chave é FNV-1a (32 bits, hex) do texto normalizado — a mesma função de mobile/src/lib/webAudio.ts.
Voz: LJSpeech (conjunto de dados em domínio público).
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KEYS = {"en", "cue", "say", "model", "q", "text", "term", "example", "prompt"}
PT_HINT = re.compile(r"[ãõçáéíóúâêôà]|\b(você|não|para|com|uma|que|está|isso)\b", re.IGNORECASE)


def normalize(text: str) -> str:
    """Igual a webAudio.ts: remove anotações entre parênteses, apara e junta espaços, minúsculas."""
    t = re.sub(r"\([^)]*\)", "", text)
    return re.sub(r"\s+", " ", t).strip().lower()


def fnv1a(text: str) -> str:
    h = 0x811C9DC5
    for b in text.encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def collect(node, out: set[str], key: str | None = None) -> None:
    if isinstance(node, dict):
        for k, v in node.items():
            collect(v, out, k)
    elif isinstance(node, list):
        for v in node:
            collect(v, out, key)
    elif isinstance(node, str) and key in KEYS:
        s = re.sub(r"\([^)]*\)", "", node).strip()
        if 2 <= len(s) <= 240 and re.search(r"[A-Za-z]", s) and "{name}" not in s and "_____" not in s and not PT_HINT.search(s):
            out.add(s)


def to_mp3(wav: Path, mp3: Path) -> None:
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-ac", "1", "-ar", "22050", "-b:a", "48k", str(mp3)], check=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--content", default=str(ROOT / "src" / "content" / "content.json"))
    ap.add_argument("--out", required=True)
    ap.add_argument("--engine", choices=["piper", "tone"], default="piper")
    ap.add_argument("--model", help="modelo .onnx do Piper")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    texts: set[str] = set()
    collect(json.loads(Path(args.content).read_text()), texts)
    items = sorted(texts)
    if args.limit:
        items = items[: args.limit]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    voice = None
    if args.engine == "piper":
        from piper import PiperVoice  # type: ignore

        voice = PiperVoice.load(args.model)

    clips: dict[str, str] = {}
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "t.wav"
        for n, text in enumerate(items, 1):
            key = fnv1a(normalize(text))
            if key in clips:
                continue
            mp3 = out / f"{key}.mp3"
            if mp3.exists() and mp3.stat().st_size > 0:  # já gerado em um build anterior (cache do CI)
                clips[key] = mp3.name
                continue
            if args.engine == "piper":
                with wave.open(str(wav), "wb") as wf:
                    voice.synthesize_wav(text, wf)
            else:  # tom de teste
                subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.6", str(wav)], check=True)
            to_mp3(wav, mp3)
            clips[key] = mp3.name
            if n % 200 == 0:
                print(f"{n}/{len(items)}", flush=True)
    (out / "index.json").write_text(json.dumps({"voice": Path(args.model).stem if args.engine == "piper" else "tone",
                                                "count": len(clips), "clips": clips}, separators=(",", ":")))
    print(f"áudios: {len(clips)} arquivos em {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
