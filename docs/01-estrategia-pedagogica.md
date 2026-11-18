# 1. Estratégia pedagógica

> Objetivo: transformar conhecimento passivo (ler, reconhecer) em comunicação ativa (entender quem fala
> e responder rápido, sem tradução mental). Não prometemos fluência; medimos progresso a cada 15 dias.

## 1.1 Diagnóstico do perfil-alvo

Adulto brasileiro, nível intermediário (B1 típico), que **lê melhor do que ouve** e **demora para formular
respostas**. Isso aponta para três gargalos clássicos em aquisição de L2:

| Gargalo | Causa provável | Resposta do app |
|---|---|---|
| Não entende a fala real | Pouca exposição a *connected speech*, sotaques e velocidade natural | Listening graduado (0.75x→1.15x), 4 sotaques, ditado de trechos-chave, notas de *connected speech*, shadowing |
| Demora para responder | Vocabulário passivo, recuperação lenta, tradução palavra a palavra | Quick Response com janela adaptativa, Think in English, recuperação ativa no FSRS |
| Trava ao falar | Ansiedade + falta de "blocos prontos" (chunks) | Expressões completas, Sentence Building, Conversation Challenge progressivo (3→30 min), feedback não interruptivo |

## 1.2 Metodologias e como foram implementadas

| Metodologia | Evidência / referência | Implementação |
|---|---|---|
| **Repetição espaçada (FSRS-5)** | Efeito de espaçamento (Cepeda et al., 2006); FSRS supera SM-2 em benchmarks abertos de previsão de memória | `backend/app/services/fsrs.py` — implementação própria **verificada passo a passo contra a biblioteca de referência py-fsrs** (teste automatizado com 200 sequências). Retenção-alvo 90%. Erros do usuário viram cartões. |
| **Recuperação ativa** | *Testing effect* (Roediger & Karpicke, 2006) | Cartões pedem para **produzir** a expressão a partir do significado + frase com lacuna (não reconhecimento). Nota sugerida a partir de acerto e tempo de resposta. |
| **Input compreensível** | Krashen (i+1); limiar de ~95–98% de cobertura lexical para compreensão (Nation) | Listening por nível CEFR, velocidade ajustável, transcrição só **depois** de responder; o tutor ajusta a linguagem "um passo acima" do nível. |
| **Shadowing** | Melhora prosódia e percepção (Hamada, 2016) | Frases com foco em ligação, reduções e entonação; feedback de inteligibilidade, ritmo e pausas — com resultado **inconclusivo** quando o áudio não permite avaliar. |
| **Task-Based Language Teaching** | Ellis (2003); Long | 14 simulações com objetivos verificáveis, personagens com sotaques/estilos e **eventos inesperados**. |
| **Interleaving / prática variada** | Rohrer & Taylor (2007) | O gerador do plano usa "créditos ponderados": tipos de atividade se alternam entre dias e dentro do dia (input ↔ output). |
| **Feedback corretivo** | Lyster & Ranta (1997): *recasts* e *prompts*; Ellis sobre feedback adiado em fluência | Modo natural: **sem interrupções**, correções guardadas para o relatório. Modo correção imediata: *recast* curto + explicação. Severidade: impede compreensão × pode confundir × pequeno ajuste. |
| **Fluência medida** | Medidas de fluência em L2 (De Jong & Bosker, 2013; Tavakoli & Skehan, 2005) | Taxa de fala, taxa de articulação, pausas ≥ 250 ms, comprimento médio de trecho (MLR), pausas preenchidas, latência de resposta. |
| **Inteligibilidade > sotaque nativo** | Munro & Derwing (1995); Levis (2005) | Nada no sistema penaliza sotaque compreensível; a métrica padrão é "o reconhecedor entendeu X% das palavras". |

## 1.3 Interferência do português (L1)

O app tem um detector determinístico (`error_analyzer.py`, 30+ regras) para erros típicos de brasileiros:
*I am agree*, *depend of*, *since 5 years*, *I have 35 years*, *assist the meeting*, *pretend to*, *lose the flight*,
*I have a doubt*, *Is possible…*, *informations*, *more easy*, *explain me*… Ele funciona sem IA, complementa o LLM e é
a linha de base do harness de avaliação (recall 100% nos casos cobertos, 0% de falso positivo em frases corretas).

## 1.4 Módulo "Destravar a Fala"

1. **Quick Response** — a pergunta é falada; a janela de resposta começa em 6,5–10 s (por nível), encurta 10% a cada acerto e alonga 15% a cada falha (mínimo 2,5 s). Mede-se o tempo até **começar** a responder.
2. **Think in English** — descrever cenas, explicar sem dizer a palavra (circunlocução), falar sozinho, respostas em cadeia, reformular.
3. **Sentence Building** — ordenar blocos → expandir (quando/por quê/contraste/condição/impacto) → resposta livre.
4. **Conversation Challenge** — 3, 5, 10, 15 e 30 minutos, com cronômetro.
5. **No Portuguese Mode** — o tutor só usa o idioma estudado; se o usuário escrever em português, recebe ajuda em inglês simples.
6. **Confidence Training** — progressão de duração e dificuldade + feedback não interruptivo no modo natural.

## 1.5 Programa Intensivo de 90 dias

