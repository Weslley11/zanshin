# 5. Provedores, credenciais e custos

Nada é apresentado como operacional sem estar configurado: o app consulta `GET /api/v1/system/capabilities`.

## 5.1 O que funciona sem nenhuma credencial (custo zero)
- Cadastro, perfil, plano de 90 dias, motor adaptativo, dashboard, privacidade.
- Revisão espaçada (FSRS), listening (voz do dispositivo), drills, avaliação objetiva (listening/vocabulário/gramática/leitura).
- Tutor **offline**: roteiros de cenário, perguntas por nível, correção de erros comuns de brasileiros por regras e relatório com métricas reais (identificado na interface como "Modo offline").
- Voz → texto pelo **reconhecimento do navegador** (Chrome/Edge) e texto → voz pela **voz do aparelho** (inclusive en-IN, se instalada).
- Shadowing com feedback por transcrição (quando há reconhecimento de voz no dispositivo/navegador).
- Guia "Inglês da Índia" e treino de lakh/crore.

## 5.2 O que exige serviço pago

| Recurso | Variáveis | Observações |
|---|---|---|
| Tutor com IA generativa (conversa aberta, relatório completo, objetivos de cenário, rubrica de fala, material de documentos) | `LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` (modelo padrão `claude-opus-5-5`) **ou** `LLM_PROVIDER=openai_compatible` + `OPENAI_API_KEY`/`OPENAI_BASE_URL`/`OPENAI_MODEL` | Com Claude, o servidor usa fallback automático em caso de recusa (`ANTHROPIC_ENABLE_FALLBACKS`). |
| Voz → texto no servidor (iOS/Android nativos, métricas de fluência por palavra) | `STT_PROVIDER=openai_compatible` (Whisper) **ou** `STT_PROVIDER=azure` + `AZURE_SPEECH_KEY/REGION` | Azure exige `ffmpeg` no servidor (incluso no Dockerfile). |
| Vozes neurais com sotaques consistentes | `TTS_PROVIDER=azure` (vozes en-US/en-GB/en-AU/**en-IN**) ou `openai_compatible` | **Para sotaque indiano autêntico use Azure (en-IN)**; as vozes OpenAI não reproduzem sotaques regionais. |
| Notas de pronúncia por fonema | `PRONUNCIATION_PROVIDER=azure` | Avaliação de pronúncia do Azure Speech. |

## 5.3 Estimativa de custo (validar com uso real)

Hipóteses: sessão de conversa de 10 min com ~15 turnos; prompt de sistema ~1,5 mil tokens; histórico médio ~2 mil tokens;
~450 tokens de saída por turno (JSON + raciocínio em esforço baixo); relatório final ~6 mil tokens de entrada e ~2 mil de saída.
Preços de referência da tabela vigente da Anthropic (Opus 5.5: US$ 4 / US$ 20 por milhão de tokens de entrada/saída;
leitura de cache a 10% do preço de entrada).

| Item | Estimativa |
|---|---|
| Sessão de 10 min com `claude-opus-5-5`, sem cache | ≈ US$ 0,40 |
| Mesma sessão com cache de prompt efetivo | ≈ US$ 0,25 |
| Usuário ativo, 2 sessões/dia, 90 dias | ≈ US$ 45–75 |
| STT Whisper (~20 min de fala do usuário/dia) | ≈ US$ 0,12/dia |
| TTS neural (~5 mil caracteres/dia) | ≈ US$ 0,08/dia (voz do aparelho: grátis) |

O custo real fica registrado em `usage_ledger`. Modelos menores (ex.: `claude-sonnet-5-5` ou `claude-haiku-5-5`) reduzem o custo
de forma significativa e podem ser configurados em `ANTHROPIC_MODEL` — decisão de produto a validar com o harness de avaliação
(`evals/feedback_eval.py --engine llm`) antes de trocar.

## 5.4 Camada de abstração
`backend/app/ai/base.py` define `LLMProvider`, `STTProvider`, `TTSProvider` e `PronunciationProvider`. Serviços de domínio
dependem só dessas interfaces; adicionar um fornecedor = implementar a interface e registrá-lo em `ai/registry.py`.
