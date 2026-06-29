# Arquitectura de LaLlamaOllama

## Visión general

LaLlamaOllama es un ecosistema de microservicios que orquesta LLMs locales con un agente de código autónomo, memoria persistente compartida y dashboards de administración.

```
                    ┌─────────────────────────────────────────────────┐
                    │                 Agent Frontend                   │
                    │         React 19 + Vite 7 · puerto 8081         │
                    │   Chat │ Agentes │ Tareas │ Conocimiento         │
                    │   Conexión │ Memoria                            │
                    └──────────────┬──────────────────────────────────┘
                                   │ WebSocket (ws://host:3021)
                    ┌──────────────▼──────────────────────────────────┐
                    │              Agent Engine                       │
                    │         Express 4 + TypeScript · puerto 3020    │
                    │  ┌──────────┐ ┌───────────┐ ┌───────────────┐  │
                    │  │ Chat WS  │ │ REST API  │ │ Tool Registry │  │
                    │  │ handlers │ │ /api/*    │ │ (37+ tools)   │  │
                    │  └──────────┘ └───────────┘ └───────────────┘  │
                    │  ┌──────────┐ ┌───────────┐ ┌───────────────┐  │
                    │  │ DB Layer │ │ Brain     │ │ Telegram Bot  │  │
                    │  │ SQLite   │ │ Client    │ │ (opcional)    │  │
                    │  └──────────┘ └───────────┘ └───────────────┘  │
                    └──────┬──────────────┬──────────────────────────┘
                           │ HTTP         │ HTTP
                           │ (directo)    │
                    ┌──────▼──────┐ ┌─────▼─────────────────────────┐
                    │   Ollama    │ │         MCP Brain              │
                    │ puerto 11434│ │ Express + SQLite FTS5          │
                    │ LLM Runtime │ │ puerto 3015                    │
                    └─────────────┘ │ Memoria persistente            │
                                    │ Búsqueda FTS5                  │
                                    │ Directivas de proyecto         │
                                    └──────┬─────────────────────────┘
                                           │ HTTP
                                    ┌──────▼─────────────────────────┐
                                    │        Brain Frontend           │
                                    │  React 19 + Vite 7 · puerto 8082│
                                    │  Memories │ Stats │ Search      │
                                    └─────────────────────────────────┘
```

> **Nota:** El servicio `backend` (Express, puerto 3000) permanece como proxy histórico para el dashboard administrativo (frontend 8080), pero agent-engine ya no depende de él. La conexión agent-engine → Ollama es directa.

---

## Diagrama de flujo de datos

### Chat → Agent Engine → LLM

```
Usuario → Agent Frontend (WebSocket)
  → Agent Engine (WS handler)
    → runAgentCore (session + tools)
      → Ollama nativo /api/chat (directo, sin backend)
        → Tool calls (bash, grep, read_file, etc.)
        → Respuesta streaming
  ← Agent Frontend (assistant_chunk + assistant_done)
```

### Conocimiento → MCP Brain

```
Usuario → Agent Frontend (Knowledge tab)
  → Agent Engine REST API POST /api/knowledge
    → Chunking (párrafos)
    → MCP Brain REST POST /api/memory (save)
  ← Confirmación
```

### Brain Frontend → MCP Brain

```
Usuario → Brain Frontend (HTTP)
  → MCP Brain REST API
    → [Memories] GET /api/memory (listar, filtrar, stats)
    → [Search] GET /api/memory/search?q=... (full-text)
    → [CRUD] POST/PUT/DELETE /api/memory/:id
  ← Brain Frontend (resultados renderizados)
```

---

## Tabla de servicios

| Servicio | Puerto | Lenguaje | Base de datos | Propósito |
|----------|--------|----------|---------------|-----------|
| `agent-frontend` | 8081 | React 19 + Vite 7 | - | Dashboard del agente |
| `frontend` | 8080 | React 19 + Vite 7 | - | Dashboard admin |
| `agent-engine` | 3020 | Express 4 + TS | SQLite (local) | Agente autónomo (37+ tools) |
| `brain-frontend` | 8082 | React 19 + Vite 7 | - | UI standalone de memoria MCP |
| `backend` | 3000 | Express 4 + TS | - | Proxy histórico + seguridad |
| `mcp-brain` | 3015 | Express 4 + TS | SQLite FTS5 | Memoria persistente compartida |
| `ollama` | 11434 | Go (Ollama) | - | Runtime de LLMs |
| `redis` | 6379 | Redis 7 Alpine | - | Cola BullMQ para agent-engine |
| `ngrok` | - | Go (ngrok) | - | Túnel opcional |

