"""Registro de idiomas com particularidades pedagógicas próprias (não é o mesmo curso traduzido)."""

from __future__ import annotations

LANGUAGES: dict[str, dict] = {
    "en": {
        "code": "en",
        "name": "English",
        "name_pt": "Inglês",
        "native_name": "English",
        "status": "mvp",
        "stt_locale": "en-US",
        "tts_voices": {
            "US": {"locale": "en-US", "azure": "en-US-AvaMultilingualNeural", "openai": "alloy"},
            "UK": {"locale": "en-GB", "azure": "en-GB-RyanNeural", "openai": "fable"},
            "AU": {"locale": "en-AU", "azure": "en-AU-NatashaNeural", "openai": "nova"},
            "IN": {"locale": "en-IN", "azure": "en-IN-NeerjaNeural", "openai": "shimmer"},
        },
        "focus_areas": [
            "Compreensão auditiva com connected speech (linking, weak forms, reductions)",
            "Resposta rápida sem tradução mental",
            "Phrasal verbs e collocations de uso profissional",
            "Comunicação profissional: reuniões, explicações técnicas, negociação de prazos",
            "Pronúncia orientada à inteligibilidade (sotaque não é penalizado)",
        ],
        "modules": [
            {"id": "speak_unlock", "title": "Destravar a Fala", "description": "Respostas rápidas, Think in English, construção de frases"},
            {"id": "listening_accents", "title": "Listening com sotaques", "description": "EUA, Reino Unido, Austrália e Índia em velocidades graduais"},
            {"id": "connected_speech", "title": "Connected speech & shadowing", "description": "Linking, reduções (gonna, wanna, didja) e entonação"},
            {"id": "engineering_english", "title": "Inglês para Engenharia", "description": "BOM, desenhos técnicos, SAP, SolidWorks, troubleshooting"},
            {"id": "travel_simulator", "title": "Simulador de Viagem", "description": "Aeroporto, hotel, restaurante, transporte, networking"},
        ],
        "tutor_notes": (
            "Prioritize intelligibility over native-like accent. Watch for Brazilian Portuguese interference: "
            "false friends (actually, pretend, assist, realize, push), missing subjects ('Is possible'), "
            "for/since, present perfect, third-person -s, uncountable nouns. Model natural connected speech."
        ),
    },
    "es": {
        "code": "es",
        "name": "Spanish",
        "name_pt": "Espanhol",
        "native_name": "Español",
        "status": "expansion",
        "stt_locale": "es-ES",
        "tts_voices": {
            "ES": {"locale": "es-ES", "azure": "es-ES-ElviraNeural", "openai": "nova"},
            "MX": {"locale": "es-MX", "azure": "es-MX-DaliaNeural", "openai": "alloy"},
            "AR": {"locale": "es-AR", "azure": "es-AR-ElenaNeural", "openai": "shimmer"},
        },
        "focus_areas": [
            "Evitar o 'portunhol': falsos cognatos e calques do português",
            "Comunicação espontânea desde o início (a proximidade com o PT acelera a compreensão)",
            "Pronúncia: j/g (jota), rr múltiplo, ll/y, s final, vogais sem nasalização",
            "Variações regionais: vosotros (Espanha) × ustedes (América), voseo rioplatense",
            "Diferenças gramaticais: gustar, ser/estar, artigos neutros (lo), heterogenéricos (el puente, la leche)",
        ],
        "modules": [
            {"id": "false_friends", "title": "Falsos amigos PT-ES", "description": "Exquisito, embarazada, oficina, polvo, borracha…"},
            {"id": "regional", "title": "Variações regionais", "description": "Espanha, México e Argentina"},
            {"id": "pronunciation_es", "title": "Pronúncia sem portunhol", "description": "Jota, erre, vogais orais"},
            {"id": "spontaneous", "title": "Conversação espontânea", "description": "Situações cotidianas e de trabalho"},
        ],
        "tutor_notes": (
            "Learner is a Brazilian Portuguese speaker: comprehension is usually high but production drifts into "
            "'portuñol'. Flag false friends and Portuguese calques. Ask which variety the learner prefers "
            "(Spain/Mexico/Argentina) and stay consistent."
        ),
    },
    "it": {
        "code": "it",
        "name": "Italian",
        "name_pt": "Italiano",
        "native_name": "Italiano",
        "status": "expansion",
        "stt_locale": "it-IT",
        "tts_voices": {"IT": {"locale": "it-IT", "azure": "it-IT-ElsaNeural", "openai": "nova"}},
        "focus_areas": [
            "Consoantes duplas (geminadas): nono × nonno, pala × palla, caro × carro",
            "Conjugações verbais e passato prossimo com essere/avere",
            "Formalidade: tu × Lei (terceira pessoa de cortesia)",
            "Preposições articuladas (del, nella, sul…)",
            "Situações cotidianas: bar, mercado, trem, trabalho",
        ],
        "modules": [
            {"id": "double_consonants", "title": "Consoantes duplas", "description": "Pares mínimos e shadowing"},
            {"id": "verbs_it", "title": "Estruturas verbais", "description": "Presente, passato prossimo, condizionale de cortesia"},
            {"id": "formality_it", "title": "Tu ou Lei?", "description": "Registro formal e informal"},
            {"id": "daily_it", "title": "Situações do dia a dia", "description": "Bar, ristorante, stazione, ufficio"},
        ],
        "tutor_notes": (
            "Use Lei with strangers in role-plays unless the learner chooses tu. Watch for Portuguese interference "
            "in prepositions and auxiliary choice (essere/avere). Model geminate consonants clearly."
        ),
    },
    "zh": {
        "code": "zh",
        "name": "Mandarin Chinese",
        "name_pt": "Mandarim",
        "native_name": "中文",
        "status": "expansion",
        "stt_locale": "zh-CN",
        "tts_voices": {"CN": {"locale": "zh-CN", "azure": "zh-CN-XiaoxiaoNeural", "openai": "nova"}},
        "focus_areas": [
            "Tons: discriminação auditiva e produção (pares de tons, sandhi do 3º tom, 不 e 一)",
            "Pinyin como ponte para a pronúncia (zh/ch/sh × z/c/s × j/q/x)",
            "Compreensão oral antes da escrita; caracteres introduzidos por radicais e frequência (HSK)",
            "Classificadores (个, 张, 本, 杯…) e ordem tópico-comentário",
            "Comunicação prática: apresentações, compras, transporte, trabalho",
        ],
        "modules": [
            {"id": "tones", "title": "Tons e pares de tons", "description": "Treino auditivo e de produção"},
            {"id": "pinyin", "title": "Pinyin", "description": "Iniciais e finais difíceis para lusófonos"},
            {"id": "characters", "title": "Caracteres essenciais", "description": "Radicais e HSK 1-2 com repetição espaçada"},
            {"id": "practical_zh", "title": "Mandarim prático", "description": "Situações de viagem e trabalho"},
        ],
        "tutor_notes": (
            "Always give new words as: characters (pinyin with tone marks) — meaning. Keep sentences short at "
            "beginner levels. Correct tones gently and only when they change meaning. Prefer simplified characters."
        ),
    },
    "ja": {
        "code": "ja",
        "name": "Japanese",
        "name_pt": "Japonês",
        "native_name": "日本語",
        "status": "expansion",
        "stt_locale": "ja-JP",
        "tts_voices": {"JP": {"locale": "ja-JP", "azure": "ja-JP-NanamiNeural", "openai": "nova"}},
        "focus_areas": [
            "Hiragana e katakana antes de tudo; kanji gradual por frequência (JLPT N5→N4)",
            "Partículas (は, が, を, に, で, へ, と) e ordem SOV",
            "Níveis de formalidade: forma simples × です/ます × keigo básico no trabalho",
            "Vogais curtas × longas e consoantes geminadas (おばさん × おばあさん, きて × きって)",
            "Conversação com frases prontas de alta utilidade (aisatsu)",
        ],
        "modules": [
            {"id": "kana", "title": "Hiragana & Katakana", "description": "Leitura com repetição espaçada"},
            {"id": "particles", "title": "Partículas", "description": "Uso em contexto, não em tabelas"},
            {"id": "politeness", "title": "Formalidade", "description": "です/ます, keigo no ambiente de trabalho"},
            {"id": "kanji", "title": "Kanji essenciais", "description": "N5 com radicais e palavras compostas"},
        ],
        "tutor_notes": (
            "Default to polite (です/ます) form. For beginners, provide kana with romaji in parentheses; reduce "
            "romaji as level increases. Explain particle errors briefly with a minimal pair."
        ),
    },
}

CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
CEFR_SCORE_ANCHORS = {"A1": 10, "A2": 25, "B1": 45, "B2": 65, "C1": 82, "C2": 95}

CEFR_DESCRIPTORS_PT = {
    "A1": "Compreende e usa expressões familiares e cotidianas muito básicas.",
    "A2": "Comunica-se em tarefas simples e rotineiras sobre assuntos familiares.",
    "B1": "Lida com a maioria das situações de viagem; produz texto simples e conectado sobre temas familiares.",
    "B2": "Interage com fluência e espontaneidade suficientes para conversar com falantes proficientes sem grande esforço de ambos.",
    "C1": "Usa a língua de forma flexível e eficaz para fins sociais, acadêmicos e profissionais.",
    "C2": "Compreende praticamente tudo o que ouve ou lê; expressa-se com precisão e nuances.",
}

SKILLS = ["listening", "speaking", "vocabulary", "grammar", "reading", "pronunciation", "fluency", "interaction"]

SKILL_LABELS_PT = {
    "listening": "Compreensão auditiva",
    "speaking": "Produção oral",
    "vocabulary": "Vocabulário",
    "grammar": "Gramática em contexto",
    "reading": "Leitura",
    "pronunciation": "Pronúncia",
    "fluency": "Fluência",
    "interaction": "Interação",
}


def score_to_cefr(score: float) -> str:
    level = "A1"
    for lvl in CEFR_LEVELS:
        if score >= CEFR_SCORE_ANCHORS[lvl] - 7:
            level = lvl
    return level


def public_language(code: str) -> dict:
    lang = LANGUAGES[code]
    return {k: v for k, v in lang.items() if k != "tutor_notes"}
