---
trigger: always_on
glob:
description: Reglas globales del proyecto LaLlamaOllama. Siempre activas. Cubren estructura, servicios, convenciones y brain MCP.
---

# Reglas del Proyecto — LaLlamaOllama

## CEREBRO MCP

- **Servidor**: `lallamaollama-brain`
- **Proyecto activo**: `lallamaollama`
- **URL SSE**: `http://192.168.0.236:3015/sse`
- **Docker stdio**: imagen `lallamaollama-mcp-brain`, datos en `./data/`

Siempre pasar `project: "lallamaollama"` en toda llamada al cerebro.

---

## ESTRUCTURA DEL PROYECTO

```
LaLlamaOllama/
├── backend/          → Express 4 + TypeScript NodeNext, puerto 3016
│   └── src/
│       ├── main.ts           → Punto de entrada, rutas Express, Socket.IO
│       ├── app.module.ts     → Módulo raíz (estilo NestJS)
│       ├── auth/             → AuthService (API Key enforcement)
│       ├── ollama/           → OllamaService + MCP_TOOL_CATALOG
│       └── session/          → SessionManager
├── frontend/         → React 19 + Vite 7, puerto 8080
│   └── src/
│       ├── App.tsx           → Router principal
│       ├── components/       → 13 componentes de UI
│       ├── services/         → api.service.ts + socket.service.ts
│       └── index.css         → Design system (variables CSS, glassmorphism)
├── mcp-brain/        → Servidor MCP + API REST, puerto 3015
│   └── src/
│       ├── database/         → SQLite + schemas + write queue
│       ├── services/         → Use cases (memories, sessions, llm, analysis, audit, settings, templates)
│       └── server/           → api.ts (REST) + mcp.ts (MCP tools)
├── agent-engine/     → Agente autónomo, puerto 3020 (Express, WS, Redis, SQLite)
│   └── src/
│       ├── server/           → api.ts, ws.ts, handlers.ts, cron.ts
│       ├── services/         → agent/, tools/, brain/, db/, queue/, telegram/
│       └── gateway/          → protocol.ts
├── agent-frontend/   → Frontend del agente, puerto 8081 (React + Vite + nginx)
│   └── src/
│       ├── components/       → AgentChat, Agentes, Knowledge, Tareas, Conexion
│       ├── contexts/         → WebSocketContext, ToastContext
│       └── config.ts         → engineUrl, wsUrl, brainUrl
├── docs/              → Documentación global
│   └── postman-collection/  → LaLlamaOllama-Postman-Collection.json
├── .agents/          → Reglas y workflows de Antigravity
├── .opencode/        → Agentes de OpenCode AI
├── biome.json        → Linter + formatter global (raíz)
└── docker-compose.yml
```

## SERVICIOS DOCKER

| Container | Puerto | Stack |
|-----------|--------|-------|
| `mcp-ollama-motor` | 11434 | Ollama LLM |
| `backend` | 3016 | Express + TS |
| `brain` | 3015 | mcp-brain (MCP + REST) |
| `frontend` | 8080 | React + Vite (Dashboard) |
| `agent-engine` | 3020 | Express + WS + BullMQ + SQLite |
| `agent-frontend` | 8081 | React + Vite + nginx |
| `agent-engine-redis` | 6379 | Redis 7 Alpine |
| `mcp-ngrok-tunnel` | — | Ngrok |

---

## LINTING — BIOME (OBLIGATORIO)

**Configuración en `biome.json` (raíz):**
- Indent: **tabs**, width 4
- Line width: **120**
- Quotes: **double**
- Semicolons: **always**
- Trailing commas: **es5** (JS), **none** (JSON)
- Linter: **recommended rules**
- VCS: respeta `.gitignore`

**Comandos:**
```bash
# Raíz — verifica backend + mcp-brain
npx biome check .

# Aplicar formato automático
npx biome check --write .

# Frontend (usa ESLint + Vite)
cd frontend && npm run lint
```

**REGLA**: Antes de dar un task por terminado, el código DEBE pasar `npx biome check .` sin errores.

---

## REGLAS GENERALES DE CÓDIGO

1. **TypeScript estricto** — no usar `any`, preferir tipos explícitos
2. **No comandos shell** — usar `Dockerode` para operaciones Docker
3. **Error handling** — siempre `try/catch` con `error instanceof Error ? error.message : String(error)`
4. **Imports con extensión `.js`** — NodeNext module resolution (backend y mcp-brain)
5. **Async/await** — no callbacks, no `.then()` encadenados
6. **Variables de entorno** — leer desde `process.env`, validar al arranque

---

## TIPOS DE MEMORIA POR TAREA

| Tarea | `type` |
|-------|--------|
| Nueva ruta API en backend | `feature` |
| Nueva MCP Tool en backend o mcp-brain | `feature` |
| Nuevo componente React | `feature` |
| Nuevo use case en mcp-brain | `feature` |
| Fix en Docker/compose | `bug-fix` o `configuration` |
| Decisión de diseño UI | `architecture` |
| Convención de código | `convention` |
| Cambio en schema SQLite | `architecture` |
| Entrada en CHANGELOG.md | `changelog` |
