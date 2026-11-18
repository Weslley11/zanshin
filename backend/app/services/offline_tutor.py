"""Tutor determinístico para quando não há IA generativa configurada (ou o orçamento acabou).

É deliberadamente simples e o app o identifica como 'Modo offline (sem IA generativa)':
segue roteiros de cenário e listas de perguntas por nível, detecta erros por regras de
interferência do português e gera relatório a partir de métricas reais da sessão.
"""

from __future__ import annotations

from collections import Counter

from app.content.drills import (
    BACKCHANNELS_EN,
    CONVERSATION_TOPICS_EN,
    ELABORATE_EN,
    FOLLOW_UPS_EN,
    QUICK_RESPONSE_EN,
    TOPIC_TRANSITIONS_EN,
)
from app.content.other_languages import QUICK_RESPONSE_OTHER
from app.services.error_analyzer import Correction, correct_text
from app.services.text_utils import count_words, looks_portuguese, normalize

_GENERIC_OPENING = {
    "en": "Hi! I'm Alex, your practice partner. Let's just talk. {topic}",
    "es": "¡Hola! Soy Lucía. Vamos a conversar un poco. ¿Qué tal tu día?",
    "it": "Ciao! Sono Marco. Facciamo due chiacchiere. Come stai oggi?",
    "zh": "你好！我是李明。我们聊聊天吧。你今天怎么样？",
    "ja": "こんにちは！ユキです。少し話しましょう。今日はどうですか。",
}
_SIMPLE_FOLLOWUPS = {
    "es": ["¿Y por qué?", "¡Qué interesante! ¿Me cuentas más?", "¿Y qué pasó después?"],
    "it": ["E perché?", "Interessante! Mi racconti di più?", "E poi cosa è successo?"],
    "zh": ["为什么？", "很有意思！再说说吧。", "然后呢？"],
    "ja": ["どうしてですか。", "おもしろいですね。もう少し教えてください。", "それから？"],
}


def _topics(level: str) -> list[str]:
    return CONVERSATION_TOPICS_EN.get(level) or CONVERSATION_TOPICS_EN["B1"]


def opening(language: str, mode: str, level: str, scenario: dict | None, state: dict) -> str:
    if scenario:
        state["script_index"] = 0
        return scenario["opening"]
    if mode == "quick_response":
        q = _next_quick(language, level, state)
        return ("Quick response! Answer as fast as you can. " if language == "en" else "") + q
    topic = _topics(level)[0]
    state["topic_index"] = 0
    return _GENERIC_OPENING.get(language, _GENERIC_OPENING["en"]).format(topic=topic)


def _next_quick(language: str, level: str, state: dict) -> str:
    pool = QUICK_RESPONSE_EN if language == "en" else QUICK_RESPONSE_OTHER.get(language, [])
    near = [q for q in pool if q["level"] == level] or pool
    i = state.get("qr_index", 0)
    state["qr_index"] = i + 1
    return near[i % len(near)]["q"] if near else "?"


def reply(*, language: str, mode: str, level: str, scenario: dict | None, state: dict, user_text: str,
          corrections: list[Correction]) -> dict:
    turn = state.get("user_turns", 0)
    bc = BACKCHANNELS_EN[turn % len(BACKCHANNELS_EN)] if language == "en" else ""
    recast = ""
    if mode == "immediate" and corrections and language == "en":
        recast = f"Oh, you mean: \"{correct_text(corrections[0].original)}\" "

    if mode == "no_native" and looks_portuguese(user_text):
        return {"reply": "Let's keep it in English! Try with simple words. You can start with: \"I think…\" or \"In my opinion…\".",
                "comprehension_issue": False}

    if scenario:
        i = state.get("script_index", 0)
        script = scenario["script"]
        lines = []
        if i == 3 and not state.get("event_done"):
            state["event_done"] = True
            lines.append("(Unexpected situation) " + scenario["unexpected_events"][state.get("event_index", 0) % len(scenario["unexpected_events"])])
        if i < len(script):
            lines.append(script[i])
            state["script_index"] = i + 1
        else:
            lines.append("Alright, I think that covers everything. Thanks a lot!")
            state["finished"] = True
        return {"reply": (recast + bc + " " + " ".join(lines)).strip(), "comprehension_issue": False}

    if mode == "quick_response":
        return {"reply": (recast + bc + " " + _next_quick(language, level, state)).strip(), "comprehension_issue": False}

    if language != "en":
        ups = _SIMPLE_FOLLOWUPS.get(language, ["?"])
        return {"reply": ups[turn % len(ups)], "comprehension_issue": False}

    # Aprofunda o tema (até 2 perguntas de continuação; respostas muito curtas pedem mais detalhe)
    # antes de trocar de assunto, como numa conversa real.
    words = count_words(user_text)
    on_topic = state.get("followups_on_topic", 0)
    if words < 4 and on_topic < 3:
        state["followups_on_topic"] = on_topic + 1
        nxt = ELABORATE_EN[turn % len(ELABORATE_EN)]
    elif on_topic < 2:
        state["followups_on_topic"] = on_topic + 1
        nxt = FOLLOW_UPS_EN[turn % len(FOLLOW_UPS_EN)]
    else:
        state["followups_on_topic"] = 0
        topics = _topics(level)
        state["topic_index"] = (state.get("topic_index", 0) + 1) % len(topics)
        transition = TOPIC_TRANSITIONS_EN[state["topic_index"] % len(TOPIC_TRANSITIONS_EN)]
        nxt = transition + " " + topics[state["topic_index"]]
    return {"reply": (recast + bc + " " + nxt).strip(), "comprehension_issue": False}


