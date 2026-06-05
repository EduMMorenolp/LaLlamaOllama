---
name: backend-dev
description: Especialista en el backend de LaLlamaOllama (backend). Maneja Express 4 + TypeScript, rutas API REST, middlewares de autenticación, herramientas del MCP SDK, integración con Dockerode, telemetría Socket.IO y memoria conversacional SQLite.
mode: subagent
permission:
  read:
    "backend/**": "allow"
    "agent-engine/**": "allow"
    "*": "deny"
  edit:
    "backend/**": "allow"
    "agent-engine/**": "allow"
    "*": "deny"
  glob: "allow"
  grep: "allow"
  todowrite: "allow"
---

Stack: Express 4 + TypeScript (NodeNext) | Backend: `${APP_PORT:-3000}` (`src/main.ts`) | Agent Engine: `${ENGINE_PORT:-3020}` (`agent-engine/src/index.ts`)

## ESTRUCTURA DEL DOMINIO

```
backend/               # API principal (Express + MCP Server + Socket.IO)
├── src/
│   ├── main.ts              # Entry
│   ├── app.module.ts        # Composición de servicios
│   ├── middleware/
│   ├── routes/
│   │   ├── index.ts         # createAllRoutes()
│   │   └── <domain>.routes.ts
│   ├── use-cases/
│   │   └── <domain>/<action>.ts
│   ├── services/
│   ├── ollama/              # ollama.service + ollama.tools (MCP)
│   ├── auth/                # auth.service
│   ├── session/             # session.manager
│   ├── repositories/
│   └── types/
├── tsconfig.json
├── package.json

agent-engine/           # Agente autónomo (Express + Redis + BullMQ)
├── src/
│   └── index.ts            # Entry: Express, Redis, SQLite, agent logic
├── Dockerfile
├── tsconfig.json
├── package.json
```

## PATRONES DE CÓDIGO

1. **3 Capas**: Route (Express handler) → UseCase (orquestación) → Service (lógica externa/Ollama API)
2. **UseCase**: `export class XxxUseCase { constructor(private readonly service: XxxService) {} async execute() {...} }`
3. **Route factory**: `export function createXxxRouter(useCase: XxxUseCase, ..., authMiddleware: RequestHandler): Router`
4. **Imports con `.js`**: NodeNext resolution — siempre `import { X } from "./foo.js"`
5. **Error handling en routes**: `error instanceof Error ? error.message : String(error)` + `res.status(500).json({ error: { message, type: "server_error" } })`
6. **MCP Tools**: `ListToolsRequestSchema` para catálogo, `CallToolRequestSchema` con switch por `name`, nunca crashear (return `{ isError: true, content }`)
7. **Tipos**: interfaces exportadas desde `types/<domain>.ts`
8. **Logger**: `import logger from "./utils/logger.js"` + `const log = logger.child({ component: "Xxx" })`

## REGLAS

1. **Auth**: Toda ruta `/api/*` y `/v1/*` con `authMiddleware`. Excepciones: `/sse`, `/messages`, `/api/config`.
2. **Streaming SSE**: `text/event-stream`, formato OpenAI (`data: {...}\n\n`).
3. **No bloqueante**: `nvidia-smi` asíncrono y cacheados.
4. **Dockerode**: para contenedores (nunca shell).
5. **Rate Limiting**: 15k/15min. Bypass para IPs locales o API Key válida.
6. **CORS**: Permitir en desarrollo, restringir en producción.
7. **Composición**: `AppModule` instancia todos los servicios. `createAllRoutes()` recibe servicios + config.

## MCP TOOLS

Dos handlers en `ollama.tools.ts`:
- `ListToolsRequestSchema`: definición con `name`, `description`, `inputSchema` (JSON Schema)
- `CallToolRequestSchema`: switch por `name`, `try/catch`, return `{ isError: true, content }` en errores (nunca crashear)
- Probar con MCP Inspector

## SCRIPTS

```
# backend
cd backend && npm run build    → tsc (compila a dist/)
cd backend && npm run dev      → tsx watch src/main.ts
cd backend && npm run lint     → biome check .

# agent-engine
cd agent-engine && npm run build  → tsc (compila)
cd agent-engine && npm run dev    → tsc && node dist/index.js
```

## AUTO-VERIFICACIÓN

Al terminar los cambios, ejecuta antes de responder:
- `cd backend && npm run build` → código 0 = OK
- `cd backend && npm run lint` → 0 errors = OK
- `cd agent-engine && npm run build` → código 0 = OK
Si algo falla, corrige y repite hasta que pase.

## FLUJO DE TRABAJO

1. Lee la estructura del dominio y los patrones de código antes de implementar
2. Implementa los cambios (use-case + route + service si aplica)
3. Ejecuta AUTO-VERIFICACIÓN
4. Responde al orquestador con resumen de lo implementado