> **Nota v3:** Agent-engine ahora se conecta directamente a Ollama (no via backend).  
> MCP Brain es independiente: no requiere Ollama ni backend para funcionar.  
> Brain Frontend es un nuevo servicio standalone que se conecta directamente a MCP Brain.

---

## Modelo de datos

### agent-engine (SQLite local)

```
users (userId, name, timezone, telegram_user, telegram_id, telegram_token, preferences, persona, interests, etc.)
sub_agents (name, model, system_prompt, tools[], experts[], temperature, history_limit)
chats (id, userId, title, origin, expertName, pinned, created_at, updated_at)
messages (id, userId, chatId, role, content, origin, expertName, created_at)
runs (id, chatId, userText, origin, status, priority, tags, due_date, description, scheduled_at, created_at)
run_events (id, runId, type, payload, created_at)
models (name, displayName, apiKey, baseUrl)
agent_modes (name, label, system_prompt, tools[], model, temperature, history_limit, tool_policy, extends)
custom_tools (name, description, parameters, handler_type, handler_config, enabled)
settings (key, value)
scheduled_tasks (name, cron_expression, task_text, mode_id, enabled, last_run_at, next_run_at)
workspace_context (userId, project, lastFile, lastDir, openFiles, tags)
message_feedback (id, userId, chatId, messageId, rating, reason, created_at)
saved_messages (id, userId, chatId, messageId, created_at)
skills (id, name, description, procedure, category, tags, usage_count, created_at, updated_at)
```

### mcp-brain (SQLite FTS5)

```
memories (id, project, type, title, content, tags, topic_key, agent, session_id, phase, created_at, updated_at)
memories_fts (id, title, content, tags) — virtual table FTS5
core_directives (project, content, created_at, updated_at)
sessions (id, project, name, summary, created_at, updated_at)
mcp_audit_log (id, type, agent, tool_name, args, result_preview, snapshot, created_at)
```

---

## Protocolo de comunicación

### WebSocket (Agent Engine ↔ Frontend)

Formato de mensaje:

```json
{ "type": "message_type", "payload": { ... } }
```

**Tipos principales:**

| Tipo | Dirección | Propósito |
|------|-----------|-----------|
| `identify` | → | Identificar usuario |
| `user_message` | → | Enviar mensaje al agente |
| `cancel` | → | Cancelar respuesta en curso |
| `assistant_chunk` | ← | Streaming de tokens |
| `assistant_done` | ← | Respuesta completa (con `usage`) |
| `tool_call` / `tool_result` | ← | Ejecución de herramientas |
| `list_chats` / `chat_update` | ↔ | Gestión de chats |
| `get_general_config` / `general_config_update` | ↔ | Configuración persistente |
| `get_status` / `status` | ↔ | Estado del engine |
| `new_task` / `task_created` / `task_status` | ↔ | Gestión de tareas |

### REST API

**Agent Engine** (`/api/*`):
- `GET /api/health` — Health check
- `GET /api/tools` — Listar herramientas registradas
- `GET /api/runs` — Historial de ejecuciones
- `POST /api/knowledge` — Subir archivo a conocimiento
- `GET /api/knowledge` — Listar documentos indexados

**Backend** (`/api/*`):
- OpenAI compatibles: `/v1/models`, `/v1/chat/completions`
- Estado: `/api/status`, `/api/status/fast`, `/api/status/full`
- Modelos: CRUD `/api/models/*`
- Seguridad: `/api/auth/*`, `/api/ban`, `/api/unban`
- Ngrok: `/api/ngrok/*`
- Hardware: `/api/hardware/*`
- MCP: `/sse`, `/messages`

**MCP Brain** (`/api/*`):
- Memorias: CRUD `/api/memory/*`, búsqueda `/api/memory/search`
- Directivas: `/api/settings/core_directives`
- Sesiones: `/api/sessions/*`
- Proyectos: `/api/projects/merge`, `/api/projects/ensure`
- MCP Sync: `/api/mcp/sync`
- Health: `/api/health`

**Brain Frontend** (conecta directamente a MCP Brain):
- `GET /api/memory` — Listar memorias con filtros
- `GET /api/memory/search?q=...&mode=lexical` — Búsqueda full-text
- `GET /api/memory/stats` — Estadísticas por tipo
- `POST /api/memory` — Crear memoria
- `PUT /api/memory/:id` — Actualizar memoria
- `DELETE /api/memory/:id` — Eliminar memoria

---

## Seguridad

- API Key obligatoria en backend y agent-engine
- Rate limiting (5000 req/15min)
- Blacklist de IPs con auto-ban tras 5 intentos fallidos
- Headers de seguridad vía Helmet
- Validación de tokens en WebSocket

---

## Despliegue

Ver [INSTALL.md](./INSTALL.md) para instrucciones detalladas de instalación y configuración.
