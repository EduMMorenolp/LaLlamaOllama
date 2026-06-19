# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto se adhiere al [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Added
- **🧠 `updateMemory.ts` — Upsert por type+userId** — Ahora crea o actualiza memoria según `type` + `userId` en lugar de insertar siempre duplicados
- **🧠 CRUD REST para memorias** — Nuevos endpoints: `GET /api/memory/:id` (obtener), `PUT /api/memory/:id` (actualizar), `GET /api/memory/timeline` (timeline cronológico)
- **➕ `POST /api/memory`** — Endpoint existente ahora accesible desde agent-engine proxy
- **➕ `offset` parameter** — Soportado en timeline, search y getContext para paginación

### Changed
- **🔧 `searchMemories.ts`** — Exportada como función pública; mejorada búsqueda semántica con FTS5 + embeddings
- **🔧 `getTimeline.ts`** — Ahora acepta `type` filter opcional y `offset` para paginación
- **🔧 `getContext.ts`** — Ahora acepta `offset` parameter
- **🔧 `searchMemories.ts`** — Ahora acepta `offset` parameter; semantic results usan slice

### Fixed
- **🐛 typo en cron** — `"lallamasollama"` → `"lallamaollama"` en `cron.ts`

## [2.0.0] - 2026-05-14

### Added
- **Capa 1 — Auditoría Transparente (Server-Side)**: Nueva tabla `mcp_audit_log` en SQLite que registra automáticamente CADA llamada a herramienta MCP. El agente NO puede optar por no participar — ocurre a nivel de servidor.
- **Capa 2 — Auto-generación de Memorias de Sesión**: Cada conexión y tool call genera entradas de auditoría automáticas.
- **Capa 3 — Compliance Reminder**: Las herramientas de solo lectura (`mem_search`, `mem_context`, `mem_timeline`, etc.) ahora verifican si el agente ha llamado a `mem_save` recientemente. Si no, incluyen un recordatorio normativo en la respuesta.
- **Capa 4 — Descripciones Imperativas**: El campo `agent` se inyecta automáticamente como obligatorio en TODAS las herramientas MCP, forzando a los agentes a identificarse.
- **Capa 5 — Nueva herramienta `mem_my_compliance`**: Los agentes pueden auto-auditarse consultando su score de compliance, último `mem_save`, y estadísticas de actividad.
- **Capa 6 — `BRAIN-AGENT-CONFIG.md`**: Guía de configuración para miembros del equipo con reglas obligatorias de compliance.
- **Nuevos servicios de auditoría**: `src/services/audit/` con `logToolCall()`, `getAgentCompliance()`, `getRecentToolCalls()`.
- **Nuevo schema SQLite**: `src/database/schemas/audit.ts` con tabla `mcp_audit_log` e índices por agente, timestamp, tool y proyecto.

### Changed
- **`src/server/mcp.ts`**: Refactorizado el handler `CallToolRequestSchema` para usar patrón de variable `response` en lugar de `return` directo, permitiendo post-procesamiento de auditoría y compliance.
- **`src/server/mcp.ts`**: El handler `ListToolsRequestSchema` ahora inyecta el campo `agent` en TODAS las herramientas y agrega `mem_my_compliance` al catálogo.
- **`src/services/index.ts`**: Exporta el nuevo módulo `audit`.
- **`src/database/schemas/index.ts`**: Ejecuta `createAuditTable()` durante la inicialización.

## [1.1.0] - 2026-05-14

### Added
- **Transporte SSE (Server-Sent Events)**: Nuevos endpoints `GET /sse` y `POST /messages` para comunicación remota vía HTTP SSE, permitiendo que agentes externos (OpenCode AI, Claude Desktop, etc.) se conecten al servidor MCP sin necesidad de stdio local.
- **Dual Transport**: El servidor MCP ahora soporta tanto `StdioServerTransport` (procesos locales) como `SSEServerTransport` (conexiones remotas HTTP), gracias a la refactorización de `createMcpServer()` como función independiente.
- **Endpoint `/mcp`**: Health-check para verificar accesibilidad remota.
- **Sincronización Multi-IDE mejorada**: Configuración diferenciada por tipo de cliente (`type: "remote"` para OpenCode AI, `type: "url"` para Claude Desktop/Antigravity/RooCode/Windsurf).
- **Soporte para Windsurf** como target de sincronización MCP.
- **Variable `HOST_IP`**: Nueva variable de entorno para configurar dinámicamente la URL del endpoint SSE.

### Changed
- **Sincronización MCP (`POST /api/mcp/sync`)**: Refactorizada para generar configuraciones SSE en lugar de comandos stdio locales.

### Fixed
- **`transport.handlePostMessage()`**: Ahora incluye `req.body` como tercer argumento para manejo correcto de mensajes MCP entrantes.

## [1.0.0] - 2026-05-13

### Added
- **MCP Brain Server** primera versión oficial e independiente (standalone).
- Arquitectura altamente modular basada en patrón de **Casos de Uso** e Inyección Funcional.
- Persistencia robusta en SQLite con una **WriteQueue** dedicada para garantizar soporte multi-agente en entornos de alta concurrencia.
- Sistema Híbrido de búsqueda: **Léxica** nativa (SQLite FTS5) + **Semántica** vectorizada (Embeddings vía Ollama).
- Detección Dinámica de Conflictos: Grafo relacional para solicitar juicios cuando las memorias colisionan (`mem_judge`).
- Soporte para claves evolutivas en el tiempo mediante `topic_key`.
- Captura de información contextual: `mem_save_prompt` para historial de usuario puro y `mem_capture_passive` para la ingesta silenciosa.
- **Delegación Cognitiva (Graceful Degradation):** Si el backend local LLM (Ollama) está desconectado, el servidor no falla abruptamente. En su lugar, instruye vía MCP al Agente LLM cliente para que asuma el procesamiento analítico (`mem_compare`, `mem_suggest_tags`).
- Servidores duales y aislados lógicamente: Protocolo MCP por Standard IO (`stdio`) y Servidor REST para dashboards vía Express API.
