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
                    │  │ handlers │ │ /api/*    │ │ (8 tools)     │  │
                    │  └──────────┘ └───────────┘ └───────────────┘  │
                    │  ┌──────────┐ ┌───────────┐ ┌───────────────┐  │
                    │  │ DB Layer │ │ Brain     │ │ Telegram Bot  │  │
                    │  │ SQLite   │ │ Client    │ │ (opcional)    │  │
                    │  └──────────┘ └───────────┘ └───────────────┘  │
                    └──────┬──────────────┬──────────────────────────┘
                           │ HTTP/SSE     │ HTTP
                    ┌──────▼──────┐ ┌─────▼─────────────────────────┐
                    │   Backend   │ │         MCP Brain              │
                    │ Express+MCP │ │ Express + SQLite FTS5 + Embed  │
                    │ puerto 3016 │ │ puerto 3015                    │
                    │ Ollama proxy│ │ Memoria persistente            │
                    │ Seguridad   │ │ Búsqueda semántica/lexical     │
                    │ Ngrok ctrl  │ │ Directivas de proyecto         │
                    └──────┬──────┘ │ Consolidación automática       │
                           │        │ Sincronización multi-IDE      │
                    ┌──────▼──────┐ └────────────────────────────────┘
                    │   Ollama    │
                    │ puerto 11434│
                    │ LLM Runtime│
                    └─────────────┘
```

---

## Diagrama de flujo de datos

### Chat → Agent Engine → LLM

```
Usuario → Agent Frontend (WebSocket)
  → Agent Engine (WS handler)
    → runAgentCore (session + tools)
      → OpenAI SDK → Ollama / OpenAI / OpenRouter
        → Tool calls (bash, grep, read_file, etc.)
        → Respuesta streaming
  ← Agent Frontend (assistant_chunk + assistant_done)
```

### Conocimiento → MCP Brain

```
Usuario → Agent Frontend (Knowledge tab)
  → Agent Engine REST API POST /api/knowledge
    → Chunking (párrafos)
    → MCP Brain REST POST /api/memory (embed + save)
  ← Confirmación
```

### Memoria → Búsqueda

```
Usuario → Agent Frontend (Memoria tab)
  → MCP Brain REST GET /api/memory/search?q=...&mode=semantic
    → SQLite FTS5 (lexical) + Embeddings (semantic)
    → Resultados rankeados
  ← Agent Frontend (resultados + stats)
```

---

## Tabla de servicios

| Servicio | Puerto | Lenguaje | Base de datos | Propósito |
|----------|--------|----------|---------------|-----------|
| `agent-frontend` | 8081 | React 19 + Vite 7 | - | Dashboard del agente |
| `frontend` | 8080 | React 19 + Vite 7 | - | Dashboard admin |
| `agent-engine` | 3020 | Express 4 + TS | SQLite (local) | Agente de código autónomo |
| `backend` | 3016 | Express 4 + TS | SQLite (mcp-brain) | Proxy Ollama + MCP + seguridad |
| `mcp-brain` | 3015 | Express 4 + TS | SQLite FTS5 | Memoria persistente compartida |
| `ollama` | 11434 | Go (Ollama) | - | Runtime de LLMs |
| `ngrok` | - | Go (ngrok) | - | Túnel opcional |

---

## Modelo de datos

### agent-engine (SQLite local)

```
users (userId, name, timezone, telegram_user, telegram_id, telegram_token, preferences)
sub_agents (name, model, system_prompt, tools[], experts[], temperature, history_limit)
chats (id, userId, title, origin, expertName, pinned, created_at, updated_at)
messages (id, userId, chatId, role, content, origin, expertName, created_at)
runs (id, chatId, userText, origin, status, model, resultText, errorText, latencyMs, created_at)
run_events (id, runId, type, payload, created_at)
models (name, displayName, apiKey, baseUrl)
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
