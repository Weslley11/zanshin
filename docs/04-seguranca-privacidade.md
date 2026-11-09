# 4. Segurança e privacidade

## 4.1 Autenticação e sessões
- Senhas com **Argon2id** (parâmetros RFC 9106); comparação em tempo constante também para e-mail inexistente (evita enumeração).
- **Access token JWT** (HS256) de 15 min com `sub`/`type`/`exp`; segredo obrigatório e ≥ 32 caracteres em produção.
- **Refresh token opaco** (384 bits), guardado apenas como SHA-256, com **rotação a cada uso** e **detecção de reuso**: reapresentar um token já usado revoga toda a família (indício de roubo).
- Rate limit de login por IP+e-mail e de chamadas de IA por usuário (em memória por processo; usar Redis com várias réplicas).
- No celular os tokens ficam no Keychain/Keystore (`expo-secure-store`). No navegador (uso de desenvolvimento) ficam em `localStorage` — para web em produção, prefira cookies `HttpOnly`.

## 4.2 Proteção de dados (LGPD)
| Direito / princípio | Implementação |
|---|---|
| Consentimento granular | `ai_processing`, `voice_processing`, `recording_storage`, `document_processing` — exigidos pelos endpoints correspondentes (HTTP 403 `consent_required`) |
| Minimização | Áudio processado em memória e descartado por padrão; logs sem conteúdo do usuário (apenas rota, status e latência); documentos guardados só na versão redigida |
| Retenção de gravações | Só com consentimento; expiram em `RECORDING_RETENTION_DAYS` (padrão 30); job `python -m app.jobs purge` e limpeza no startup; revogar o consentimento apaga as gravações |
| Portabilidade | `GET /me/export` — JSON com todos os dados (sem hash de senha) |
| Eliminação | `POST /me/delete` (confirma senha) — apaga conta, conversas, cartões, planos, erros, documentos, gravações, tokens e registros de uso |
| Transparência | `/system/capabilities` informa quais provedores estão ativos; o app mostra o que é enviado a terceiros |

## 4.3 Documentos técnicos e prompt injection
1. Limite de tamanho; extração de texto de `.txt/.md/.csv/.pdf`.
2. Sanitização: remove caracteres invisíveis e de controle (inclusive *bidi overrides*), usados para esconder instruções.
3. **Bloqueio** (o arquivo não é armazenado) se houver marcações de confidencialidade (*Confidential*, *Uso interno*, *Trade secret*, *RESTRICTED*, *ITAR*…) ou segredos (chaves privadas, chaves AWS, tokens de API, senhas, strings de conexão).
4. **Redação** de e-mails, telefones, CPF/CNPJ, cartões (validação Luhn), IPs e URLs (internas e externas). A redação é deliberadamente conservadora: alguns códigos numéricos longos podem ser mascarados.
5. **Neutralização de prompt injection**: linhas com padrões de instrução ao modelo são removidas e listadas ao usuário; o texto restante vai ao modelo entre delimitadores como **dado não confiável**; a saída é validada por JSON Schema e pós-filtrada (sem URLs/e-mails, tamanho limitado).
6. O usuário confirma que está autorizado a usar o material.

## 4.4 Controle de custos (API paga)
- Orçamento diário por usuário: tokens de LLM, segundos de STT e caracteres de TTS (HTTP 429 `daily_budget_exceeded` com orientação para atividades offline).
- Teto global diário em USD (HTTP 503 `global_budget_exceeded`) contra abuso ou bugs.
- `usage_ledger` registra provedor, quantidade e custo estimado de cada chamada; preços configuráveis por variável de ambiente.
- Cache de prompt no Claude e `effort` baixo para conversa reduzem custo e latência.

## 4.5 Robustez
- Falha do provedor de IA → a sessão continua no modo offline e o app avisa (`degraded`).
- Recusa do modelo, truncamento e JSON inválido viram erros tratados (nunca texto quebrado na tela).
- Feedback de pronúncia **inconclusivo** quando o áudio está ruim, curto demais ou não corresponde à frase — nunca uma nota "confiante" sem base.
- Cabeçalhos de segurança (`nosniff`, `DENY`, `no-referrer`), `X-Request-ID`, `/docs` desativado em produção, CORS restrito.

## 4.6 Pendências recomendadas para produção
- Rate limiting distribuído (Redis) e WAF/CDN na frente da API.
- Armazenamento de gravações em bucket criptografado (S3/GCS com KMS) em vez de disco local.
- Revisão jurídica dos termos e da política de privacidade; DPA com os provedores de IA/voz; avaliar retenção zero de dados com cada fornecedor.
- Monitoramento (OpenTelemetry/Sentry) com filtragem de PII.
