"""Métricas de fluência e feedback de shadowing com controle de confiança.

Medidas de fluência seguem a literatura de aquisição de L2 (ex.: De Jong & Bosker, 2013;
Tavakoli & Skehan, 2005): taxa de fala, taxa de articulação, pausas silenciosas ≥ 250 ms,
comprimento médio de trecho entre pausas (MLR) e pausas preenchidas.

Princípio: nunca emitir feedback de pronúncia com confiança excessiva. Se o áudio for ruim,
curto demais ou inconclusivo, o resultado é marcado como `inconclusive` e explicado.
"""

from __future__ import annotations

from app.ai.base import PronunciationResult, WordTiming
from app.services.text_utils import FILLERS_EN, FILLERS_PT, align_words, count_words, normalize

PAUSE_THRESHOLD = 0.25
LONG_PAUSE = 1.0


def fluency_metrics(words: list[WordTiming], duration: float, text: str) -> dict:
    tokens = normalize(text, expand_contractions=False).split()
    fillers = sum(1 for t in tokens if t in FILLERS_EN or t in FILLERS_PT)
    n = len(words) or count_words(text)
    out: dict = {"words": n, "duration_seconds": round(duration, 2), "filled_pauses": fillers}
    if duration <= 1 or n == 0:
        return out | {"speech_rate_wpm": None}
    out["speech_rate_wpm"] = round(n / duration * 60, 1)
    if len(words) >= 2:
        gaps = [max(0.0, b.start - a.end) for a, b in zip(words, words[1:], strict=False)]
        pauses = [g for g in gaps if g >= PAUSE_THRESHOLD]
        pause_time = sum(pauses)
        speaking_time = max(duration - pause_time, 0.1)
        runs, current = [], 1
        for g in gaps:
            if g >= PAUSE_THRESHOLD:
                runs.append(current)
                current = 1
            else:
                current += 1
        runs.append(current)
        out |= {
            "articulation_rate_wpm": round(n / speaking_time * 60, 1),
            "silent_pauses": len(pauses),
            "long_pauses": sum(1 for g in pauses if g >= LONG_PAUSE),
            "pauses_per_minute": round(len(pauses) / duration * 60, 1),
            "mean_length_of_run": round(sum(runs) / len(runs), 2),
            "phonation_time_ratio": round(speaking_time / duration, 3),
        }
    return out


def shadowing_feedback(
    *,
    reference: str,
    transcript: str,
    duration: float,
    words: list[WordTiming] | None = None,
    stt_confidence: float | None = None,
    rate: float = 1.0,
    pronunciation: PronunciationResult | None = None,
) -> dict:
    words = words or []
    ref_words = normalize(reference).split()
    expected_seconds = len(ref_words) / (150 * rate) * 60  # modelo de TTS ~150 palavras/min em 1.0x
    alignment = align_words(reference, transcript)
    ok = sum(1 for a in alignment if a.op == "ok")
    word_accuracy = ok / len(ref_words) if ref_words else 0.0

    reasons: list[str] = []
    if not transcript.strip():
        reasons.append("Nenhuma fala foi reconhecida (silêncio, ruído ou microfone bloqueado).")
    if stt_confidence is not None and stt_confidence < 0.5:
        reasons.append("A qualidade do áudio parece baixa (confiança do reconhecimento < 50%).")
    if duration and duration < 0.4 * expected_seconds:
        reasons.append("A gravação parece incompleta (muito mais curta que a frase-modelo).")
    if transcript.strip() and word_accuracy < 0.3 and stt_confidence is None:
        reasons.append("O texto reconhecido é muito diferente da frase — pode ser ruído ou outra frase.")

    result: dict = {
        "reference": reference,
        "recognized": transcript,
        "method": "azure_pronunciation_assessment" if pronunciation and pronunciation.overall is not None else "transcript_alignment",
        "notes_pt": [],
    }
    if reasons:
        return result | {
            "status": "inconclusive",
            "reasons_pt": reasons,
            "advice_pt": "Grave novamente em um lugar silencioso, com o microfone a ~15 cm da boca, e fale a frase completa.",
        }

    missing = [a.ref for a in alignment if a.op == "del"]
    substitutions = [{"expected": a.ref, "heard": a.hyp} for a in alignment if a.op == "sub"]
    extra = [a.hyp for a in alignment if a.op == "ins"]
    fm = fluency_metrics(words, duration, transcript)
    ratio = round(duration / expected_seconds, 2) if expected_seconds and duration else None

    pauses_inside = []
    if len(words) >= 2:
        for a, b in zip(words, words[1:], strict=False):
            if b.start - a.end >= 0.4:
                pauses_inside.append({"between": [a.word, b.word], "seconds": round(b.start - a.end, 2)})

    tips: list[str] = []
    for s in substitutions[:3]:
        tips.append(f"'{s['expected']}' foi reconhecida como '{s['heard']}'. Repita a palavra isolada 3× e depois a frase.")
    if missing:
        tips.append("Palavras não reconhecidas: " + ", ".join(missing[:5]) + ". Em connected speech elas ficam fracas, mas devem existir.")
    if ratio and ratio > 1.4:
        tips.append(f"Você levou {ratio}× o tempo do modelo. Tente agrupar as palavras em blocos, sem pausas entre elas.")
    elif ratio and ratio < 0.75:
        tips.append("Você falou mais rápido que o modelo — priorize clareza antes de velocidade.")
    if pauses_inside:
        p = pauses_inside[0]
        tips.append(f"Pausa de {p['seconds']} s entre '{p['between'][0]}' e '{p['between'][1]}': tente ligar essas palavras.")
    if not tips:
        tips.append("Ótimo! O reconhecedor entendeu a frase inteira. Agora tente acompanhar o modelo ao mesmo tempo (shadowing simultâneo).")

    result |= {
        "status": "ok",
        "intelligibility": round(word_accuracy * 100, 1),
        "word_alignment": [{"op": a.op, "expected": a.ref, "heard": a.hyp} for a in alignment],
        "missing_words": missing,
        "substitutions": substitutions,
        "extra_words": extra,
        "timing": {"duration_seconds": round(duration, 2), "model_seconds": round(expected_seconds, 2), "ratio": ratio,
                   "pauses_inside_phrase": pauses_inside},
        "fluency": fm,
        "tips_pt": tips,
    }
    result["notes_pt"].append(
        "Inteligibilidade estimada = % das palavras que o reconhecedor de fala entendeu. Sotaque estrangeiro compreensível não é penalizado."
    )
    if pronunciation and pronunciation.overall is not None:
        result["pronunciation_scores"] = {
            "accuracy": pronunciation.accuracy, "fluency": pronunciation.fluency, "completeness": pronunciation.completeness,
            "prosody": pronunciation.prosody, "overall": pronunciation.overall,
        }
        weak = [w for w in pronunciation.words if (w.get("accuracy") or 100) < 60]
        if weak:
            result["tips_pt"].insert(0, "Palavras com pronúncia menos clara: " + ", ".join(w["word"] for w in weak[:5]) + ".")
    else:
        result["notes_pt"].append("Este método não avalia fonemas individualmente. Para notas por fonema, configure a avaliação de pronúncia (Azure).")
    return result
