# 6. Instalação e implantação

## 6.1 Desenvolvimento local

Pré-requisitos: Python 3.12+, [uv](https://docs.astral.sh/uv/), Node 22+, PostgreSQL 16 (ou Docker).

```bash
# Backend
cd backend
cp .env.example .env            # defina JWT_SECRET (python -c "import secrets; print(secrets.token_urlsafe(64))")
uv sync
uv run alembic upgrade head     # com DATABASE_URL apontando para o PostgreSQL
uv run uvicorn app.main:app --reload --port 8000
# Documentação interativa da API: http://localhost:8000/docs (desativada em produção)

# App
cd mobile
cp .env.example .env            # EXPO_PUBLIC_API_URL=http://SEU_IP:8000 para testar no celular
npm install
npm start                       # Expo: abra no navegador (w) ou no celular
```

Sem PostgreSQL, o backend sobe em modo desenvolvimento com SQLite (`DATABASE_URL` padrão) e cria as tabelas automaticamente.

### Com Docker
```bash
cp backend/.env.example backend/.env   # defina JWT_SECRET e, se quiser, as chaves dos provedores
docker compose up --build              # PostgreSQL + API (migrações rodam na inicialização)
```

## 6.2 Produção (backend)
1. **Banco**: PostgreSQL gerenciado com backups automáticos e TLS.
2. **API**: imagem `backend/Dockerfile` (usuário sem privilégios, `ffmpeg`, healthcheck, `alembic upgrade head` antes do uvicorn).
   Rode em qualquer orquestrador de contêineres (Cloud Run, ECS/Fargate, Fly.io, Kubernetes) atrás de HTTPS.
3. **Variáveis obrigatórias**: `ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`. Credenciais de IA/voz via
   gerenciador de segredos do provedor de nuvem — nunca no repositório nem no bundle do app.
4. **Jobs**: agende `python -m app.jobs purge` diariamente (retenção de gravações).
5. **Escala**: aumente réplicas e `WEB_CONCURRENCY`; mova os limitadores para Redis.
6. **Observabilidade**: logs em JSON já incluem `X-Request-ID`; acrescente métricas/traços (OpenTelemetry) e alertas de custo
   sobre `usage_ledger`.

## 6.3 App (iOS/Android)
- Builds com EAS: `npx eas-cli@latest build --platform ios|android` (perfis em `eas.json`, a criar com `eas build:configure`).
- Defina `EXPO_PUBLIC_API_URL` para a URL de produção (variáveis `EXPO_PUBLIC_*` ficam no bundle: **não** coloque segredos).
- Permissão de microfone já configurada em `app.json` (`expo-audio`).
- Como `expo-audio`, `expo-secure-store` e `react-native-svg` têm código nativo, use um *development build* (não o Expo Go) para testar no aparelho.
- Web: `npx expo export --platform web` gera um site estático (`dist/`) servível por qualquer CDN.

## 6.4 Ativando provedores
Veja `docs/05-provedores-e-custos.md`. Após configurar, reinicie a API e confira `GET /api/v1/system/capabilities`.