Gerado a partir de: avaliação inicial (ou nível autodeclarado), minutos/dia, data da viagem (o plano se ajusta a 14–120 dias),
áreas profissionais e dificuldades. Fases com objetivos e **metas mensuráveis**:

| Fase | Foco | Metas mensuráveis (exemplos) |
|---|---|---|
| 1 · dias 1–30 | Base comunicativa | Responder em ≤ 4 s em 80% das perguntas; 5 min sem português; ≥ 70% em listening B1; 120 expressões com retenção ≥ 85% |
| 2 · dias 31–60 | Comunicação profissional | Explicar um problema técnico em 2 min (sintoma → hipótese → impacto → próximo passo); reunião simulada de 15 min; ≥ 65% em 3 sotaques |
| 3 · dias 61–90 | Imersão e simulações | Apresentar projeto 5 min + 5 min de perguntas; 30 min sem roteiro; resolver 5 situações inesperadas |

Avaliações nos dias 1, 15, 30, 45, 60, 75 e 90. Após cada avaliação, o **motor adaptativo** recalcula a dosagem dos dias futuros
(sem mudar os objetivos das fases) e mostra ao usuário **por que** o plano mudou.

### Expectativa realista (exibida no app)

Referência de ~180–200 horas de aprendizagem guiada por nível CEFR (Cambridge English). Com 45 min/dia × 90 dias ≈ 68 h, a
expectativa é avançar **cerca de um terço a metade de um nível** em proficiência geral — e um ganho maior nas tarefas
treinadas (reuniões, explicações técnicas, situações de viagem). Não há garantia de fluência.

## 1.6 Motor adaptativo (regras transparentes)

| Sinal | Ajuste |
|---|---|
| Leitura ≥ listening + 12 pontos | listening ×1.4, shadowing ×1.2 |
| Acerto em listening (14 dias) < 65% | listening ×1.25 |
| Vocabulário ≥ fala + 10 **ou** mediana do Quick Response > 5 s | quick response ×1.5, think in English ×1.3, conversa ×1.2 |
| Mesmo tipo de erro ≥ 3 vezes (30 dias) | revisão de erros ×1.6, construção de frases ×1.3 (com os tópicos citados) |
| Vocabulário < 45 ou retenção real < 80% | revisão espaçada ×1.3 |
| Pronúncia < 50 | shadowing ×1.4 |
| Falas curtas (< 6 palavras em média) | construção de frases ×1.2 |

## 1.7 Preparação para a Índia (destino da viagem)

Quando o destino é a Índia, o objetivo nº 1 passa a ser **entender falantes de inglês indiano** — colegas de planta,
fornecedores, motoristas e atendentes. Não pedimos que o aprendiz adote o sotaque.

| O que muda | Como |
|---|---|
| Listening | ~2 de cada 3 sessões com falantes indianos (diálogos em Bengaluru e Pune: imigração, autorriquixá, reunião diária na planta, almoço, fornecedor, reunião com cliente) |
| Simulações | Proporção crescente de cenários na Índia (≈50% → 68% → 76% nas fases 1 → 3), com personagens indianos e eventos inesperados realistas (queda de energia, "it may be a little difficult" = provável "não") |
| Tutor | Sotaque padrão indiano; usa vocabulário e padrões do inglês indiano de forma respeitosa; incentiva estratégias de esclarecimento |
| Vocabulário | 30 expressões do inglês indiano com prioridade na revisão espaçada (do the needful, revert, prepone, kindly, lakh, crore, "today only", "one small doubt"…) |
| Números | Treino de compreensão de valores em **lakh/crore** com voz en-IN (12,50,000 = 1,25 milhão) |
| Guia "Inglês da Índia" | Traços de pronúncia (ritmo silábico, t/d retroflexos, v/w, "th" como t/d), gramática e uso, comunicação no trabalho ("não" indireto, hierarquia, "yes" ≠ concordância) |
| Metas extras | Fase 1: lakh/crore + 15 expressões · Fase 2: ≥ 65% em listening com falantes indianos · Fase 3: visita técnica simulada com "sim/não" claro sobre prazos |

**Vantagem para brasileiros:** vogais simples (day ≈ "dê"), "r" batido, p/t/k sem aspiração e "th" como t/d são parecidos com o
português. O desafio costuma ser velocidade, ritmo e expressões locais.

**Limite honesto:** vozes sintéticas en-IN são mais lentas e "limpas" que a fala real (que mistura hindi/línguas locais, tem ruído
e chamadas telefônicas). O app recomenda complementar com áudio autêntico (ex.: aulas NPTEL dos IITs, noticiários indianos em inglês).

## 1.8 Particularidades por idioma (Fase E)

Cada idioma tem estratégia, conteúdo inicial e instruções próprias para o tutor (`content/languages.py`):

- **Espanhol** — evitar o "portunhol": falsos amigos (exquisito, embarazada, oficina, polvo…), variedades (Espanha/México/Argentina), jota/erre/vogais orais.
- **Italiano** — consoantes duplas (pares mínimos nonno/nono, palla/pala), *passato prossimo* com essere/avere, *tu × Lei*.
- **Mandarim** — tons e pares de tons, sandhi do 3º tom, pinyin, caracteres por frequência, classificadores; o tutor sempre fornece caractere (pinyin) — significado.
- **Japonês** — kana primeiro, kanji gradual, partículas em contexto, です/ます por padrão, vogais longas e geminadas.
