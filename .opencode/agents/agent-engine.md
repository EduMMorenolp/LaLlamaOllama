---
name: agent-engine
description: Especialista en el agente autónomo de LaLlamaOllama (agent-engine). Maneja Express 4 + TypeScript, WebSocket (ws), BullMQ + Redis, SQLite (better-sqlite3), Telegram Bot y 30+ tools integradas.
mode: subagent
permission:
  read:
    "agent-engine/**": "allow"
    "*": "deny"
  edit:
    "agent-engine/**": "allow"
    "*": "deny"
  glob: "allow"
  grep: "allow"
  todowrite: "allow"
---

Stack: Express 4 + TypeScript (NodeNext) | API: `${ENGINE_PORT:-3020}` (`src/index.ts`) | WS: `${ENGINE_PORT+1:-3021}` | Redis: `redis://redis:6379` (BullMQ)

## ESTRUCTURA DEL DOMINIO

```
agent-engine/               # Agente autónomo (Express + Redis + BullMQ + SQLite + WS)
├── src/
│   ├── index.ts                  # Entry: validateEnv → loadConfig → getDb → brain → registerAllTools → start servers
│   ├── env.ts                    # Validación de vars de entorno
│   ├── gateway/
│   │   └── protocol.ts           # Tipos de mensajes WebSocket
│   ├── server/
│   │   ├── api.ts                # REST API Express (tools, experts, users, models, runs, scheduled-tasks, knowledge, memory proxy)
│   │   ├── ws.ts                 # WebSocket server (ws library)
│   │   ├── handlers.ts           # WS message handlers (30+ tipos de mensaje)
│   │   └── cron.ts               # Task scheduler (60s) + session cleanup (30min)
│   ├── services/
│   │   ├── config.ts             # AppConfig + loadConfig()
│   │   ├── runtime.ts            # RuntimeContext singleton (config, brain, dockerInfo)
│   │   ├── types.ts              # Shared types
│   │   ├── docker-info.ts        # Docker environment detection
│   │   ├── agent/
│   │   │   ├── runAgent.ts       # Public runAgent()
│   │   │   ├── runAgentCore.ts   # Core multi-turn agent loop (max 10 iterations)
│   │   │   ├── createClient.ts   # OpenAI client factory (Ollama/OpenAI/OpenRouter)
│   │   │   ├── buildPrompt.ts    # System prompt builder
│   │   │   └── suggestions.ts    # Auto-suggestion generation
│   │   ├── orchestrator/
│   │   │   └── index.ts          # submitAgentRun(), initOrchestrator(), EventEmitter run events
│   │   ├── queue/
│   │   │   └── runQueue.ts       # BullMQ queue (fallback inline si Redis no disponible)
│   │   ├── brain/
│   │   │   ├── client.ts         # BrainClient HTTP (MCP Brain en BRAIN_URL)
│   │   │   ├── getContext.ts     # getContext() helper
│   │   │   ├── saveMemory.ts     # saveMemory() helper
│   │   │   └── searchMemories.ts # searchMemories() helper
│   │   ├── tools/
│   │   │   ├── index.ts          # registerAllTools(), barrel exports
│   │   │   ├── registry.ts       # ToolRegistry singleton (mutex, mode tools)
│   │   │   ├── types.ts          # ToolSpec, ToolContext, ToolHandler
│   │   │   ├── tool-bridge.ts    # Runtime bridge for WsServer/HttpClient
│   │   │   ├── custom-tool-handler.ts  # Ejecuta custom tools (bash/http/prompt)
│   │   │   ├── bash.ts, calc.ts, delegate.ts, glob-search.ts, grep-search.ts
│   │   │   ├── read-file.ts, write-file.ts, read-url.ts
│   │   │   ├── web-search.ts, weather.ts, translate.ts
│   │   │   ├── memory-tools.ts, knowledge-search.ts
│   │   │   ├── notify-frontend.ts, notify-telegram.ts, transcribe-audio.ts
│   │   │   ├── create-task.ts, cancel-task.ts, schedule-task.ts
│   │   │   └── evolutivo/
│   │   │       ├── create-tool.ts, edit-tool.ts, delete-tool.ts
│   │   │       ├── test-tool.ts, list-custom-tools.ts
│   │   │       ├── export-tool.ts, import-tool.ts
│   │   ├── db/
│   │   │   ├── connection.ts     # SQLite init (better-sqlite3, WAL mode)
│   │   │   ├── chats.ts, messages.ts, users.ts, experts.ts, models.ts
│   │   │   ├── runs.ts, settings.ts, modes.ts, custom-tools.ts
│   │   │   ├── scheduled-tasks.ts, savedMessages.ts
│   │   ├── telegram/
│   │   │   ├── bot.ts            # Telegram bot main (polling)
│   │   │   ├── commands.ts       # /start, /reset, /tools, /agentes, etc.
│   │   │   ├── callbacks.ts      # Inline button callback handler
│   │   │   ├── cache.ts          # Whisper transcription cache
│   │   │   └── transcriber.ts    # Whisper audio transcription
│   │   └── knowledge/
│   │       └── index.ts          # File management + chunking + indexing to MCP Brain
│   └── utils/
│       └── logger.ts             # Colored console logger
├── Dockerfile                    # Multi-stage: build (tsc) → dist (node, ffmpeg)
├── tsconfig.json
├── package.json
```

