"""Normalização de texto, alinhamento de palavras, WER e similaridade para correção de respostas."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

_CONTRACTIONS = {
    "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are", "he's": "he is",
    "she's": "she is", "it's": "it is", "that's": "that is", "there's": "there is", "what's": "what is",
    "i've": "i have", "you've": "you have", "we've": "we have", "they've": "they have",
    "i'll": "i will", "you'll": "you will", "we'll": "we will", "they'll": "they will", "it'll": "it will",
    "i'd": "i would", "you'd": "you would", "we'd": "we would", "they'd": "they would",
    "don't": "do not", "doesn't": "does not", "didn't": "did not", "can't": "cannot", "won't": "will not",
    "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
    "haven't": "have not", "hasn't": "has not", "couldn't": "could not", "shouldn't": "should not",
    "wouldn't": "would not", "let's": "let us", "gonna": "going to", "wanna": "want to",
}  # fmt: skip

_WORD_RE = re.compile(r"[\w']+", re.UNICODE)
FILLERS_EN = {"um", "uh", "uhm", "erm", "er", "hmm", "mm", "ah"}
FILLERS_PT = {"é", "eh", "tipo", "né", "então", "ãh", "ahn"}


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def normalize(text: str, *, expand_contractions: bool = True, keep_accents: bool = True) -> str:
    t = text.lower().replace("’", "'").replace("‘", "'")
    t = unicodedata.normalize("NFC", t)
    if not keep_accents:
        t = strip_accents(t)
    words = _WORD_RE.findall(t)
    if expand_contractions:
        out: list[str] = []
        for w in words:
            out.extend(_CONTRACTIONS.get(w, w).split())
        words = out
    return " ".join(words)


def tokenize(text: str) -> list[str]:
    return normalize(text).split()


def levenshtein(a: list | str, b: list | str) -> int:
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def similarity(a: str, b: str) -> float:
    """Similaridade de caracteres 0..1 após normalização."""
    na, nb = normalize(a, keep_accents=False), normalize(b, keep_accents=False)
    if not na and not nb:
        return 1.0
    return 1.0 - levenshtein(na, nb) / max(len(na), len(nb))


def word_error_rate(reference: str, hypothesis: str) -> float:
    ref, hyp = tokenize(reference), tokenize(hypothesis)
    if not ref:
        return 0.0 if not hyp else 1.0
    return levenshtein(ref, hyp) / len(ref)


@dataclass
class WordAlignment:
    op: str  # ok | sub | del | ins
    ref: str | None
    hyp: str | None


def align_words(reference: str, hypothesis: str) -> list[WordAlignment]:
    """Alinhamento por programação dinâmica (Levenshtein) com backtrace."""
    ref, hyp = tokenize(reference), tokenize(hypothesis)
    n, m = len(ref), len(hyp)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if ref[i - 1] == hyp[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    out: list[WordAlignment] = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + (ref[i - 1] != hyp[j - 1]):
            out.append(WordAlignment("ok" if ref[i - 1] == hyp[j - 1] else "sub", ref[i - 1], hyp[j - 1]))
            i, j = i - 1, j - 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            out.append(WordAlignment("del", ref[i - 1], None))
            i -= 1
        else:
            out.append(WordAlignment("ins", None, hyp[j - 1]))
            j -= 1
    out.reverse()
    return out


_ARTICLES = {"a", "an", "the"}


def answer_matches(answer: str, accepted: list[str], *, tolerance: float = 0.85) -> tuple[bool, float, str]:
    """Verifica uma resposta de recuperação ativa contra respostas aceitas.

    Tolera pequenos erros de digitação e artigos opcionais. Retorna (correto, similaridade, melhor_alvo).
    """
    best, best_target = 0.0, accepted[0] if accepted else ""
    a_norm = " ".join(w for w in normalize(answer, keep_accents=False).split() if w not in _ARTICLES)
    for target in accepted:
        t_norm = " ".join(w for w in normalize(target, keep_accents=False).split() if w not in _ARTICLES)
        if not t_norm:
            continue
        if a_norm == t_norm:
            return True, 1.0, target
        sim = 1.0 - levenshtein(a_norm, t_norm) / max(len(a_norm), len(t_norm), 1)
        if sim > best:
            best, best_target = sim, target
    # Respostas curtas exigem precisão maior (evita "on" ≈ "in")
    min_len = min((len(normalize(t)) for t in accepted), default=0)
    threshold = 0.97 if min_len <= 4 else tolerance
    return best >= threshold, best, best_target


def lexical_diversity(text: str, window: int = 25) -> float:
    """MATTR (moving-average type-token ratio) — menos sensível ao tamanho do texto que o TTR simples."""
    words = tokenize(text)
    if not words:
        return 0.0
    if len(words) <= window:
        return len(set(words)) / len(words)
    ratios = [len(set(words[i : i + window])) / window for i in range(len(words) - window + 1)]
    return sum(ratios) / len(ratios)


def count_words(text: str) -> int:
    return len(_WORD_RE.findall(text))


def looks_portuguese(text: str) -> bool:
    """Heurística leve para o modo 'No Portuguese' (palavras funcionais frequentes do PT)."""
    pt_markers = {"não", "você", "voce", "é", "está", "eu", "que", "isso", "como", "por", "fala", "português",
                  "obrigado", "tudo", "também", "porque", "então", "mas", "uma", "com", "pra", "para"}  # fmt: skip
    words = normalize(text).split()
    if not words:
        return False
    hits = sum(1 for w in words if w in pt_markers)
    return hits / len(words) >= 0.25 and hits >= 2
