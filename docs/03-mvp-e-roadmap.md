# 3. MVP, status e roadmap

Legenda: ✅ implementado e testado · ⚙️ implementado, depende de credencial/serviço externo · 🔜 roadmap

## 3.1 MVP (Fase D)

| Item do MVP | Status | Onde |
|---|---|---|
| 1. Avaliação de inglês (listening, vocabulário, gramática em contexto, leitura, fala, autoavaliação; CEFR por competência com método e confiança) | ✅ (fala: rubrica por IA ⚙️ ou métricas automáticas ✅) | `services/assessment.py`, `app/assessment.tsx` |
| 2. Plano intensivo de 90 dias (fases, metas mensuráveis, avaliações a cada 15 dias, adaptação explicável, data da viagem) | ✅ | `services/planner.py`, `adaptive.py`, `app/plan.tsx` |
| 3. Tutor de conversação por voz (natural, correção imediata, No Portuguese, Quick Response, cenários, Challenge; relatório final; memória entre sessões) | ✅ texto + voz do navegador · ⚙️ voz por STT no servidor e IA generativa | `services/tutor.py`, `app/tutor/[id].tsx` |
| 4. Listening (16 diálogos, 4 sotaques — 6 com falantes indianos, velocidade 0.75–1.15x, ditado, transcrição após responder, connected speech) | ✅ (vozes neurais com sotaque ⚙️) | `content/en_listening.py`, `app/listening` |
| 5. Vocabulário com repetição espaçada (FSRS-5, recuperação ativa, ~200 expressões, incluindo 30 do inglês indiano; erros e documentos viram cartões) | ✅ | `services/fsrs.py`, `vocab.py`, `app/(tabs)/vocab.tsx` |
| 6. Simulações de viagem e trabalho (19 cenários — 5 na Índia —, personagens, objetivos, eventos inesperados) | ✅ roteiro offline · ⚙️ improviso e checagem de objetivos com IA | `content/scenarios.py` |
| 7. Dashboard de evolução (competências, esforço × domínio, retenção, conversa, listening, plano, exportação) | ✅ | `services/dashboard.py`, `app/(tabs)/progress.tsx` |

## 3.2 Demais requisitos

| Requisito | Status |
|---|---|
| Destravar a Fala (Quick Response adaptativo, Think in English, Sentence Building, Challenge 3–30 min, No Portuguese) | ✅ |
| Shadowing com feedback de inteligibilidade, ritmo e pausas; inconclusivo quando o áudio é ruim | ✅ (via transcrição) · ⚙️ notas por fonema com Azure |
| Feedback que distingue erro que impede a compreensão × pequena imperfeição | ✅ |
| Inglês corporativo/engenharia (BOM, SolidWorks, SAP, tolerâncias, troubleshooting…) | ✅ vocabulário, cenários e listening |
| Preparação por destino — **Índia**: listening com falantes indianos, simulações em Bengaluru/Pune, tutor com inglês indiano, guia, expressões e treino de lakh/crore | ✅ (vozes neurais en-IN ⚙️ Azure) |
| Documentos técnicos do usuário → exercícios/diálogos/simulação, com proteção de dados e anti prompt injection | ✅ offline (glossário + lacunas) · ⚙️ diálogo e role-play com IA |
| Multilíngue com estratégias próprias (ES, IT, ZH, JA) | ✅ trilhas iniciais (vocabulário FSRS, shadowing, quick response, instruções do tutor) · 🔜 avaliação e listening completos |
| Interface em PT-BR, modo claro/escuro, acessibilidade (rótulos, papéis, contraste), mobile e web | ✅ |
| Modo mãos livres, transcrição opcional, exercícios de 5 min | ✅ |
| Gamificação moderada (sequência, meta diária, progresso do plano) | ✅ |
| Privacidade: consentimentos granulares, retenção de gravações, exportação e exclusão (LGPD) | ✅ |
| Controle de custos de API (orçamento por usuário, teto global, registro de uso) | ✅ |
| Notificações inteligentes (lembrete de revisões vencidas / atividade do plano) | 🔜 (expo-notifications + job diário) |
| Download de aulas para estudo offline | 🔜 (cache local do conteúdo e áudios neurais) |
| Conversa em tempo real full-duplex (WebRTC) | 🔜 |
| Otimização dos parâmetros FSRS por usuário | 🔜 (`review_logs` já registra o necessário) |

## 3.3 Plano de implementação por fases

| Fase | Entregas | Status |
|---|---|---|
| A — Pesquisa e planejamento | Metodologias, requisitos, limitações (este diretório `docs/`) | ✅ |
| B — Arquitetura | Módulos, banco, integrações, APIs | ✅ |
| C — Protótipo funcional | Telas e navegação | ✅ |
| D — MVP | Itens 1–7 acima | ✅ (recursos ⚙️ exigem credenciais) |
| E — Expansão | ES/IT/ZH/JA completos: banco de itens CEFR por idioma, listening nativo, kana/kanji e tons com exercícios dedicados | 🔜 (base pronta) |
| F — Validação | Piloto com usuários reais, coleta de métricas, ajuste do motor adaptativo, avaliação humana do feedback da IA | 🔜 |

## 3.4 Próximos passos recomendados (ordem de impacto)

1. **Configurar provedores** (LLM + STT) e rodar `evals/feedback_eval.py --engine llm` e `evals/stt_eval.py` com gravações reais de brasileiros.
2. **Piloto de 2 semanas** com 5–10 usuários: acompanhar latência de resposta, palavras por fala e retenção real (dados já coletados).
3. **Tempo real** (WebRTC) para conversas mais naturais, com *barge-in*.
4. **Notificações** de revisão vencida e conteúdo offline.
5. **Fase E**: avaliações e listening nativos para espanhol primeiro (maior proximidade com o português).
