"""Utilitários de áudio (conversão via ffmpeg, quando necessária para o provedor)."""

from __future__ import annotations

import asyncio
import shutil

from app.ai.base import AIError


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


async def to_wav_pcm16k(audio: bytes, mime_type: str) -> bytes:
    """Converte qualquer formato suportado pelo ffmpeg para WAV PCM 16 kHz mono (exigido pelo Azure REST)."""
    if mime_type in ("audio/wav", "audio/x-wav") and audio[:4] == b"RIFF":
        return audio
    if not ffmpeg_available():
        raise AIError("ffmpeg não está instalado no servidor (necessário para converter o áudio).", code="server_config")
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-ac", "1", "-ar", "16000",
        "-f", "wav", "-acodec", "pcm_s16le", "pipe:1",
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    out, err = await asyncio.wait_for(proc.communicate(audio), timeout=30)
    if proc.returncode != 0:
        raise AIError("Não foi possível processar o áudio enviado.", code="bad_audio")
    return out


def wav_duration_seconds(wav: bytes) -> float:
    """Duração de um WAV PCM a partir do cabeçalho (sem dependências)."""
    if len(wav) < 44 or wav[:4] != b"RIFF":
        return 0.0
    byte_rate = int.from_bytes(wav[28:32], "little")
    return max(0.0, (len(wav) - 44) / byte_rate) if byte_rate else 0.0
