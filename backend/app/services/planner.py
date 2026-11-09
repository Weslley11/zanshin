"""Gerador do Programa Intensivo (padrão: 90 dias) com fases, metas mensuráveis e prática intercalada.

Algoritmo de alocação: 'créditos ponderados'. A cada dia, cada tipo de atividade acumula
crédito proporcional ao seu peso (fase × ajustes adaptativos); o dia é preenchido pelos
tipos com mais crédito. Assim, no longo prazo a proporção respeita os pesos, mas os dias
variam (interleaving) mesmo com pouco tempo disponível.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

from app.content.en_listening import LISTENING_EN
from app.content.languages import CEFR_LEVELS
from app.content.scenarios import SCENARIOS

ACTIVITY_INFO: dict[str, dict] = {
    "vocab_review": {"title_pt": "Revisão espaçada de vocabulário", "min": 5, "max": 12, "skills": ["vocabulary"], "mode": "input"},
    "listening": {"title_pt": "Listening com sotaques", "min": 6, "max": 15, "skills": ["listening"], "mode": "input"},
    "shadowing": {"title_pt": "Shadowing (imitação da fala)", "min": 5, "max": 10, "skills": ["pronunciation", "fluency"], "mode": "input"},
    "quick_response": {"title_pt": "Quick Response — responder rápido", "min": 5, "max": 8, "skills": ["fluency", "speaking"], "mode": "output"},
    "sentence_building": {"title_pt": "Construção de frases", "min": 5, "max": 8, "skills": ["grammar", "speaking"], "mode": "output"},
    "think_in_english": {"title_pt": "Think in English", "min": 5, "max": 6, "skills": ["fluency", "speaking"], "mode": "output"},
    "conversation": {"title_pt": "Conversation Challenge com o tutor", "min": 3, "max": 30, "skills": ["speaking", "interaction"], "mode": "output"},
    "scenario": {"title_pt": "Simulação (viagem/trabalho)", "min": 8, "max": 15, "skills": ["interaction", "speaking", "listening"], "mode": "output"},
    "error_review": {"title_pt": "Revisão dos seus erros", "min": 5, "max": 6, "skills": ["grammar"], "mode": "output"},
    "assessment": {"title_pt": "Avaliação de progresso", "min": 20, "max": 25, "skills": ["listening", "speaking", "vocabulary", "grammar"], "mode": "eval"},
}

PHASE_WEIGHTS: dict[int, dict[str, float]] = {
    1: {"vocab_review": 0.15, "listening": 0.24, "shadowing": 0.10, "quick_response": 0.12, "sentence_building": 0.12,
        "think_in_english": 0.06, "conversation": 0.11, "scenario": 0.07, "error_review": 0.03},
    2: {"vocab_review": 0.11, "listening": 0.19, "shadowing": 0.07, "quick_response": 0.08, "sentence_building": 0.05,
        "think_in_english": 0.05, "conversation": 0.17, "scenario": 0.22, "error_review": 0.06},
    3: {"vocab_review": 0.08, "listening": 0.14, "shadowing": 0.05, "quick_response": 0.06, "sentence_building": 0.02,
        "think_in_english": 0.05, "conversation": 0.26, "scenario": 0.29, "error_review": 0.05},
}

PHASES: dict[int, dict] = {
    1: {"title_pt": "Construção de Base Comunicativa",
        "objectives_pt": ["Consolidar estruturas essenciais", "Ampliar vocabulário funcional", "Melhorar a compreensão auditiva",
                          "Desenvolver respostas espontâneas", "Praticar conversas curtas diariamente"],
        "measurable_goals_pt": ["Responder perguntas simples em até 4 s em 80% das tentativas (Quick Response)",
                                "Manter 5 minutos de conversa sem recorrer ao português",
                                "≥ 70% de acerto em listening B1 em velocidade normal",
                                "≥ 120 expressões em revisão com retenção ≥ 85%"]},
    2: {"title_pt": "Comunicação Profissional",
        "objectives_pt": ["Participar de reuniões simuladas", "Explicar processos e atividades", "Descrever problemas técnicos",
                          "Fazer perguntas e esclarecer dúvidas", "Desenvolver conversas mais longas", "Trabalhar diferentes sotaques"],
        "measurable_goals_pt": ["Explicar um problema técnico em 2 min com a estrutura sintoma → hipótese → impacto → próximo passo",
                                "Concluir uma reunião simulada de 15 min atingindo os objetivos do cenário",
                                "≥ 65% de acerto em listening com 3 sotaques (EUA, Reino Unido, Índia/Austrália)",
                                "Reduzir em 30% a recorrência dos 3 erros mais frequentes"]},
    3: {"title_pt": "Imersão e Simulações Reais",
        "objectives_pt": ["Realizar reuniões completas em inglês", "Apresentar projetos", "Participar de discussões técnicas",
                          "Resolver situações inesperadas", "Conversar sem roteiros", "Desenvolver autonomia comunicativa"],
        "measurable_goals_pt": ["Apresentar um projeto em 5 min e responder a perguntas por mais 5",
                                "Sustentar 30 minutos de conversa sem roteiro",
                                "Resolver 5 situações inesperadas de viagem/trabalho nas simulações",
                                "Tempo médio de resposta em conversa abaixo de 3 s"]},
}

WEEK_THEMES_PT = [
    "Apresentações pessoais e rotina de trabalho",
    "Viagem: aeroporto, imigração e hotel",
    "Restaurante, transporte e small talk",
    "Descrever seu trabalho, equipe e projetos",
    "Reuniões e status updates",
    "Explicar problemas técnicos",
    "Negociar prazos e falar com fornecedores",
    "Networking e sotaques variados",
    "Apresentações de projetos",
    "Treinamentos e discussões técnicas",
    "Situações inesperadas",
    "Conversas sem roteiro",
    "Ensaio geral da viagem",
]


@dataclass
class DayPlan:
    day_index: int
    date: date
    phase: int
    focus: str
    activities: list[dict] = field(default_factory=list)
    is_assessment_day: bool = False


def phase_for(day: int, total: int) -> int:
    if day <= round(total / 3):
        return 1
    if day <= round(2 * total / 3):
        return 2
    return 3


def assessment_days(total: int) -> set[int]:
    days = {1} | set(range(15, total + 1, 15))
    days.add(total)
    return days


def _conversation_target(day: int, total: int) -> int:
    """Conversation Challenge progressivo: 3 → 5 → 10 → 15 → 30 minutos."""
    frac = day / total
    if frac <= 0.11:
        return 3
    if frac <= 0.33:
        return 5
    if frac <= 0.5:
        return 10
    if frac <= 0.8:
        return 15
    return 30


def _round5(x: float) -> int:
    return max(0, int(5 * round(x / 5)))


def _level_ok(level: str, learner: str) -> bool:
    return CEFR_LEVELS.index(level) <= min(CEFR_LEVELS.index(learner) + 1, len(CEFR_LEVELS) - 1)


def _pick_rotating(pool: list[dict], counter: dict, key: str) -> dict | None:
    if not pool:
        return None
    i = counter.get(key, 0)
    counter[key] = i + 1
    return pool[i % len(pool)]


def generate(
    *,
    start: date,
    total_days: int,
    daily_minutes: int,
    learner_level: str = "B1",
    multipliers: dict[str, float] | None = None,
    focus_domains: list[str] | None = None,
    placement_done: bool = False,
) -> list[DayPlan]:
    multipliers = multipliers or {}
    focus_domains = focus_domains or []
    learner_level = learner_level if learner_level in CEFR_LEVELS else "B1"
    credits = dict.fromkeys(ACTIVITY_INFO, 0.0)
    rotation: dict[str, int] = {}
    a_days = assessment_days(total_days)
    out: list[DayPlan] = []

    for day in range(1, total_days + 1):
        phase = phase_for(day, total_days)
        raw = {t: w * multipliers.get(t, 1.0) for t, w in PHASE_WEIGHTS[phase].items()}
        tot = sum(raw.values())
        weights = {t: w / tot for t, w in raw.items()}

        week = min((day - 1) * 13 // total_days, 12)
        is_weekly_review = day % 7 == 0
        dp = DayPlan(day_index=day, date=start + timedelta(days=day - 1), phase=phase,
                     focus=WEEK_THEMES_PT[week] + (" · revisão semanal" if is_weekly_review else ""))
        minutes_left = daily_minutes
        chosen: list[tuple[str, int]] = []

        if day in a_days and not (day == 1 and placement_done):
            block = min(ACTIVITY_INFO["assessment"]["min"], minutes_left)
            chosen.append(("assessment", block))
            minutes_left -= block
            dp.is_assessment_day = True

        for t, w in weights.items():
            credits[t] += w * minutes_left
        if is_weekly_review:
            credits["error_review"] += 5
            credits["conversation"] += 5

        # Revisão espaçada diária (5 min): o FSRS depende de revisões no dia em que vencem.
        if minutes_left >= 15:
            chosen.append(("vocab_review", 5))
            credits["vocab_review"] -= 5
            minutes_left -= 5

        used: set[str] = {t for t, _ in chosen}
        while minutes_left >= 3:
            candidates = [t for t in weights if t not in used and credits[t] > 0]
            if not candidates:
                break
            t = max(candidates, key=lambda k: credits[k])
            info = ACTIVITY_INFO[t]
            if t == "conversation":
                block = min(_conversation_target(day, total_days), info["max"], minutes_left)
            else:
                block = min(max(info["min"], _round5(credits[t])), info["max"], minutes_left)
            if block < info["min"] and t != "conversation":
                used.add(t)
                continue
            credits[t] -= block
            chosen.append((t, block))
            used.add(t)
            minutes_left -= block
        if minutes_left > 0 and chosen:  # sobra vai para atividades de produção oral, respeitando o máximo
            for i in sorted(range(len(chosen)), key=lambda i: ACTIVITY_INFO[chosen[i][0]]["mode"] != "output"):
                t, mins = chosen[i]
                # o Conversation Challenge mantém a duração da escada (3→5→10→15→30 min)
                room = 0 if t in ("conversation", "assessment") else ACTIVITY_INFO[t]["max"] - mins
                if room > 0 and minutes_left > 0:
                    add = min(room, minutes_left)
                    chosen[i] = (t, mins + add)
                    minutes_left -= add
            if minutes_left > 0:  # tudo no máximo: estende o maior bloco
                idx = max(range(len(chosen)), key=lambda i: chosen[i][1])
                chosen[idx] = (chosen[idx][0], chosen[idx][1] + minutes_left)

        # Ordem intercalada: aquecimento (revisão) → alterna input/output → fecha com produção ou erros
        order = {"assessment": 0, "vocab_review": 1}
        inputs = [c for c in chosen if ACTIVITY_INFO[c[0]]["mode"] == "input" and c[0] not in order]
        outputs = [c for c in chosen if ACTIVITY_INFO[c[0]]["mode"] == "output" and c[0] != "error_review"]
        head = sorted([c for c in chosen if c[0] in order], key=lambda c: order[c[0]])
        tail = [c for c in chosen if c[0] == "error_review"]
        mixed: list[tuple[str, int]] = []
        while inputs or outputs:
            if inputs:
                mixed.append(inputs.pop(0))
            if outputs:
                mixed.append(outputs.pop(0))
        sequence = head + mixed + tail

        for i, (t, minutes) in enumerate(sequence):
            info = ACTIVITY_INFO[t]
            params: dict = {}
            title = info["title_pt"]
            if t == "conversation":
                params["challenge_minutes"] = minutes
                params["mode"] = "no_native" if phase >= 2 and day % 2 == 0 else "natural"
                title = f"Conversation Challenge — {minutes} min" + (" (No Portuguese)" if params["mode"] == "no_native" else "")
            elif t == "scenario":
                pool = [s for s in SCENARIOS if s["phase"] <= phase and _level_ok(s["level"], learner_level)]
                pool.sort(key=lambda s: (s["phase"] != phase, s["domain"] not in focus_domains and s["category"] != "work", s["id"]))
                sc = _pick_rotating(pool, rotation, f"scenario{phase}")
                if sc:
                    params["scenario_id"] = sc["id"]
                    title = f"Simulação: {sc['title_pt']}"
            elif t == "listening":
                pool = [x for x in LISTENING_EN if x["phase"] <= phase and _level_ok(x["level"], learner_level)]
                pool.sort(key=lambda x: (x["phase"] != phase, x["id"]))
                ls = _pick_rotating(pool, rotation, f"listening{phase}")
                if ls:
                    params["listening_id"] = ls["id"]
                    title = f"Listening: {ls['title']}"
            elif t == "assessment":
                params["kind"] = "placement" if (day == 1 and not placement_done) else "checkpoint"
                title = "Avaliação inicial" if params["kind"] == "placement" else f"Avaliação de progresso (dia {day})"
            dp.activities.append({"id": f"d{day}-a{i}", "type": t, "title_pt": title, "minutes": minutes,
                                  "skills": info["skills"], "params": params, "done": False})
        out.append(dp)
    return out


def expected_outcomes(total_days: int, daily_minutes: int, level: str | None) -> dict:
    hours = total_days * daily_minutes / 60
    fraction = hours / 200
    if fraction < 0.25:
        progress = "um avanço perceptível dentro do nível atual"
    elif fraction < 0.6:
        progress = "cerca de um terço a metade de um nível CEFR"
    else:
        progress = "algo próximo de meio a um nível CEFR"
    return {
        "total_hours": round(hours, 1),
        "general_progress_pt": f"Com ~{hours:.0f} h de prática, a expectativa realista é {progress} em proficiência geral.",
        "task_readiness_pt": "Nas tarefas treinadas (reuniões, explicações técnicas, situações de viagem) o ganho tende a ser "
                             "maior, porque a prática é específica e repetida.",
        "basis_pt": "Referência: ~180–200 horas de aprendizagem guiada por nível CEFR (estimativa da Cambridge English); "
                    "a variação individual é grande.",
        "no_guarantee_pt": "Não há garantia de fluência. O progresso é medido a cada 15 dias e o plano se ajusta.",
        "current_level": level,
    }


def plan_length(start: date, trip_date: date | None, default: int = 90) -> int:
    if trip_date is None:
        return default
    return max(14, min(120, (trip_date - start).days))
