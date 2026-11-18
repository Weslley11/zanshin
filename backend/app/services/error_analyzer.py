"""Detector determinístico de erros de interferência do português (L1) no inglês (L2).

Não substitui a correção por IA: é uma camada rápida, gratuita e auditável que
(1) funciona sem provedor de IA (modo offline), (2) complementa o LLM com erros
frequentes de brasileiros e (3) serve de linha de base no harness de avaliação.

Cada regra foi escrita para ter baixa taxa de falso positivo; casos negativos estão
nos testes (tests/test_error_analyzer.py).
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import asdict, dataclass


@dataclass
class Correction:
    original: str
    corrected: str
    explanation_pt: str
    category: str  # grammar | vocabulary | word_choice | false_friend | pronunciation
    subtype: str
    severity: str  # minor | may_confuse | blocks_understanding
    rule_id: str = ""
    source: str = "rules"

    def to_dict(self) -> dict:
        return asdict(self)


Replacer = str | Callable[[re.Match], str]


@dataclass
class Rule:
    id: str
    pattern: re.Pattern
    replacement: Replacer
    category: str
    subtype: str
    explanation_pt: str
    severity: str = "minor"
    guard: Callable[[str, re.Match], bool] | None = None  # retorna False para descartar o match


def _r(pattern: str) -> re.Pattern:
    return re.compile(pattern, re.IGNORECASE)


_IRREGULAR_PP = {
    "went": "gone", "did": "done", "saw": "seen", "ate": "eaten", "wrote": "written", "took": "taken",
    "gave": "given", "spoke": "spoken", "came": "come", "began": "begun", "drank": "drunk",
    "knew": "known", "broke": "broken", "chose": "chosen", "forgot": "forgotten", "drove": "driven",
}  # fmt: skip
_BASE_FROM_PAST = {
    "went": "go", "did": "do", "saw": "see", "ate": "eat", "wrote": "write", "took": "take", "gave": "give",
    "spoke": "speak", "came": "come", "made": "make", "had": "have", "said": "say", "got": "get",
    "bought": "buy", "thought": "think", "found": "find", "told": "tell", "knew": "know", "sent": "send",
    "worked": "work", "finished": "finish", "started": "start", "called": "call", "needed": "need",
}  # fmt: skip
_COMPARATIVES = {
    "easy": "easier", "cheap": "cheaper", "fast": "faster", "big": "bigger", "small": "smaller",
    "hard": "harder", "busy": "busier", "high": "higher", "low": "lower", "long": "longer",
    "short": "shorter", "quick": "quicker", "old": "older", "good": "better", "bad": "worse",
}  # fmt: skip
_UNCOUNTABLE = {
    "informations": "information", "equipments": "equipment", "advices": "advice", "feedbacks": "feedback",
    "softwares": "software", "hardwares": "hardware", "furnitures": "furniture", "knowledges": "knowledge",
    "homeworks": "homework", "luggages": "luggage", "baggages": "baggage",
}  # fmt: skip
_TENSE = {"": "", "s": "s", "es": "s", "ed": "ed", "d": "ed", "ing": "ing", "e": "", "t": "ed"}


def _keep_case(src: str, repl: str) -> str:
    return repl[0].upper() + repl[1:] if src[:1].isupper() and repl else repl


def _verb(base: str, suffix: str | None) -> str:
    """Conjuga verbos regulares simples para a mesma forma do verbo original."""
    suffix = (suffix or "").lower()
    if suffix in ("s", "es"):
        return {"have": "has", "do": "does", "go": "goes"}.get(base, base + "s")
    if suffix in ("ed", "d", "t"):
        irregular = {"make": "made", "have": "had", "do": "did", "hold": "held", "miss": "missed"}
        if base in irregular:
            return irregular[base]
        return base[:-1] + "ied" if base.endswith("y") and base[-2:-1] not in "aeiou" else base + "ed"
    if suffix == "ing":
        return {"make": "making", "have": "having"}.get(base, base + "ing")
    return base


def _not_after_aux(sentence: str, m: re.Match) -> bool:
    before = sentence[: m.start()].lower().rstrip()
    return not re.search(r"\b(does|did|doesn't|didn't|will|would|can|could|should|must|might|may|to|let|make|help|why|does not|did not)$", before)


def _assist(m: re.Match) -> str:
    obj = m.group(3).lower()
    base = "watch" if obj in ("movie", "film", "game") else "attend"
    return f"{_verb(base, m.group(1))} {m.group(2)} {m.group(3)}"


RULES: list[Rule] = [
    Rule("am_agree", _r(r"\b(I|we|they|you)(\s+am|\s+are|'m|'re)\s+agree\b"), lambda m: f"{m.group(1)} agree",
         "grammar", "verb_agree", "Em inglês, 'agree' é verbo: diga 'I agree' (não 'I am agree')."),
    Rule("depend_of", _r(r"\bdepend(s|ed|ing)?\s+of\b"), lambda m: f"depend{m.group(1) or ''} on",
         "grammar", "preposition", "A preposição de 'depend' é 'on': 'It depends on…'."),
    Rule("explain_me", _r(r"\bexplain\s+(me|him|her|us|them)\b"), lambda m: f"explain to {m.group(1)}",
         "grammar", "verb_pattern", "'Explain' pede 'to' antes da pessoa: 'Can you explain to me…?' ou 'Can you explain it?'."),
    Rule("present_since", _r(r"\b(I|we|they|you)\s+(work|live|study|am working|am living|'m working|'m living)\s+((?:here|there|in\s+[\w ]{2,30}?|at\s+[\w ]{2,30}?|with\s+[\w ]{2,20}?)\s+)since\b"),
         lambda m: f"{m.group(1)} have been {('working' if 'work' in m.group(2) else 'living' if 'liv' in m.group(2) else 'studying')} {m.group(3)}since",
         "grammar", "present_perfect", "Para algo que começou no passado e continua: present perfect — 'I have worked / have been working here since 2020'."),
    Rule("since_duration", _r(r"\bsince\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a few|many)\s+(years?|months?|weeks?|days?|hours?)\b(?!\s+ago)"),
         lambda m: f"for {m.group(1)} {m.group(2)}", "grammar", "for_since",
         "'Since' marca o ponto de início (since 2020); para duração use 'for' (for 3 years).", "may_confuse"),
    Rule("have_age", _r(r"\b(I|you|we|they)\s+have\s+(\d{1,2})\s+years(\s+old)?(?=\s*(?:and\b|[.,!?;]|$))"),
         lambda m: f"{m.group(1)} {'am' if m.group(1).lower() == 'i' else 'are'} {m.group(2)} years old",
         "grammar", "age", "Idade usa 'to be': 'I am 35 (years old)', não 'I have 35 years'."),
    Rule("has_age", _r(r"\b(he|she)\s+has\s+(\d{1,2})\s+years(\s+old)?(?=\s*(?:and\b|[.,!?;]|$))"),
         lambda m: f"{m.group(1)} is {m.group(2)} years old",
         "grammar", "age", "Idade usa 'to be': 'She is 30', não 'She has 30 years'."),
    Rule("make_question", _r(r"\bmak(e|es|ing)\s+a\s+question\b"),
         lambda m: _verb("ask", m.group(1)) + " a question",
         "vocabulary", "collocation", "Collocation: 'ask a question' (não 'make a question')."),
    Rule("do_mistake", _r(r"\b(do|does|did|doing)\s+((?:a|many|some|a lot of|several)\s+)mistake(s?)\b"),
         lambda m: {"do": "make", "does": "makes", "did": "made", "doing": "making"}[m.group(1).lower()] + f" {m.group(2)}mistake{m.group(3)}",
         "vocabulary", "collocation", "Collocation: 'make a mistake' (não 'do a mistake')."),
    Rule("make_meeting", _r(r"\bmak(e|es|ing)\s+a\s+meeting\b"),
         lambda m: _verb("have", m.group(1)) + " a meeting",
         "vocabulary", "collocation", "Em inglês: 'have/hold a meeting' (decalque de 'fazer uma reunião')."),
    Rule("realize_event", _r(r"\breali[sz](e|es|ed|ing)\s+(a|the|an)\s+(meeting|test|project|task|presentation|training|event|audit|inspection)\b"),
         lambda m: f"{_verb('hold' if m.group(3).lower() in ('meeting', 'event', 'training', 'presentation') else 'carry', m.group(1))}{'' if m.group(3).lower() in ('meeting', 'event', 'training', 'presentation') else ' out'} {m.group(2)} {m.group(3)}",
         "false_friend", "realize", "Falso cognato: 'realize' = perceber. 'Realizar' (executar) = 'carry out / hold / conduct'.", "may_confuse"),
    Rule("people_is", _r(r"\b(the\s+)?people\s+(is|was|has)\b"),
         lambda m: f"{m.group(1) or ''}people {({'is': 'are', 'was': 'were', 'has': 'have'})[m.group(2).lower()]}",
         "grammar", "agreement", "'People' é plural: 'people are / were / have'."),
    Rule("third_person_dont", _r(r"\b(he|she|it)\s+don'?t\b"), lambda m: f"{m.group(1)} doesn't",
         "grammar", "third_person", "Na 3ª pessoa do singular (he/she/it) o auxiliar é 'doesn't'."),
    Rule("third_person_have", _r(r"\b(he|she|it)\s+have\b(?!\s+(?:been|had|got|done|seen|gone|made|taken|to)\b)"),
         lambda m: f"{m.group(1)} has", "grammar", "third_person",
         "Na 3ª pessoa do singular use 'has': 'she has a meeting'.", guard=_not_after_aux),
    Rule("have_past", _r(r"\b(have|has|had)\s+(went|did|saw|ate|wrote|took|gave|spoke|came|began|drank|knew|broke|chose|forgot|drove)\b"),
         lambda m: f"{m.group(1)} {_IRREGULAR_PP[m.group(2).lower()]}", "grammar", "past_participle",
         "Depois de 'have/has/had' usa-se o particípio: 'have gone', 'have done', 'have seen'."),
    Rule("did_past", _r(r"\b(didn't|did not|did)\s+((?:you|he|she|they|we|i|it)\s+)?(" + "|".join(_BASE_FROM_PAST) + r")\b"),
         lambda m: f"{m.group(1)} {m.group(2) or ''}{_BASE_FROM_PAST[m.group(3).lower()]}", "grammar", "did_base_form",
         "Com 'did/didn't' o verbo principal fica na forma base: 'I didn't go', 'Did you finish?'."),
    Rule("modal_s", _r(r"\b(can|could|will|would|should|must|might)\s+(goes|does|works|needs|has|makes|takes|gets|wants|knows|sends|says)\b"),
         lambda m: f"{m.group(1)} " + ({"goes": "go", "does": "do", "has": "have"}.get(m.group(2).lower()) or m.group(2)[:-1]),
         "grammar", "modal_base_form", "Depois de modal (can, will, should…) o verbo fica na forma base, sem -s."),
    Rule("modal_to", _r(r"\b(can|could|will|would|should|must|might)\s+to\s+(\w+)"),
         lambda m: f"{m.group(1)} {m.group(2)}", "grammar", "modal_base_form",
         "Modais não levam 'to': 'I can go' (não 'I can to go')."),
    Rule("do_you_can", _r(r"\bdo\s+you\s+can\b"), "can you", "grammar", "question_form",
         "Com 'can' a pergunta inverte o modal: 'Can you…?' (não 'Do you can…?')."),
    Rule("more_comparative", _r(r"\bmore\s+(" + "|".join(_COMPARATIVES) + r")\b(?=\s+than\b|\s+to\b|\s*[.,!?;]|\s*$)"),
         lambda m: _COMPARATIVES[m.group(1).lower()], "grammar", "comparative",
         "Adjetivos curtos fazem comparativo com -er: 'easier', 'cheaper', 'faster' (good → better)."),
    Rule("uncountable_plural", _r(r"\b(" + "|".join(_UNCOUNTABLE) + r")\b"),
         lambda m: _keep_case(m.group(1), _UNCOUNTABLE[m.group(1).lower()]), "grammar", "uncountable",
         "Este substantivo é incontável em inglês: sem plural (use 'pieces of information', 'some advice')."),
    Rule("assist_event", _r(r"\bassist(s|ed|ing)?\s+(the|a|an)\s+(meeting|movie|film|class|lecture|presentation|game|training|conference|webinar)\b"),
         _assist, "false_friend", "assist",
         "Falso cognato: 'assist' = ajudar. 'Assistir a uma reunião' = 'attend a meeting'; 'assistir a um filme' = 'watch a movie'.", "may_confuse"),
    Rule("pretend_to", _r(r"\b(I|we)\s+pretend\s+to\s+(?!be\b|know\b|understand\b|like\b)(\w+)"),
         lambda m: f"{m.group(1)} intend to {m.group(2)}", "false_friend", "pretend",
         "Falso cognato: 'pretend' = fingir. Se quis dizer 'pretendo fazer', use 'intend to / plan to'.", "may_confuse"),
    Rule("lose_flight", _r(r"\blos(e|es|t|ing)\s+(the|my|our|a|his|her|their)\s+(flight|bus|train|plane|connection|meeting|deadline|appointment)\b"),
         lambda m: f"{_verb('miss', {'e': '', 'es': 'es', 't': 'ed', 'ing': 'ing'}[m.group(1).lower()])} {m.group(2)} {m.group(3)}".replace("misss", "misses"),
         "vocabulary", "lose_miss", "'Perder' um voo/ônibus/prazo = 'miss'. 'Lose' = perder algo que some (lose my passport).", "may_confuse"),
    Rule("have_doubt", _r(r"\b(I|we)\s+have\s+(a|one|some|a few)?\s*doubts?\b(?!\s+(?:that|whether|about\s+whether)\b)"),
         lambda m: f"{m.group(1)} have {m.group(2) + ' ' if m.group(2) else 'some '}question{'' if (m.group(2) or '').lower() in ('a', 'one') else 's'}",
         "vocabulary", "doubt_question", "'Tenho uma dúvida' = 'I have a question'. 'Doubt' expressa desconfiança/incerteza.", "may_confuse"),
    Rule("discuss_about", _r(r"\bdiscuss(es|ed|ing)?\s+about\b"), lambda m: f"discuss{m.group(1) or ''}",
         "grammar", "preposition", "'Discuss' não leva 'about': 'discuss the project' (mas 'talk about')."),
    Rule("arrive_to", _r(r"\barriv(e|es|ed|ing)\s+to\b"), lambda m: f"arriv{m.group(1)} at",
         "grammar", "preposition", "Use 'arrive at' (lugar específico) ou 'arrive in' (cidade/país), não 'arrive to'."),
    Rule("dummy_subject", _r(r"(^|[.!?]\s+)(is|was)\s+(possible|necessary|important|difficult|raining)\b"),
         lambda m: (f"{m.group(1)}{m.group(2)} it {m.group(3)}" if m.string.rstrip().endswith("?")
                    else f"{m.group(1)}{_keep_case(m.group(2), 'it')} {m.group(2).lower()} {m.group(3)}"),
         "grammar", "dummy_subject",
         "Inglês exige sujeito: 'It is possible…', 'It's raining' (o português omite)."),
    Rule("like_very_much", _r(r"\b(like|love|enjoy)\s+very\s+much\s+([^,.!?;]+)"),
         lambda m: f"{m.group(1)} {m.group(2).strip()} very much", "grammar", "word_order",
         "Ordem: 'I like it very much' / 'I really like…' (o advérbio vem depois do objeto)."),
    Rule("how_call", _r(r"\bhow\s+do\s+you\s+call\b"), "what do you call", "vocabulary", "question_form",
         "Para perguntar o nome de algo: 'What do you call…?' / 'How do you say…?'."),
    Rule("in_the_weekend", _r(r"\bin\s+the\s+weekend\b"), "on the weekend", "grammar", "preposition",
         "Diga 'on the weekend' (EUA) ou 'at the weekend' (Reino Unido)."),
    Rule("born", _r(r"\bI\s+born\b"), "I was born", "grammar", "passive",
         "'Nascer' em inglês é passiva: 'I was born in…'."),
    Rule("actually_currently", _r(r"(^|[.!?]\s+)actually\s+(I\s+work|I\s+am\s+working|I'm\s+working|we\s+are\s+working|we\s+work|I\s+live)\b"),
         lambda m: f"{m.group(1)}Currently {m.group(2)}", "false_friend", "actually",
         "Se quis dizer 'atualmente', use 'currently / nowadays'. 'Actually' significa 'na verdade'.", "may_confuse"),
]


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p for p in parts if p]


def _apply_rule(rule: Rule, sentence: str) -> tuple[str, bool]:
    changed = False
    out, pos = [], 0
    for m in rule.pattern.finditer(sentence):
        if rule.guard and not rule.guard(sentence, m):
            continue
        repl = rule.replacement(m) if callable(rule.replacement) else _keep_case(m.group(0), rule.replacement)
        out.append(sentence[pos : m.start()])
        out.append(repl)
        pos = m.end()
        changed = changed or repl.lower() != m.group(0).lower()
    out.append(sentence[pos:])
    return re.sub(r"\s{2,}", " ", "".join(out)).strip(), changed


def analyze_english(text: str) -> list[Correction]:
    """Aplica as regras sentença a sentença.

    Cada correção traz a frase original, a frase com todas as correções aplicadas e a
    explicação específica da regra que a detectou.
    """
    corrections: list[Correction] = []
    for sentence in _split_sentences(text):
        found = [rule for rule in RULES if _apply_rule(rule, sentence)[1]]
        if not found:
            continue
        full = correct_text(sentence)  # a frase mostrada ao aprendiz traz TODAS as correções aplicadas
        for rule in found:
            corrections.append(
                Correction(sentence, full, rule.explanation_pt, rule.category, rule.subtype, rule.severity, rule.id)
            )
    return corrections


def correct_text(text: str) -> str:
    """Texto com todas as regras aplicadas cumulativamente."""
    out = []
    for sentence in _split_sentences(text):
        for rule in RULES:
            sentence, _ = _apply_rule(rule, sentence)
        out.append(sentence)
    return " ".join(out)


_SPANISH_FALSE_FRIENDS = {
    "exquisito": "Em espanhol 'exquisito' = delicioso/refinado (não 'esquisito' = 'raro/extraño').",
    "embarazada": "'Embarazada' = grávida (não 'envergonhada' = 'avergonzada').",
    "oficina": "'Oficina' = escritório (oficina mecânica = 'taller').",
    "polvo": "'Polvo' = pó (o animal é 'pulpo').",
    "borracha": "'Borracha' = bêbada (borracha de apagar = 'goma').",
    "rato": "'Rato' = momento/instante (o animal é 'ratón').",
    "cena": "'Cena' = jantar (cena de filme = 'escena').",
    "exprimir": "'Exprimir' = espremer (expressar = 'expresar').",
    "largo": "'Largo' = comprido (largo = 'ancho').",
    "pronto": "'Pronto' = logo/em breve (pronto = 'listo').",
    "salsa": "'Salsa' = molho (salsinha = 'perejil').",
    "apellido": "'Apellido' = sobrenome (apelido = 'apodo').",
    "acordarse": "'Acordarse' = lembrar-se (acordar = 'despertarse').",
    "cachorro": "'Cachorro' = filhote (cachorro = 'perro').",
    "tirar": "'Tirar' = jogar fora/atirar (tirar foto = 'sacar una foto').",
    "presunto": "'Presunto' = suposto (presunto = 'jamón').",
}


def analyze_spanish(text: str) -> list[Correction]:
    out: list[Correction] = []
    for sentence in _split_sentences(text):
        words = set(re.findall(r"\w+", sentence.lower()))
        for ff, note in _SPANISH_FALSE_FRIENDS.items():
            if ff in words:
                out.append(Correction(sentence, sentence, f"Atenção ao falso cognato: {note}", "false_friend",
                                      ff, "may_confuse", f"es_ff_{ff}"))
    return out


def analyze(text: str, language: str) -> list[Correction]:
    if language == "en":
        return analyze_english(text)
    if language == "es":
        return analyze_spanish(text)
    return []