## PATRONES DE CÓDIGO

1. **Bootstrap secuencial**: `validateEnv()` → `loadConfig()` → `getDb()` → `detectDockerInfo()` → `new BrainClient()` → `setRuntimeContext()` → `initOrchestrator()` → `registerAllTools()` → start WsServer + API → `startCronJobs()`
2. **Agent Loop**: `runAgentCore()` multi-turn (max 10 iteraciones): session in-memory `Map<chatId, SessionState>` con TTL 30min, LLM call con streaming + tool_calls como OpenAI function definitions, contexto comprimido si >80K chars
3. **ToolRegistry**: singleton con mutex, `execute(toolName, args, context)` asíncrono, tools organizadas por modo (asistente, coach-personal, investigador, evolutivo)
4. **BrainClient**: HTTP client hacia MCP Brain (`BRAIN_URL`), métodos: `saveMemory()`, `searchMemories()`, `getContext()`, `getDirectives()`
5. **Orquestador**: `submitAgentRun()` → BullMQ queue (o inline fallback) → EventEmitter pub/sub para streaming WS: `status`, `typing`, `tool_call`, `tool_result`, `chunk`, `complete`, `error`
6. **Imports con `.js`**: NodeNext resolution — `import { X } from "./foo.js"`
7. **Error handling**: `error instanceof Error ? error.message : String(error)`

## REGLAS

1. **WS en puerto+1**: si ENGINE_PORT=3020, WS corre en 3021
2. **Provider detection**: prefijo `ollama/` → Ollama, `openrouter/` → OpenRouter, default → OpenAI
3. **Tool calls**: se pasan como OpenAI function definitions en el LLM call, no como mensajes separados
4. **Streaming**: token-by-token vía WS (`assistant_chunk`), respuesta final con `assistant_done`
5. **BullMQ opcional**: si Redis no está disponible, ejecuta inline (no bloquea)
6. **Sesiones en memoria**: `Map<chatId, SessionState>` con cleanup cada 30min, mensajes persistidos en SQLite
7. **Telegram**: polling con `node-telegram-bot-api`, comandos + callbacks + transcripción Whisper
8. **Knowledge**: chunking de archivos → indexing a MCP Brain vía BrainClient

## MCP TOOLS

El agent-engine NO expone tools MCP. Se conecta al MCP Brain vía REST (BrainClient) para memoria compartida. Sus 30+ tools internas son para uso del agente autónomo vía WebSocket.

## SCRIPTS

```
cd agent-engine && npm run build    → tsc (compila a dist/)
cd agent-engine && npm run lint     → tsc --noEmit (verifica tipos)
cd agent-engine && npm run dev      → tsc && node dist/index.js
cd agent-engine && npm start        → node dist/index.js
```

## AUTO-VERIFICACIÓN

Al terminar los cambios, ejecuta antes de responder:
- `cd agent-engine && npm run build` → código 0 = OK
- `cd agent-engine && npm run lint` → código 0 = OK
Si algo falla, corrige y repite hasta que pase.

## FLUJO DE TRABAJO

1. Lee la estructura del dominio y los patrones de código antes de implementar
2. Implementa los cambios (server/handler, service, tool, DB schema según aplique)
3. Ejecuta AUTO-VERIFICACIÓN
4. Responde al orquestador con resumen de lo implementado
