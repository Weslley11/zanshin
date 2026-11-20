"""Medidor de fala: 1 minuto falando sobre um tema, uma vez por semana, para acompanhar a evolução com números.

Medidas (calculadas sobre o texto reconhecido): palavras, palavras por minuto, variedade de vocabulário,
hesitações transcritas ("um", "uh") e palavras em português. São estimativas: o reconhecimento de voz erra e
costuma apagar hesitações. O que importa é a tendência ao longo das semanas, não um número isolado.
"""

from __future__ import annotations

PROMPTS: list[dict] = [
    {"id": "sc01", "en": "Introduce yourself and explain what you do at work.", "pt": "Apresente-se e explique o que você faz no trabalho.",
     "tip_pt": "Nome → empresa → função → um projeto atual."},
    {"id": "sc02", "en": "Describe a typical workday, from morning to evening.", "pt": "Descreva um dia típico de trabalho, da manhã à noite.",
     "tip_pt": "Use first, then, after that, finally."},
    {"id": "sc03", "en": "Explain a problem you solved at work: what happened, why, and what you did.",
     "pt": "Explique um problema que você resolveu: o que houve, por quê e o que você fez.", "tip_pt": "Sintoma → causa → ação → resultado."},
    {"id": "sc04", "en": "Tell me about your plans for your work trip.", "pt": "Conte seus planos para a viagem de trabalho.",
     "tip_pt": "Onde, quando, com quem você vai se reunir e o que precisa resolver."},
    {"id": "sc05", "en": "Explain how a machine or process you work with works.", "pt": "Explique como funciona uma máquina ou processo do seu trabalho.",
     "tip_pt": "Comece pelo objetivo, depois as etapas em ordem."},
    {"id": "sc06", "en": "Describe your city to someone who has never been there.", "pt": "Descreva sua cidade para alguém que nunca foi lá.",
     "tip_pt": "Tamanho, clima, comida, o que visitar."},
    {"id": "sc07", "en": "Describe a project you are proud of.", "pt": "Descreva um projeto do qual você se orgulha.",
     "tip_pt": "O desafio, o seu papel e o resultado (com um número, se puder)."},
    {"id": "sc08", "en": "Give your opinion: is it better to work from home or at the office? Why?",
     "pt": "Dê sua opinião: é melhor trabalhar em casa ou no escritório? Por quê?", "tip_pt": "Opinião → 2 motivos → exemplo → conclusão."},
    {"id": "sc09", "en": "Explain, step by step, how to do something you know well.", "pt": "Explique, passo a passo, como fazer algo que você sabe bem.",
     "tip_pt": "First… next… make sure you… finally…"},
    {"id": "sc10", "en": "Tell a story about a mistake you made and what you learned.", "pt": "Conte um erro que você cometeu e o que aprendeu.",
     "tip_pt": "Use o passado: I was…, I decided…, I learned…"},
    {"id": "sc11", "en": "Convince a colleague to try your idea to improve a process.", "pt": "Convença um colega a testar sua ideia para melhorar um processo.",
     "tip_pt": "Problema atual → sua ideia → benefício → próximo passo."},
    {"id": "sc12", "en": "Describe your last trip: where you went, what you did and what you liked.",
     "pt": "Descreva sua última viagem: aonde foi, o que fez e do que gostou.", "tip_pt": "Narre em ordem e termine com uma opinião."},
]

SECONDS = 60
FILLERS = {"um", "uh", "uhm", "er", "erm", "hmm", "ah", "eh"}
PT_WORDS = {"não", "nao", "que", "você", "voce", "eu", "é", "uma", "isso", "então", "entao", "tipo", "né", "porque", "também",
            "tambem", "muito", "está", "estou", "com", "para", "pra", "mas", "como", "aqui", "tá", "ta", "ele", "ela"}
REAL_PARTNERS = {"india": "Indianos", "us": "Americanos", "other": "Outros"}


def prompt_for(index: int) -> dict:
    return PROMPTS[index % len(PROMPTS)]
