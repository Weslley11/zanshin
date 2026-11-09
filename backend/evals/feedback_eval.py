"""Avaliação da qualidade do feedback corretivo (regras e/ou LLM configurado).

Mede, sobre um conjunto-ouro de frases de aprendizes brasileiros:
- recall: % dos erros esperados que foram apontados com uma correção que contém a forma correta;
- falsos positivos: % de frases corretas (incluindo fala informal transcrita) que receberam "correção";
- precisão por frase com erro.

Uso:
  uv run python -m evals.feedback_eval --engine rules
  LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=... uv run python -m evals.feedback_eval --engine llm   # custa tokens
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

DATA = Path(__file__).parent / "data" / "feedback_cases.jsonl"


def load_cases() -> list[dict]:
    return [json.loads(line) for line in DATA.read_text(encoding="utf-8").splitlines() if line.strip()]


def _norm(s: str) -> str:
    return " ".join(s.lower().replace("’", "'").split())


def score(cases: list[dict], predictions: dict[str, list[dict]]) -> dict:
    expected_total = hits = 0
    fp_sentences = 0
    correct_sentences = 0
    details = []
    for c in cases:
        preds = predictions.get(c["id"], [])
        fixed_texts = [_norm(p.get("corrected", "")) for p in preds]
        if not c["expect"]:
            correct_sentences += 1
            if preds:
                fp_sentences += 1
            details.append({"id": c["id"], "ok": not preds, "predicted": len(preds)})
            continue
        found = 0
        for e in c["expect"]:
            expected_total += 1
            if any(_norm(e["fix"]) in t for t in fixed_texts):
                hits += 1
                found += 1
        details.append({"id": c["id"], "expected": len(c["expect"]), "found": found, "predicted": len(preds)})
    return {
        "recall": round(hits / expected_total, 3) if expected_total else None,
        "false_positive_rate": round(fp_sentences / correct_sentences, 3) if correct_sentences else None,
        "expected_errors": expected_total,
        "correct_sentences": correct_sentences,
        "details": details,
    }


def run_rules(cases: list[dict]) -> dict[str, list[dict]]:
    from app.services.error_analyzer import analyze_english, correct_text

    out = {}
    for c in cases:
        corr = analyze_english(c["text"])
        # a correção cumulativa da frase representa o que o usuário vê em "frases corrigidas"
        out[c["id"]] = [{"corrected": correct_text(c["text"])}] if corr else []
    return out


async def run_llm(cases: list[dict]) -> tuple[dict[str, list[dict]], dict]:
    from app.ai.base import ChatMessage
    from app.ai.registry import build_providers
    from app.config import get_settings
    from app.services.tutor_prompts import TURN_SCHEMA, build_system_prompt

    providers = build_providers(get_settings())
    if not providers.llm.is_generative:
        raise SystemExit("Configure LLM_PROVIDER e a chave do provedor para avaliar o modo LLM.")
    system = build_system_prompt(language="en", mode="immediate", level="B1", profile={}, memory={}, scenario=None, settings={})
    out, tokens = {}, {"input": 0, "output": 0}
    for c in cases:
        res = await providers.llm.generate_json(
            system=system, schema=TURN_SCHEMA, purpose="chat", max_tokens=4096,
            messages=[ChatMessage("user", "[The session has started.]"), ChatMessage("assistant", "Hi! Tell me about your week."),
                      ChatMessage("user", c["text"])])
        out[c["id"]] = res.data.get("corrections", [])
        tokens["input"] += res.usage.input_tokens
        tokens["output"] += res.usage.output_tokens
    return out, tokens


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", choices=["rules", "llm"], default="rules")
    ap.add_argument("--only-rule-covered", action="store_true", help="limita aos casos cobertos pelas regras")
    args = ap.parse_args()
    cases = load_cases()
    if args.only_rule_covered:
        cases = [c for c in cases if c.get("rule_covered", True)]
    tokens = None
    if args.engine == "rules":
        preds = run_rules(cases)
    else:
        preds, tokens = asyncio.run(run_llm(cases))
    report = score(cases, preds) | {"engine": args.engine, "tokens": tokens}
    print(json.dumps({k: v for k, v in report.items() if k != "details"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
