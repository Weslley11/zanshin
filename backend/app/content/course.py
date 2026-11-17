"""Trilha: curso gamificado em unidades e lições curtas (estilo "caminho de lições"), montado a partir do conteúdo do app.

Cada unidade tem 2 lições de 5 itens novos e 1 lição de revisão (todos os itens da unidade). Os exercícios em si são
gerados no cliente (escolha, montar frase, ouvir, pares, lacuna, falar/digitar) a partir dos itens; aqui ficam só a
estrutura e os itens. A ordem intercala frases do dia a dia, viagem, trabalho e Índia — do mais útil ao mais específico.
"""

from __future__ import annotations

import re

from app.content.en_vocab import VOCAB_EN
from app.content.india import VOCAB_EN_INDIA
from app.content.india_missions import MISSIONS

LESSON_SIZE = 5
XP_BASE = 10
XP_PERFECT_BONUS = 5
DAILY_GOAL_OPTIONS = [20, 30, 50]


def _variants(term: str) -> list[str]:
    """Mesmas variações aceitas da revisão de vocabulário ('follow up (on)' → 'follow up', 'a / b' → 'a', 'b')."""
    base = re.sub(r"\s*\([^)]*\)", "", term).replace("…", "").strip(" .?!")
    out = [term.strip()]
    for v in [base, *re.split(r"\s*/\s*", base)]:
        v = v.strip(" .?!")
        if v and v not in out:
            out.append(v)
    return out


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40]


def _vocab_items(rows: list[tuple], kind: str | None = None, domain: str | None = None) -> list[dict]:
    sel = [r for r in rows if (kind is None or r[1] == kind) and (domain is None or r[4] == domain)]
    sel.sort(key=lambda r: (r[6], r[0]))
    return [{"id": "v-" + _slug(r[0]), "en": r[0], "pt": r[2], "example": r[3].split(" / ")[0], "alts": _variants(r[0])[1:],
             "level": r[5]} for r in sel]


def _mission_items(mission_id: str) -> list[dict]:
    m = next(x for x in MISSIONS if x["id"] == mission_id)
    return [{"id": c["id"], "en": c["en"], "pt": c["pt"].split(" (")[0] if c["kind"] == "hear" else c["pt"], "example": "",
             "alts": list(c.get("alts", [])), "level": c["level"], "kind": c["kind"]} for c in m["chunks"]]


_PHRASES = _vocab_items(VOCAB_EN, kind="phrase")
_TRAVEL = _vocab_items(VOCAB_EN, kind="travel")
_CORP = _vocab_items(VOCAB_EN, kind="corporate")
_PHRASAL = _vocab_items(VOCAB_EN, kind="phrasal_verb")
_COLLOC = _vocab_items(VOCAB_EN, kind="collocation")
_IDIOM = _vocab_items(VOCAB_EN, kind="idiom")
_TECH = _vocab_items(VOCAB_EN, kind="technical")
_INDIA = _vocab_items(VOCAB_EN_INDIA)

# (título, ícone, itens) — 10 itens por unidade
_SPEC: list[tuple[str, str, list[dict]]] = [
    ("Frases para destravar a conversa", "chatbubbles", _PHRASES[0:10]),
    ("Apresentações", "people", _mission_items("m01")),
    ("Entender o inglês indiano", "ear", _mission_items("m02")),
    ("Na viagem", "airplane", _TRAVEL[0:10]),
    ("Imigração e aeroporto", "id-card", _mission_items("m05")),
    ("Transporte", "car", _mission_items("m06")),
    ("Mais frases de conversa", "chatbox-ellipses", _PHRASES[10:20]),
    ("Hotel, chip e dinheiro", "bed", _mission_items("m07")),
    ("Comida e convites", "restaurant", _mission_items("m08")),
    ("Reuniões e calls", "videocam", _mission_items("m03")),
    ("E-mail e rotina de trabalho", "mail", _mission_items("m04")),
    ("Inglês corporativo", "briefcase", _CORP[0:10]),
    ("Phrasal verbs 1", "git-branch", _PHRASAL[0:10]),
    ("Expressões do inglês indiano", "earth", _INDIA[0:10]),
    ("Na planta", "construct", _mission_items("m09")),
    ("Vocabulário técnico 1", "cog", _TECH[0:10]),
    ("Prazos e o \"não\" indireto", "calendar", _mission_items("m10")),
    ("Números e preços", "cash", _mission_items("m11")),
    ("Erros que brasileiros cometem", "alert-circle", _mission_items("m12")),
    ("Combinações naturais", "link", _COLLOC[0:10]),
    ("Phrasal verbs 2", "git-branch", _PHRASAL[10:20]),
    ("Mais expressões indianas", "earth", _INDIA[10:20]),
    ("Vocabulário técnico 2", "cog", _TECH[10:20]),
    ("Viagem 2", "map", _TRAVEL[10:20]),
    ("Imprevistos e palavras em hindi", "medkit", _mission_items("m13")),
    ("Frases avançadas de conversa", "sparkles", _PHRASES[20:35]),
    ("Expressões idiomáticas", "bulb", _IDIOM[0:10]),
    ("Inglês corporativo 2", "briefcase", _CORP[10:20]),
    ("Phrasal verbs 3", "git-branch", _PHRASAL[20:30]),
    ("Expressões indianas 3", "earth", _INDIA[20:30]),
    ("Vocabulário técnico 3", "cog", _TECH[20:30]),
    ("Vocabulário técnico 4", "cog", _TECH[30:41]),
]


def _build() -> list[dict]:
    units: list[dict] = []
    seen: set[str] = set()
    for title, icon, items in _SPEC:
        items = [i for i in items if i["id"] not in seen]
        seen.update(i["id"] for i in items)
        if len(items) < LESSON_SIZE:
            continue
        uid = f"u{len(units) + 1:02d}"
        lessons = []
        chunks = [items[k:k + LESSON_SIZE] for k in range(0, len(items), LESSON_SIZE)]
        if len(chunks) > 1 and len(chunks[-1]) < 3:  # sobra pequena vai para a lição anterior
            chunks[-2].extend(chunks.pop())
        for k, part in enumerate(chunks, start=1):
            lessons.append({"id": f"{uid}-l{k}", "kind": "learn", "title_pt": f"Lição {k}", "item_ids": [i["id"] for i in part]})
        lessons.append({"id": f"{uid}-r", "kind": "review", "title_pt": "Revisão da unidade", "item_ids": [i["id"] for i in items]})
        levels = sorted({i["level"] for i in items})
        units.append({"id": uid, "order": len(units) + 1, "title_pt": title, "icon": icon, "levels": levels,
                      "items": items, "lessons": lessons})
    return units


UNITS: list[dict] = _build()
LESSONS: dict[str, dict] = {lesson["id"]: lesson | {"unit_id": u["id"]} for u in UNITS for lesson in u["lessons"]}
ORDER: list[str] = [lesson["id"] for u in UNITS for lesson in u["lessons"]]


def xp_for(correct_first: int, total: int) -> int:
    """XP da lição: base + 1 por exercício certo de primeira (máx. 10) + bônus de lição perfeita."""
    total = max(total, 1)
    correct_first = max(0, min(correct_first, total))
    return XP_BASE + min(10, correct_first) + (XP_PERFECT_BONUS if correct_first == total else 0)
