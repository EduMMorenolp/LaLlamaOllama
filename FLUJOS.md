# Flujos del Sistema — LaLlamaOllama

## Arquitectura General

```
                ┌─────────────┐     ┌──────────┐
                │  Telegram   │     │ Browser  │
                └──────┬──────┘     └────┬─────┘
                       │ HTTP            │ HTTP
                       ▼                 ▼
                ┌──────────────┐  ┌──────────────┐
                │ agent-engine │  │   frontend   │
                │  (Express)   │  │ (React+Vite) │
                │  :3020/3021  │  │   :3016      │
                └──────┬───────┘  └──────┬───────┘
                       │ HTTP            │ HTTP
                       ▼                 ▼
                ┌──────────────┐  ┌──────────────┐
                │  mcp-brain   │  │   backend    │
                │  (Express)   │  │  (Express)   │
                │   :3015      │  │   :3000      │
                └──────┬───────┘  └──────┬───────┘
                       │ HTTP            │ HTTP
                       ▼                 ▼
                ┌──────────────┐  ┌──────────────┐
                │    SQLite    │  │    Ollama    │
                │  (FTS5+vec)  │  │  :11434      │
                └──────────────┘  └──────────────┘

agent-engine ──WS──▶ agent-frontend :8081 (React+Vite+nginx)
backend ──────WS──▶ frontend :3016 (Socket.IO)
```

---

## 1. Flujo de Chat (Telegram)

```
Usuario ──TG Message──▶ agent-engine (Telegram bot)
                              │
                              ▼
                   initTelegramDeps(config, brain, wsServer)
                              │
                              ▼
                   runAgent(chatId, userText, config, brain, {
                       onChunk, onToolCall, onToolResult
                   })
                              │
                              ▼
                   runAgentCore(chatId, userText, ...)
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
           brain.getContext()      buildPrompt()
           (memoria reciente)      (system prompt)
                    │                    │
                    └─────────┬──────────┘
                              ▼
                   LLM call via backend:3000/v1/chat/completions
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
               tool_call            text response
                    │                    │
                    ▼                    ▼
           runAgent.handleToolCall()    chunk streaming
                    │               (sendToClient via WS)
                    ▼
           tool result → LLM call #2
                              │
                              ▼
                   Response complete
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
         sendToClient(clientId,         brain.saveMemory()
         "assistant_done")              (auto-save si >50 chars)
               │
               ▼
         Telegram response (Markdown→HTML→plain fallback)
```

### Archivos clave
- `agent-engine/src/index.ts` — Telegram bot init, mode seed
- `agent-engine/src/services/telegram/bot.ts` — Bot message handler
- `agent-engine/src/services/agent/runAgent.ts` — Entry point
- `agent-engine/src/services/agent/runAgentCore.ts` — Core loop
- `agent-engine/src/server/handlers.ts` — WS event handlers (sendToClient)
- `agent-engine/src/server/ws.ts` — WsServer (sendToClient/sendToAll)

---

## 2. Flujo de Chat (Web Frontend)

```
Browser ──WS connect──▶ agent-frontend :8081
                              │
                              ▼
                   identify(userId) → userMap.set(clientId, userId)
                              │
                              ▼
                   user_message(chatId, text) → handleUserMessage()
                              │
                              ▼
                   runAgent() → runAgentCore() → LLM → tools
                              │
                              ▼
              sendToClient(clientId, "assistant_chunk", ...)
              sendToClient(clientId, "tool_call", ...)
              sendToClient(clientId, "tool_result", ...)
              sendToClient(clientId, "assistant_done", ...)
```

### Archivos clave
- `agent-frontend/` — React 19 + Vite 7
- `agent-engine/src/server/handlers.ts:687-748` — handleUserMessage
- `agent-engine/src/server/ws.ts` — WebSocket server

---

## 3. Flujo de Dashboard (Frontend Web)

