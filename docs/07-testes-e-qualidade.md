# 7. Testes e qualidade

## 7.1 Backend (`cd backend`)
```bash
uv run ruff check app tests evals
uv run pytest -q                                   # 111 testes (SQLite)
TEST_DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/fluent_test \
  uv run pytest -q tests/test_api.py tests/test_india.py   # mesma suíte de API contra PostgreSQL
```

| Suíte | Cobre |
|---|---|
| `test_fsrs.py` | Fórmulas, estados, ordem dos intervalos, lapsos e **equivalência passo a passo com a implementação de referência py-fsrs** (200 sequências aleatórias) |
| `test_error_analyzer.py` | 27 erros típicos de brasileiros (detecção + correção) e 14 frases corretas (sem falso positivo); linha de base do harness |
| `test_units.py` | Normalização/WER/alinhamento, plano (minutos, fases, avaliações, escada do Challenge, multiplicadores), motor adaptativo, CEFR, fluência, shadowing inconclusivo, drills, redação/bloqueio/injection em documentos |
| `test_providers.py` | Contrato com o SDK da Anthropic (formato da requisição, structured output, fallbacks, effort, cache), mapeamento de erros/recusas, provedor compatível com OpenAI, registro de capacidades |
| `test_api.py` | Jornada completa: cadastro, rotação/reuso de refresh token, isolamento entre usuários, avaliação, plano, FSRS, listening, drills, shadowing, tutor offline e com IA (relatório, memória, cenários, degradação), consentimentos, orçamento, voz, documentos, exportação e exclusão |
| `test_india.py` | Conteúdo da Índia, priorização no plano, prompt do tutor com inglês indiano, perfil com destino, rotas e repriorização |

Migrações: `alembic upgrade head` + `alembic check` (sem divergência entre modelos e migrações) — executados no CI.

## 7.2 Avaliação da qualidade do feedback da IA
`evals/feedback_eval.py` mede, num conjunto-ouro de 30 frases (20 com erros, 10 corretas incluindo fala informal transcrita):
- **recall** de erros (correção contém a forma esperada) e **taxa de falso positivo** em frases corretas.
- Regras (linha de base, sem custo): recall 100% nos casos cobertos pelas regras, 76% no total; falso positivo 0%.
- LLM: `LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=… uv run python -m evals.feedback_eval --engine llm` (consome tokens).

`evals/stt_eval.py` calcula o WER do reconhecimento de voz a partir de pares áudio/transcrição em `evals/data/stt/`
(recomendado: gravações de brasileiros, em ambiente silencioso e ruidoso, em celulares diferentes).

## 7.3 App (`cd mobile`)
```bash
npx tsc --noEmit                 # tipos
npm test                         # testes de lógica (node:test): roteamento de atividades, números em lakh/crore
npx expo export --platform web   # build de produção
```
Verificação ponta a ponta realizada no build web com Playwright (cadastro → onboarding com destino Índia → plano → conversa
→ relatório → revisão → avaliação → drills → listening → simulações → guia da Índia), sem erros de console/HTTP e sem
overflow horizontal em 360–390 px. Recomenda-se transformar esses roteiros em testes E2E no CI (Playwright ou Maestro).

## 7.4 O que ainda não foi validado nesta entrega
- Chamadas reais aos provedores pagos (sem credenciais no ambiente de desenvolvimento): cobertas por testes de contrato,
  mas devem ser validadas com chaves reais e o harness de avaliação.
- Gravação nativa em iOS/Android (verificada por tipos e build; requer teste em aparelho com development build).
- Qualidade das vozes en-IN disponíveis em cada aparelho.