def _summary_pt(turns: int, wpt: float, n_corrections: int) -> str:
    turns_pt = "intervenção" if turns == 1 else "intervenções"
    if n_corrections == 0:
        found = "Nenhum ponto de atenção detectado"
    elif n_corrections == 1:
        found = "Foi detectado 1 ponto de atenção"
    else:
        found = f"Foram detectados {n_corrections} pontos de atenção"
    return f"Você fez {turns} {turns_pt} com média de {wpt:.1f} palavras. {found} por regras automáticas."


def report(*, language: str, scenario: dict | None, user_texts: list[str], corrections: list[dict], metrics: dict) -> dict:
    by_rule: Counter[str] = Counter(c.get("rule_id") or c["subtype"] for c in corrections)
    seen, main_errors = set(), []
    for c in corrections:
        key = c.get("rule_id") or c["subtype"]
        if key in seen:
            continue
        seen.add(key)
        main_errors.append({k: c[k] for k in ("original", "corrected", "explanation_pt", "category", "subtype", "severity")}
                           | {"count": by_rule[key]})
    main_errors.sort(key=lambda e: (-["minor", "may_confuse", "blocks_understanding"].index(e["severity"]), -e["count"]))

    corrected_sentences = []
    for orig in dict.fromkeys(c["original"] for c in corrections):
        corrected_sentences.append({"original": orig, "corrected": correct_text(orig) if language == "en" else orig})

    used = normalize(" ".join(user_texts))
    vocab = []
    if scenario:
        for phrase in scenario.get("useful_phrases", []):
            core = normalize(phrase.replace("…", ""))
            if core and core not in used:
                vocab.append({"term": phrase, "meaning_pt": "Expressão útil para este cenário", "example": phrase})

    recs = []
    wpt = metrics.get("avg_words_per_turn") or 0
    if wpt and wpt < 8:
        recs.append("Suas respostas foram curtas. Treine expandir com 'because…', 'for example…', 'so…' (Construção de frases).")
    lat = metrics.get("avg_response_latency_ms")
    if lat and lat > 6000:
        recs.append("Você demorou para começar a responder. Faça sessões de Quick Response para acelerar a recuperação de palavras.")
    if metrics.get("portuguese_turns"):
        recs.append("Você recorreu ao português algumas vezes. Experimente Think in English: explicar a ideia com palavras simples.")
    if main_errors:
        recs.append("Revise os erros abaixo: eles foram adicionados ao seu caderno de erros e à revisão espaçada.")
    if not recs:
        recs.append("Boa sessão! Na próxima, aumente a duração do Conversation Challenge.")

    exercises = [{"type": "rewrite", "instruction_pt": "Reescreva a frase corretamente.", "prompt": e["original"],
                  "answer": correct_text(e["original"]) if language == "en" else e["corrected"]} for e in main_errors[:3]]
    if language == "en":
        exercises.append({"type": "quick_answer", "instruction_pt": "Responda em até 5 segundos, em voz alta.",
                          "prompt": QUICK_RESPONSE_EN[len(user_texts) % len(QUICK_RESPONSE_EN)]["q"],
                          "answer": QUICK_RESPONSE_EN[len(user_texts) % len(QUICK_RESPONSE_EN)]["model"]})

    return {
        "summary_pt": _summary_pt(metrics.get("user_turns", 0), wpt, len(corrections)),
        "strengths_pt": (["Você manteve a conversa em inglês durante toda a sessão."] if not metrics.get("portuguese_turns") else [])
                        + (["Boa extensão das respostas."] if wpt >= 12 else []),
        "main_errors": main_errors[:6],
        "corrected_sentences": corrected_sentences[:8],
        "natural_expressions": [],
        "new_vocabulary": vocab[:6],
        "recommendations_pt": recs,
        "exercises": exercises,
        "topics": [scenario["title_pt"]] if scenario else [],
        "cefr_observation_pt": "Observação por nível CEFR disponível com IA generativa configurada.",
        "limitations_pt": "Relatório gerado em modo offline (regras automáticas): detecta apenas erros comuns de falantes de "
                          "português e não avalia naturalidade, coerência ou objetivos do cenário.",
    }