```
Browser ──HTTP──▶ frontend :3016 (nginx)
                              │
                              ▼
                   React 19 + Vite 7
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
              API calls              Socket.IO
              (:3000)                (:3000)
                    │                    │
                    ▼                    ▼
              backend (Express)     backend (Socket.IO)
                    │                    │
                    ▼                    ▼
              Ollama API           Eventos en tiempo real
              :11434               (telemetría, modelos)
```

### Endpoints REST
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/models` | Listar modelos Ollama |
| POST | `/v1/chat/completions` | Chat streaming |
| POST | `/api/pull` | Descargar modelo |
| POST | `/api/unload` | Liberar VRAM |
| DELETE | `/api/models/:model` | Borrar modelo |
| GET | `/api/hardware/gpu` | Métricas GPU |
| GET | `/api/ngrok/status` | Estado túnel |
| GET | `/api/auth/status` | Estado auth |
| POST | `/api/settings` | Actualizar config |
| POST | `/api/auth/mcp/tools` | Registrar MCP tools |

### Archivos clave
- `frontend/` — React 19 + Vite 7
- `backend/src/main.ts` — Express server, SSE, Socket.IO
- `backend/src/routes/` — All route handlers
- `backend/src/use-cases/` — Business logic layer
- `backend/src/ollama/ollama.service.ts` — Ollama API client, GPU metrics

---

## 4. Flujo de Memoria (Brain)

```
agent-engine ──HTTP──▶ mcp-brain :3015
                              │
                    Authentication: X-API-Key header
                    (BRAIN_API_KEY env var, opcional)
                              │
                              ▼
                   Express Router (/api/*)
                              │
                    ┌─────────┴──────────────────┐
                    ▼                            ▼
              GET /api/memory/context       GET /api/memory/search
              (contexto reciente)           (búsqueda semántica)
                    │                            │
                    ▼                            ▼
              SQLite SELECT                  FTS5 + vectors
              ORDER BY createdAt DESC         cosine similarity
                    │                            │
                    ▼                            ▼
              JSON response                 JSON response
```

### Endpoints de Memoria
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/memory/context` | Contexto reciente de la sesión |
| GET | `/api/memory/search` | Búsqueda semántica/híbrida/lexical |
| GET | `/api/memory/timeline` | Timeline cronológico |
| GET | `/api/memory/stats` | Estadísticas |
| POST | `/api/memory` | Guardar memoria |
| GET | `/api/memory/:id` | Obtener por ID |
| PUT | `/api/memory/:id` | Actualizar |
| DELETE | `/api/memory/:id` | Eliminar |
| POST | `/api/memory/consolidate` | Consolidar memorias |
| GET | `/api/directives` | Directivas del proyecto |
| POST | `/api/projects/merge` | Merge de proyectos |
| GET | `/api/sessions` | Sesiones |
| POST | `/api/sessions` | Crear sesión |
| POST | `/api/templates/:id/render` | Renderizar template |

### Búsqueda Semántica
```
knowledge_search(query, limit, type)
              │
              ▼
brain.searchMemories(query, limit, typeFilter)
              │
              ▼
GET /api/memory/search?q=...&type=feature&mode=hybrid
              │
              ▼
mcp-brain:
  1. Embed query via Ollama /api/embed (qwen3.5:4b-12k)
  2. SELECT all memories WHERE project=? AND type=? AND vector IS NOT NULL
  3. Cosine similarity in JavaScript (O(N))
  4. FTS5 lexical search
  5. Merge & rank results
```

### Archivos clave
- `mcp-brain/src/server/api.ts` — Todos los endpoints REST
- `mcp-brain/src/middleware/auth.middleware.ts` — Auth brain
- `mcp-brain/src/services/memories/searchMemories.ts` — Search logic
- `mcp-brain/src/services/memories/getContext.ts` — Context query
- `mcp-brain/src/services/llm/embed.ts` — Embedding via Ollama
- `mcp-brain/src/database/schemas/memories.ts` — FTS5 schema & triggers
- `agent-engine/src/services/brain/client.ts` — Brain client SDK
- `agent-engine/src/services/tools/knowledge-search.ts` — Knowledge tool

---

## 5. Flujo de Tareas (Scheduler + Agent Runs)

```
               ┌─────────────────────┐
               │  schedule_task tool │
               │  (agent-engine)     │
               └──────────┬──────────┘
                          │
                          ▼
               createScheduledTask({name, cron, text, mode})
                          │
                          ▼
               SQLite: scheduled_tasks table
                          │
                          ▼
               Cron worker (cada 60s)
               checkScheduledTasks()
                          │
                          ▼
               Si cron matchea → runAgentCore()
                          │
                          ▼
               LLM + tools → notify_telegram / notify_frontend
```

### Creación de Tareas (sub-tareas del agente)
```
create_task tool (agent-engine)
              │
              ▼
runAgentCore()  ←── DIRECTAMENTE, sin BullMQ queue
(Llama al agente inline para procesar sub-tarea)
              │
              ▼
Resultado devuelto al agente original como string JSON
```

### Historial de Ejecuciones
```
Web dashboard ──WS──▶ new_task(text)
              │
              ▼
createRun(chatId, userText, origin) → runId
              │
              ▼
submitAgentRun({chatId, userText, origin, runId})
  ──▶ BullMQ queue (concurrency:1) ──▶ runAgentCore()
              │
              ▼
Result: SQLite runs table (status: queued→running→completed/failed)
```

### Archivos clave
- `agent-engine/src/services/tools/create-task.ts` — Sub-task creation
- `agent-engine/src/services/tools/schedule-task.ts` — Scheduled tasks
- `agent-engine/src/services/db/scheduled-tasks.ts` — CRUD scheduled tasks
- `agent-engine/src/services/db/runs.ts` — Run history
- `agent-engine/src/services/queue/runQueue.ts` — BullMQ worker (concurrency:1)

---

## 6. Flujo de Modos (Agent Personality)

```
switch_mode tool ──▶ setActiveMode(name)
                           │
                           ▼
                   applyModeTools(tools[])
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              Enable tools    Disable tools
              (registry)      (registry)
                           │
                           ▼
                   resetAllSessions()
                           │
                           ▼
              Broadcast WS: mode_changed
              (sendToAll)
                           │
                           ▼
              Upsert __general__ expert
              (model, system_prompt, temperature)
```

### Modos Disponibles
| Modo | Tools | Descripción |
|------|-------|-------------|
| `asistente` | 11 tools (chat, web, memoria, tareas, telegram) | Conversación general |
| `coach-personal` | 10 tools (chat, web, memoria, tareas) | Coaching personal |
| `investigador` | 12 tools (+web_search, read_url) | Investigación web |
| `evolutivo` | 13 tools (+write_file, edit_file, bash) | Desarrollo de código |

### Archivos clave
- `agent-engine/src/services/tools/switch-mode.ts` — Tool handler
- `agent-engine/src/services/tools/registry.ts` — applyModeTools
- `agent-engine/src/index.ts` — Mode definitions con XML prompts
- `agent-engine/src/server/handlers.ts:370-428` — WS mode handlers

---

## 7. Flujo MCP (Model Context Protocol)

### Servidor MCP en backend
```
IDE (Claude/RooCode) ──SSE──▶ backend :3000/sse
                                    │
                                    ▼
                           SSEServerTransport("/messages")
                           (Multi-cliente via Map<sessionId>)
                                    │
                                    ▼
                           MCP Server (ollama.tools)
                           - list_models, pull_model, generate
                           - chat (con tools parameter)
                           - unload_models, get_server_status
                           - delete_model
```

### Servidor MCP en mcp-brain
```
IDE ──SSE──▶ mcp-brain :3015/sse
                   │
                   ▼
          MCP Server (mcp.ts)
          - memory tools (save, search, recall)
          - directive tools
          - project management
```

### Auto-Sync MCP (dashboard → IDE)
```
Dashboard ──POST──▶ mcp-brain :3015/api/mcp/sync
                           │
                           ▼
                   Escribe archivos de configuración
                   DENTRO del contenedor Docker
                   (NO sincroniza con el host real)
```

### Archivos clave
- `backend/src/main.ts:183-220` — SSE endpoints (multi-client)
- `backend/src/ollama/ollama.tools.ts` — MCP tool handlers
- `backend/src/app.module.ts` — MCP tool registration
- `mcp-brain/src/server/mcp.ts` — MCP server (memory tools)
- `mcp-brain/src/server/api.ts:42-160` — Sync MCP endpoint

---

## 8. Flujo de WebSocket (Agent Frontend)

```
agent-frontend:8081 ──WS──▶ agent-engine:3021
                                  │
                                  ▼
                         WsServer (ws.ts)
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
              Eventos específicos           Eventos broadcast
              (sendToClient)               (sendToAll)
                    │                           │
                    ▼                           ▼
              - assistant_chunk            - mode_changed
              - tool_call                  - telegram_status
              - tool_result                - list_modes
              - assistant_done             - memory_changed
              - suggestions
              - list_chats
              - error
```

### Eventos WS

| Evento | Tipo | Descripción |
|--------|------|-------------|
| `user_message` | → | Mensaje del usuario al agente |
| `assistant_chunk` | ← | Streaming de respuesta (privado) |
| `tool_call` | ← | Tool invocada (privado) |
| `tool_result` | ← | Resultado de tool (privado) |
| `assistant_done` | ← | Respuesta completa (privado) |
| `suggestions` | ← | Sugerencias automáticas (privado) |
| `mode_changed` | ← | Cambio de modo (broadcast) |
| `telegram_status` | ← | Estado Telegram (broadcast) |
| `list_chats` | ← | Lista de chats (privado) |
| `list_modes` | ← | Lista de modos (broadcast) |
| `memory_changed` | ← | Memoria modificada (broadcast) |
| `cancel` | → | Cancelar ejecución |
| `identify` | → | Identificar usuario |
| `set_active_mode` | → | Cambiar modo activo |

---

## 9. Despliegue Docker

```
docker-compose.yml (version obsoleta eliminada)
───────────────
Servicios:
  ollama       → mcp-ollama-motor    :11434  (GPU passthrough config)
  redis        → agent-engine-redis  :6379
  backend      → backend             :3000
  mcp-brain    → brain               :3015
  agent-engine → agent-engine        :3020/3021
  frontend     → frontend            :3016
  agent-frontend → agent-frontend    :8081
  ngrok        → mcp-ngrok-tunnel    (túnel externo)

Red:
  mcp-network (bridge)

Volúmenes:
  ollama_data  → /root/.ollama
  ./data       → /app/data (SQLite compartido)

Política de reinicio:
  unless-stopped (todos los servicios)

Variables de entorno comunes:
  API_KEY       → Autenticación entre servicios
  BRAIN_URL     → http://brain:3015
  BACKEND_URL   → http://backend:3016
  OLLAMA_URL    → http://ollama:11434
```

### Archivos clave
- `docker-compose.yml` — Orquestación completa
- `backend/Dockerfile` — Single-stage (multi-stage pendiente)
- `agent-engine/Dockerfile` — Multi-stage con ffmpeg
- `mcp-brain/Dockerfile` — Single-stage (multi-stage pendiente)
- `frontend/Dockerfile` — Multi-stage con nginx
- `agent-frontend/Dockerfile` — Multi-stage con nginx

---

## 10. Autenticación y Seguridad

### Esquema de API Keys
```
                    API_KEY env var
                    ──────────────
                    Valor por defecto: McPOllama2026-V1-Home
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
     backend           mcp-brain       agent-engine
  (authMiddleware)   (brainAuthMiddleware) (authMiddleware)
          │                │                │
          ▼                ▼                ▼
   X-API-Key header   X-API-Key header   X-API-Key header
   (requerido)        (si configurado)   (requerido)
```

### Rate Limiting (backend)
- 15,000 requests per 15-minute window
- Bypass para IPs locales (127.x.x.x, ::1, ::ffff:127.x.x.x)
- Bypass para requests con API Key válida

### Seguridad WebSocket (agent-engine)
- Eventos de chat (chunks, tools, resultados) → **sendToClient** (privado por sesión)
- Eventos de sistema (modos, telegram, memoria) → **sendToAll** (broadcast)

### Archivos clave
- `backend/src/middleware/auth.middleware.ts` — Auth backend
- `backend/src/middleware/security.middleware.ts` — Security (IP ban)
- `backend/src/main.ts:59-72` — Rate limiter config
- `mcp-brain/src/middleware/auth.middleware.ts` — Auth brain
- `agent-engine/src/server/handlers.ts` — WS auth check

---

## 11. Matriz de Puertos

| Servicio | Puerto Interno | Puerto Externo | Protocolo | Docker Service |
|----------|---------------|----------------|-----------|----------------|
| backend | 3000 | 3016 | HTTP/REST + Socket.IO | `backend` |
| mcp-brain | 3015 | 3015 | HTTP/REST + MCP SSE | `mcp-brain` → `brain` |
| frontend | 80 | 3016 | HTTP (nginx) | `frontend` |
| agent-engine | 3020 | 3020 | HTTP/REST | `agent-engine` |
| agent-engine WS | 3021 | 3021 | WebSocket | `agent-engine` |
| agent-frontend | 80 | 8081 | HTTP (nginx) | `agent-frontend` |
| ollama | 11434 | 11434 | HTTP | `ollama` → `mcp-ollama-motor` |
| Redis | 6379 | 6379 | TCP | `redis` → `agent-engine-redis` |

---

## 12. Problemas Conocidos (Post-Auditoría)

| # | Problema | Estado | Impacto |
|---|----------|--------|---------|
| 1 | ~~`get_context` 404 por ruta `:id`~~ | ✅ FIXED | Memoria no disponible |
| 2 | ~~`sendToAll()` broadcast WS~~ | ✅ FIXED | Privacidad entre usuarios |
| 3 | ~~Brain sin auth~~ | ✅ FIXED | Seguridad de memorias |
| 4 | ~~`VITE_BRAIN_URL` en server~~ | ✅ FIXED | Brain URL incorrecta |
| 5 | ~~`restart: no`~~ | ✅ FIXED | Sin resiliencia |
| 6 | ~~`throw` en MCP tools~~ | ✅ FIXED | Crash potencial |
| 7 | ~~`tools` ignorado en chat MCP~~ | ✅ FIXED | Function calling roto |
| 8 | ~~FTS5 triggers por `id`~~ | ✅ FIXED | Scan secuencial |
| 9 | ~~Knowledge type filter~~ | ✅ FIXED | Filtro ineficaz |
| 10 | ~~SSE single transport~~ | ✅ FIXED | Multi-cliente roto |
| 11 | ~~Rate limiter IP check~~ | ✅ FIXED | Bypass potencial |
| 12 | GPU passthrough no funcional | ⏳ PENDIENTE | Solo swarm |
| 13 | `unloadModels()` endpoint | ✅ FIXED | `/api/generate` |
| 14 | `await` en pull model | ✅ FIXED | Respuesta engañosa |
| 15 | `@types/*` en prod deps | ✅ FIXED | Peso extra |
| 16 | Cosine similarity O(N) | ⏳ PENDIENTE | No escala |
| 17 | MCP sync en Docker | ⏳ PENDIENTE | No llega al host |
| 18 | Embedding model hardcodeado | ✅ PARCIAL | Fallback silencioso |
| 19 | `sessionCache` sin límite | ⏳ PENDIENTE | Memory leak |
| 20 | CORS abierto | ⏳ PENDIENTE | Seguridad |
