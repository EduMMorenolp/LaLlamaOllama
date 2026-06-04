# Agent Engine — Changelog

## [Unreleased]

### Añadido
- General config persistente (`__general__` expert): modelo, temperatura, límite de historial
- Endpoints REST `/api/runs`, `/api/runs/:id`, `/api/knowledge` (CRUD)
- Servicio `services/knowledge/index.ts` — chunking e indexación al Brain
- WS handlers `get_general_config` / `general_config_update`
- Campo `history_limit` en tabla `sub_agents` (migración automática)

### Cambiado
- `buildPrompt.ts` reducido de ~60 a 4 líneas (ahorro 500-1000+ tokens/request)
- Directives y context como mensajes system separados (trimeables independientemente)
- `temperature: 0.3` → `0.7` (más variación, menos patrones fijos)
- Eliminado `brain.getContext(10)` del primer mensaje (ahorro 200-800 tokens)
- Historial reducido de 20 a 10 mensajes (configurable)
- `runAgentCore.ts`: lee model/temperature/history_limit del `__general__` expert

### Corregido
- Chats ahora se crean con el userId real (no clientId volátil)
- Auto-creación de chat al recibir primer mensaje si no existe

## [0.5.0] — 2026-06-02

### Añadido
- Telegram Bot con 8 comandos y tags @AgentName
- Base de datos SQLite local (users, sub_agents, messages, chats, models)
- Sub-agentes con CRUD completo
- Protocolo WebSocket extendido (17 tipos de mensaje)
- Endpoints REST `/api/experts`, `/api/users`, `/api/models`, `/api/stats`

### Cambiado
- Refactor a Use Case Pattern + DI funcional
- Estructura services/ con capas (config, brain, agent, tools, sessions, execution)
- Capa server/ reemplazando gateway/
- runAgent() con callbacks onStatus, onTyping
- Persistencia automática a SQLite

## [0.4.0] — 2026-06-01

### Añadido
- Servicio standalone agent-engine/
- Agent loop multi-turno con OpenAI SDK
- 8 herramientas integradas (bash, read/write-file, glob, grep, read-url, delegate, memorize/recall/get-context)
- Gateway WebSocket + REST
- Integración con mcp-brain (BrainClient)
- Docker service en docker-compose.yml
