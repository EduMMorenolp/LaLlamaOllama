# Arquitectura — Backend

```
main.ts
├── middlewares (auth, security, error-handler)
├── routes/
│   ├── status.ts
│   ├── auth.ts
│   ├── security.ts
│   ├── hardware.ts
│   ├── engine-stats.ts
│   ├── docker.ts
│   ├── ngrok.ts
│   ├── models.ts
│   ├── chat.ts
│   ├── agents.ts
│   └── search.ts
├── use-cases/ (30+ casos de uso)
├── repositories/
│   └── DockerContainerRepository
├── services/
│   ├── ollama/ (OllamaService, GPU watcher)
│   ├── session/ (SessionManager)
│   ├── memory/ (sistema de memoria SQLite)
│   └── agents/ (generación de agentes)
├── types/ (DTOs con Zod)
└── app.module.ts (registro de MCP tools)
```

## Flujo de request

```
Request → main.ts → middleware (auth, rate-limit)
  → route handler → use case → service → response
```

## Endpoints principales

- `GET /api/status` — Estado completo del servidor
- `GET /api/status/fast` — Estado rápido (cached)
- `POST /v1/chat/completions` — Chat con streaming SSE
- `GET /v1/models` — Listar modelos disponibles
- `POST /api/pull` — Descargar modelo
- `GET /api/ngrok/status` — Estado del túnel
- `GET /api/hardware` — VRAM y GPU
- `POST /api/ban` — Banear IP
- `GET /sse` — SSE para MCP remoto
