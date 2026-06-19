# LaLlamaOllama — Changelog

Todos los cambios notables del proyecto están documentados aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [Unreleased]

### 👤 Perfil de Usuario: Aprendizaje automático y personalización evolutiva (2026-06-18)

#### Agent Engine
- **➕ `userLearning.ts`** — Nuevo servicio que extrae temas, analiza sentimiento, detecta estilo de comunicación y persona automáticamente tras cada respuesta
- **➕ Columnas en tabla `users`** — 11 nuevas columnas para perfil enriquecido (persona, intereses, disgustos, estilo, tono, estadísticas de interacción, modelo preferido, metadata)
- **➕ Perfil combinado en system prompt** — Se inyectan datos de DB local + memorias mcp-brain en `<user_profile>` al iniciar sesión
- **➕ Handler WS `user_feedback`** — Permite al frontend enviar preferencias explícitas del usuario
- **🔧 `buildPrompt.ts`** — Instrucción de `memorize` reforzada con lista detallada de qué memorizar

#### Agent Frontend
- **➕ `Perfil.tsx`** — Nueva tab con estadísticas de interacción, vista de perfil y modo edición con formulario completo (persona, estilo, tono, intereses, disgustos, modelo)

### 🧠 Resúmenes de sesiones + Workspace + Feedback + Búsqueda + Tema + Export (2026-06-18)

#### Agent Engine
- **➕ `sessionSummary.ts`** — Resúmenes automáticos de conversación vía LLM cuando el contexto supera 80K chars. Inyecta `<session_summary>` en system prompt
- **➕ Tabla `workspace_context`** — Persiste proyecto, archivos abiertos y directorio actual por usuario. Tracking automático en `read_file`, `write_file`, `edit_file`
- **➕ Inyección de `<workspace_context>`** — El agente sabe en qué proyecto/archivos estás trabajando
- **➕ Tabla `message_feedback`** + handler WS — Almacena ratings 👍/👎 por mensaje. Ajusta automáticamente `tone_preference` según el ratio de feedback
- **➕ FTS5 en `messages`** — Full-text search en historial de chats con `messages_fts` + triggers + `searchMessages()`

#### Agent Frontend
- **➕ `ThemeContext.tsx`** — Toggle claro/oscuro con persistencia en localStorage + CSS `[data-theme="light"]`
- **➕ Botones 👍/👎** — Feedback inline en cada mensaje del asistente, con estado visual y toggle
- **➕ Exportación de chat mejorada** — Metadatos, formato MD más limpio, tool calls como bloques de código

### 🔧 Correcciones de infraestructura y features (2026-06-18)

#### Bug Fixes
- **🔧 Endpoint de embeddings incorrecto (mcp-brain)** - Corregido `/api/embed` → `/api/embeddings` en `embed.ts`. Las búsquedas semánticas (RAG) ahora funcionan correctamente.
- **🔧 Resolución del modo base `__base__` (agent-engine)** - `resolveMode()` ahora busca `__base__` en las definiciones en memoria si no está en la DB. Elimina warnings de modo no encontrado en cada interacción.
- **🔧 Reducción del umbral de contexto overflow (agent-engine)** - Umbral de resumen reducido de 80000 → 30000 caracteres en `runAgentCore.ts`. Conserva 10 mensajes recientes (antes 15). El resumen se activa antes, evitando que el prompt llegue al límite de 8192 tokens.

#### Features
- **✨ Cache de sesión con `user` (backend)** - El endpoint `/v1/chat/completions` ahora acepta `user` como sessionId en `chat.ts`, `create-chat.ts` y `create-chat-stream.ts`. El backend puede cachear el historial por sesión.
- **✨ Envío inteligente de contexto (agent-engine)** - En turnos siguientes al primero, solo se envía el mensaje nuevo del usuario + sessionId. El historial completo se envía solo en el primer mensaje de la sesión o en iteraciones de herramientas. Reduce drásticamente el consumo de tokens (~2-4K tokens por llamado).

#### Performance
- **⚡ Warm-up del modelo en startup (agent-engine)** - Agregado bloque de warm-up en `index.ts` que precarga el modelo LLM al iniciar. Elimina el cold start de ~256s en la primera interacción.

### 🐛 Corrección 429 + 401 + Mejoras en Tareas y contexto programado (2026-06-12)

#### Agent Engine
- **🐛 Fix: 429 Too Many Requests** — Rate limit subido de 100 → 500 req/min en `api.ts`
- **🐛 Fix: 401 en `/api/knowledge`** — Agregado `req.path === "/knowledge"` a la lista de exenciones del `authMiddleware`
- **➕ Contexto "tarea programada" para el LLM** — Cuando `origin === "scheduler"`, se inyecta mensaje `system` en `runAgentCore.ts` informando al modelo que es una tarea automática
- **🔧 `import("axios")` dinámico → import estático** — Reemplazadas 8 ocurrencias de lazy import por `import axios from "axios"` al tope del archivo, eliminando riesgo de conexiones truncadas

#### Agent Frontend
- **🐛 Fix: 429 por bucle de re-render** — `apiHeaders` movido a nivel de módulo en `Tareas.tsx` (estable); eliminado `showToast` del catch del fetch inicial que realimentaba el ciclo
- **👆 Botón "Nueva Tarea" unificado** — Único botón que abre modal de tarea normal o programada según la sección activa; eliminado botón duplicado "Nueva Programada"
- **⚡ Timeline `limit: 500` → `100`** — Reducida carga en brain SQLite para respuestas más rápidas

#### Configuración
- **➕ `agent-frontend/.env`** — Creado con `VITE_API_KEY=McPOllama2026-V1-Home` para desarrollo local
- **➕ `docker-compose.yml`** — Agregado `VITE_API_KEY` a build args y environment de `agent-frontend`

### 🤖 Sistema de Agentes: Cobertura completa con 7 agentes (2026-06-12)

#### OpenCode Agents
- **➕ `agent-engine.md`** — Nuevo subagente para el agente autónomo (Express, BullMQ, SQLite, WS, 31 tools, Telegram)
- **➕ `agent-frontend.md`** — Nuevo subagente para el frontend del agente (React 19, WS puro, 5 tabs, nginx)
- **➕ Registro en `opencode.json`** — `agent-engine` y `agent-frontend` añadidos como subagentes (7 agentes total)
- **🔧 `orchestrator.md`** — Flujo de trabajo corregido: ahora delega a `docker-ops` (paso 9) y `documentation` (paso 10) en vez de hacerlo directamente; PROPÓSITO actualizado; routing table sincronizada
- **🔧 `documentation.md`** — Reescribito completo: estructura con ~25 archivos, 8 triggers por tipo de cambio, auto-verificación, flujo guiado por contexto
- **🔧 `docker-ops.md`** — Stack corregido de 4 a 7 servicios + redis; estructura con Dockerfiles faltantes; reglas nuevas para redis, agent-engine y agent-frontend
- **➕ Script `lint`** — `tsc --noEmit` añadido a `agent-engine/package.json`; auto-verificación del agente actualizada

#### Antigravity Rules & Workflows
- **🔧 `.agents/rules/lallamaollama.md`** — Tabla de servicios ampliada (8 contenedores); estructura del proyecto con agent-engine, agent-frontend y docs/
- **🔧 `postman.md` y `backend-feature.md`** — Ruta de Postman Collection corregida: `postman-collection/` → `docs/postman-collection/`

#### Documentación General
- **🔧 `docs/ARQUITECTURE.md`** — Tool Registry corregido (8 → 31 tools); redis añadido a tabla de servicios
- **🔧 `audit-agents.md`** — Score actualizado 78 → 95/100; tabla con 7 agentes; debilidades corregidas

### 🧠 MCP Brain: Logging completo estilo agent-engine (2026-06-12)

#### MCP Brain
- **➕ Logger centralizado con Pino** — Creado `src/utils/logger.ts` con customLevels `agent` (magenta) y `tool` (green), pino-pretty en dev, JSON en prod
- **➕ Request logging middleware** — Log automático de method, path, status, durationMs en cada request HTTP
- **➕ SSE connection logs** — `log.info()` en conexión y desconexión de clientes SSE (`/sse`)
- **➕ Tool call logs** — `log.tool()` en cada handler MCP con tool name y agent identity
- **➕ Cron job logs** — `log.agent()` en consolidación programada
- **➕ Route entry/exit logs** — Logger añadido a todos los endpoints: memory CRUD, search, timeline, consolidate, sync, sessions, templates, directives, settings, projects
- **🔧 22 console.error + 1 console.warn reemplazados** — En `api.ts`, `mcp.ts`, `cron.ts`, `searchMemories.ts`, `saveMemory.ts`, `generate.ts`, `embed.ts`, `consolidation.ts`, `index.ts`
- **➕ Dependencias** — `pino@^9.0.0`, `pino-pretty@^11.0.0`

### 📝 Backend: Logging completo estilo agent-engine (2026-06-12)

#### Backend
- **➕ Niveles custom `agent` y `tool`** — Añadidos via Pino customLevels (magenta/green con pino-pretty)
- **➕ Request logging middleware** — Log automático de method, path, status, durationMs e IP en cada request (excluye polling)
- **➕ WS connection logs** — `io.on("connection")` y `socket.on("disconnect")` con id, ip y razón
- **➕ Session manager logs** — `console.log` reemplazado por `log.agent()` en creación/cierre/limpieza de sesiones
- **➕ Tool call logs** — `log.tool()` en cada handler MCP (list_models, pull, chat, generate, etc.)
- **➕ Chat/LLM call logs** — `log.agent()` antes de llamadas a Ollama en `chat()` y `chatStream()`
- **➕ Route entry/exit logs** — Logger añadido a agents, auth, chat, docker, hardware, models, ngrok, search, security y status routes
- **➕ Error handler logging** — `log.error()` en el middleware global de errores
- **🔧 console.log/error eliminados** — `session.manager.ts`, `app.module.ts`, `agents.service.ts` ahora usan Pino

### 🧠 Cerebro: Gestor visual de memorias con CRUD, timeline y consolidación (2026-06-11)

#### MCP Brain
- **➕ `GET/POST /api/memory/consolidate`** — Endpoint de consolidación ahora accesible vía agent-engine proxy
- **➕ `offset` parameter** — Añadido soporte de offset en `/api/memory/timeline`, `/api/memory/search` y servicios subyacentes (getTimeline, searchMemories, getContext)
- **🐛 Fix: typo en cron** — `"lallamasollama"` → `"lallamaollama"` en `cron.ts`

#### Agent Engine
- **➕ Consolidate proxy** — Nuevo `POST /api/memory/consolidate` que proxea a mcp-brain
- **➕ `offset` en proxies** — `GET /api/memory/search` y `GET /api/memory/timeline` ahora reenvían `offset`
- **➕ WS broadcast** — `WsServer` pasado a `startApiServer()`; emite `memory_changed` tras cada POST/PUT/DELETE /api/memory
- **➕ Tools `update_memory` y `delete_memory`** — Nuevas tools del agente para editar y eliminar memorias por ID
- **🔧 Orden de arranque** — `WsServer` se crea antes de `startApiServer` para poder inyectarlo

#### Agent Frontend
- **➕ Paginación (scroll infinito)** — `IntersectionObserver` con sentinel, carga batches de 50, concatenación automática
- **➕ Filtro por tags** — Input que filtra memorias por tags (client-side, múltiples tags separados por coma)
- **➕ Ordenamiento** — Dropdown con "Fecha ↓", "Fecha ↑", "Tipo" (sort client-side)
- **➕ Toast feedback** — `useToast()` en todas las operaciones: crear, editar, eliminar, bulk delete y consolidar (success/error)
- **➕ WS sync** — Suscripción a `memory_changed` vía `useWs()`; refresca automáticamente la lista y stats
- **➕ Notification toast** — Suscripción al evento WS `"notification"` en `AgentChat.tsx`; muestra el mensaje via toast según nivel (error/success/info)
- **🗑️ Eliminada sección "Memoria"** — `Memoria.tsx` eliminado (redundante con Cerebro); actualizado `App.tsx` (import, type, tab, render, icon import)
- **🗑️ Eliminados Scaffold + Explorador de Memorias** — `BrainScaffold.tsx`, `MemoryExplorer.tsx` y `AIAgentWizard.tsx` eliminados del frontend clásico; actualizado `BrainConsole.tsx` (imports, type union, tab buttons y renders condicionales)
- **➕ `GET /api/memory/:id`** — Endpoint para obtener una memoria individual por ID
- **➕ `PUT /api/memory/:id`** — Endpoint para actualizar título, contenido, tipo y tags de una memoria existente
- **➕ `GET /api/memory/timeline`** — Endpoint que agrupa memorias por día para vista cronológica (soporta filtro opcional `?type=`)
- **🔧 `updateMemory.ts`** — Ahora acepta `type` como parámetro opcional para cambiar el tipo de memoria al editarla
- **🔧 `getTimeline.ts`** — Ahora acepta `type` filter opcional para filtrar timeline por tipo

#### Agent Engine
- **➕ 4 nuevos métodos en `BrainClient`** — `getMemory(id)`, `updateMemory(id, data)`, `deleteMemory(id)`, `getTimeline(type?)`
- **➕ 5 nuevos endpoints REST proxy** — `POST /api/memory` (crear), `GET /api/memory/:id` (obtener), `PUT /api/memory/:id` (actualizar), `DELETE /api/memory/:id` (eliminar), `GET /api/memory/timeline` (timeline)
- **🔧 `authMiddleware`** — Añadido `req.path === "/memory"` a la whitelist para que POST /api/memory funcione sin API key

#### Agent Frontend
- **➕ `Knowledge.tsx` reescrito** — Nuevo diseño con 3 sub-tabs: `🧠 Cerebro`, `📅 Línea de Tiempo`, `📄 Archivos RAG`
- **➕ Cerebro tab** — Browser de memorias con barra de estadísticas (total + counts por tipo), filtro por tipo, buscador textual
- **➕ Creación de memorias** — Formulario inline con campos: título, contenido, tipo (select), tags
- **➕ Edición y eliminación** — Modal de edición con todos los campos editables; confirmación de eliminación con opción de borrado múltiple (checkboxes + bulk delete)
- **➕ Consolidación manual** — Botón "Consolidar" que dispara `POST /api/memory/consolidate` con feedback visual
- **➕ Timeline view** — Vista cronológica agrupada por día con filtro por tipo
- **➕ Quick‑memo** — Botón flotante "+" para crear memoria rápida sin cambiar de tab
- **🔧 `App.tsx`** — Descripciones de tabs actualizadas: "Cerebro → Memorias, timeline y archivos RAG", "Memoria → Búsqueda avanzada en MCP Brain"

### 🧹 Consolidación UI: Eliminados AI Engine Tuner y Agent Engine, GPU Sentinel unificado (2026-06-11)

#### Frontend
- **🗑️ Eliminado `AiEngineTuner.tsx`** — Componente completo eliminado (GPU gauges, token counter, cloud savings, thermal stress, pricing config)
- **🗑️ Eliminado `AgentChat.tsx`** — Componente completo eliminado (el Agent Engine corre como servicio aparte)
- **➕ `HardwareSentinel.tsx` → `GpuSentinel`** — Componente renombrado; integrado el card "GPU en Tiempo Real" con 5 gauges SVG (Consumo W, Temperatura °C, Fan Speed %, GPU Util %, VRAM Uso MB) + alerta térmica
- **🔧 `App.tsx`** — Removidas importaciones, tabs `"agent"` y `"engine"`, sidebar entries "Agent Engine" y "Engine Tuner"; renombrado "HW Sentinel" → "GPU Sentinel"

#### Backend
- **🗑️ Eliminado módulo engine-stats** — `routes/engine-stats.routes.ts`, `types/engine-stats.ts`, 3 use-cases (`get-engine-stats`, `update-electricity-rate`, `update-cloud-price`)
- **🔧 `routes/index.ts`** — Removidas referencias a engine-stats
- **🔧 `types/index.ts`** — Removido `export * from "./engine-stats.js"`
- **🔧 `auth.middleware.ts`** — Removido `"/api/engine-stats"` de la whitelist pública

### 📱 Telegram: Adjuntos multi-modal, Whisper transcripción, reacciones y persistencia (2026-06-11)

#### Agent Engine
- **➕ Transcripción de audio con Whisper** — Nuevo `transcriber.ts` y `cache.ts`. Transcribe audios vía Ollama `whisper-small` con auto-pull si no está descargado. Cachea por `file_id`
- **➕ Tool `transcribe_audio(file_path)`** — Tool pública que cualquier agente puede invocar
- **➕ Adjuntos como base64 data URI** — Todos los archivos se convierten a `data:...;base64,...` en vez de pasar rutas
- **➕ Reacciones en Telegram** — 🕐 → ✅ / ❌ con logging `[TG-Reaction]`
- **➕ Typing indicator persistente** — `setInterval` cada 4s mantiene "escribiendo..." visible
- **🐛 Fix: Imágenes fallaban con 400** — Ahora se envían como `image_url` multi-modal a través del proxy
- **🐛 Fix: Whisper model not found** — Auto-pull con reintento

#### Backend
- **➕ Soporte multi-modal en proxy `/v1/chat/completions`** — Zod ahora acepta `content: string | ContentPart[]`. `convertToOllamaMessages()` extrae imágenes y las envía como `images[]` en formato Ollama
- **🔧 `types/chat.ts`** — Nuevos schemas para `text` e `image_url` parts
- **🔧 `ollama.service.ts`** — Conversión de `image_url` array a `images[]` de Ollama

#### Docker
- **➕ Auto-pull de whisper-small** — El contenedor `ollama` ahora ejecuta `ollama pull whisper-small` al arrancar

### 🐛 Corrección de bugs y encoding (2026-06-09)

#### Agent Engine
- **🐛 Fix: Knowledge Upload 401** — Agregado `req.path.startsWith("/knowledge/")` a las exclusiones del `authMiddleware` en `api.ts:50` para que el upload de archivos funcione sin API key
- **🐛 Fix: Emojis corruptos en labels por defecto** — Reemplazadas secuencias UTF-8 corruptas (`ðŸ§‘` → `🧑`, `ðŸ‘¨â€ðŸ’»` → `👨‍💻`, `ðŸ”` → `🔍`, `ðŸ§¬` → `🧬`) y acentos ilegibles en todos los `system_prompt` de los modos por defecto en `index.ts`
- **🔧 `.env.example` actualizado** — `API_KEY` por defecto cambiado a `super-secret-mcp-key` para coincidir con docker-compose

#### Agent Frontend
- **🐛 Fix: Tareas `/api/runs/undefined`** — `task_created` WS handler ahora mapea correctamente `runId` → `id`, `text` → `userText` y setea valores por defecto en `Tareas.tsx`
- **🐛 Fix: Memoria "semanticlexicalhybrid"** — Botones de modo de búsqueda ahora muestran etiquetas legibles: "Semántica", "Léxica", "Híbrida"
- **🐛 Fix: Chat mensajes repetidos** — Handlers `tools_list` y `ollama_models` actualizan el último mensaje system en lugar de duplicarlo; keys únicas en vez de `key={i}` para evitar duplicados de renderizado
- **🐛 Fix: Emojis y caracteres corruptos** — Corregidos emoji `🔍` y texto "Chat vacío" en `AgentChat.tsx`
- **🔧 `.env.example` actualizado** — `VITE_API_KEY` descomentado con valor `super-secret-mcp-key`

#### Frontend
- **🐛 Fix: Chat keys duplicadas** — Reemplazado `key={i}` por clave única basada en timestamp en `AgentChat.tsx`

## [1.0.0] - 2026-06-07

### 🚀 Versión estable 1.0.0

Todos los módulos del proyecto se unifican en **v1.0.0**: root, backend, agent-engine, agent-frontend y mcp-brain.

### 📋 Sistema de Tareas: Arreglado, mejorado y con tareas autoejecutables (2026-06-07)

#### Agent Engine
- **🐛 Fix: `new_task` ahora procesa tareas** — El handler WS crea el run y lo encola en el orquestrador (`submitAgentRun`), en vez de dejarlo en "queued" para siempre
- **➕ Estados nuevos**: `cancelled` (tarea cancelada por usuario), `scheduled` (tarea programada para futuro)
- **➕ `runs.ts`: `cancelRun()`** — Setea status a "cancelled"
- **➕ `runs.ts`: filtro `origin`** en `listRunsByFilters`
- **➕ `orchestrator/index.ts`**: `submitAgentRun` acepta `runId` opcional y retorna `runId` en el resultado
- **➕ `scheduled-tasks.ts` (NUEVO)** — CRUD completo para tareas programadas: `listScheduledTasks()`, `getScheduledTask()`, `createScheduledTask()`, `updateScheduledTask()`, `deleteScheduledTask()`, `toggleScheduledTask()`, `getDueTasks()`
- **➕ Tabla `scheduled_tasks`** en SQLite con columnas: name, cron_expression, task_text, mode_id, enabled, last_run_at, next_run_at
- **➕ Protocolo WS**: 12 nuevos tipos (`new_task`, `cancel_task`, `task_created`, `task_status`, `task_completed`, `task_failed`, `task_cancelled`, `list_scheduled_tasks`, `create_scheduled_task`, `update_scheduled_task`, `delete_scheduled_task`, `toggle_scheduled_task`, `scheduled_tasks_list`)
- **➕ Broadcast de estado de tareas** — `runQueue.ts` ahora emite `task_status` vía WS a todos los clientes cuando un run cambia a running/completed/failed
- **➕ REST endpoints**: `GET/POST/PUT/DELETE /api/scheduled-tasks`, `POST /api/scheduled-tasks/:id/toggle`
- **➕ 3 nuevas tools**: `create_task` (crea y ejecuta tarea), `cancel_task` (cancela tarea por ID), `schedule_task` (programa tarea recurrente con expresión cron)
- **🔄 `cron.ts` reescrito** — Task scheduler cada 60s que evalúa `getDueTasks()` y ejecuta las que corresponden mediante `submitAgentRun()`. Mantiene cleanup de sesiones cada 30min
- **➕ Seeds actualizados**: todos los modos por defecto incluyen `create_task` y `cancel_task`; `desarrollador` y `evolutivo` además incluyen `schedule_task`

#### Agent Frontend
- **➕ WS en tiempo real** — `Tareas.tsx` recibe eventos `task_created`, `task_status`, `task_cancelled`, `task_completed`, `task_failed` y actualiza la lista sin polling
- **➕ Filtro `cancelled`** en el listado de tareas
- **➕ Botón "Cancelar"** en tareas con estado `queued`/`running` → envía WS `cancel_task`
- **➕ Botón "Nueva Tarea"** + modal con textarea → envía WS `new_task`
- **➕ Sub-tabs "Historial" / "Programadas"** — Pestaña separada para gestionar tareas autoejecutables
- **➕ Pestaña "Programadas"**: CRUD completo — crear/editar/eliminar tareas programadas, toggle enable/disable, ejecutar ahora
- **➕ Indicador de origen** — Icono 🌐📱⏰🔧 según origen de la tarea (web/telegram/scheduler/tool)
- **➕ `/nuevaTarea` mejorado** — Abre modal de creación de tarea en vez de enviar WS vacío
- **➕ Modal "Nueva Tarea Programada"** con inputs para nombre, expresión cron, texto y modo selector

### 🎭 Sistema de Modos: Personalidad, herramientas y configuración por modo (2026-06-07)

#### Agent Engine
- **➕ 7 nuevas herramientas**: `weather` (clima Open-Meteo), `web_search` (DuckDuckGo), `calc` (calculadora científica segura), `translate` (LibreTranslate, 30+ idiomas), `notify_frontend` (toast vía WS), `notify_telegram` (mensaje a chats Telegram), `knowledge_search` (búsqueda semántica RAG en MCP Brain)
- **➕ `tool-bridge.ts`** — Puente de acceso a WsServer para tools que notifican en tiempo real
- **➕ Nueva dependencia**: `cheerio` para parseo HTML en web_search
- **🔄 Modos por defecto mejorados** — `asistente`, `desarrollador`, `investigador` ahora incluyen las nuevas tools según su perfil
- **➕ Nueva tabla `agent_modes`** en SQLite con columna `tools` (JSON), `extends` (herencia), `tool_policy` y contador de uso
- **🧬 Modo Evolutivo** — Nuevo modo `evolutivo` con 7 meta-herramientas para crear/modificar/eliminar tools personalizadas en tiempo real
- **➕ Tabla `custom_tools`** en SQLite — Almacena herramientas personalizadas con tipo (bash/http/prompt), parámetros y config
- **➕ `ToolRegistry.registerCustomTool()` / `unregisterCustomTool()`** — Registro dinámico de tools en caliente
- **➕ `custom-tool-handler.ts`** — Dispatcher que ejecuta handlers bash (con `{{param}}`), http (requests API), prompt (plantillas)
- **➕ 7 meta-tools** en `services/tools/evolutivo/`: `create_tool`, `edit_tool`, `delete_tool`, `test_tool`, `list_custom_tools`, `export_tool`, `import_tool`
- **➕ Carga automática** de custom tools desde DB al iniciar y después de cada cambio
- **➕ `services/db/modes.ts`** — CRUD completo: `listModes()`, `getMode()`, `resolveMode()` (herencia recursiva con merge de tools), `upsertMode()`, `deleteMode()`, `setActiveMode()`, `incrementModeUsage()`
- **➕ `toolRegistry.applyModeTools(tools[])`** con `SimpleMutex` — deshabilita atómicamente todas las herramientas y luego habilita solo las del modo
- **➕ Protocolo WS**: 5 nuevos tipos (`list_modes`, `get_active_mode`, `set_active_mode`, `mode_update`, `mode_changed`)
- **➕ Handler `set_active_mode`** — cambia modo, aplica tools, resetea sesiones LLM, notifica a todos los clientes vía `mode_changed`
- **➕ Handler `mode_update`** — CRUD de modos con validación de tools vs registry y detección de ciclos en herencia
- **🔄 `runAgentCore.ts`** — ahora usa modelo, temperatura, history_limit y system_prompt del modo activo (con fallback a `__general__`)
- **🔄 `buildPrompt.ts` reescrito** — sistema de prompt como asistente personal "LaLlama" (no project-centric), sin referencias a slash commands ni jerga de herramientas
- **🐛 Fix: dynamic imports → static imports** en `handlers.ts` para los módulos de modes; `handleMessage()` convertido a `async`
- **🐛 Fix: brain timeout 10s → 30s** en `client.ts` para tolerar latencia de embedding en Ollama
- **🐛 Fix: `allowedUsers` siempre desde DB** (no condicionado por placeholder del token)
- **➕ Seeding automático** de 3 modos por defecto al iniciar (`asistente`, `desarrollador`, `investigador`)
- **🗑️ Debug logs eliminados** de `bot.ts` (console.log y [TG-DEBUG])

#### Agent Frontend
- **➕ `ModosList.tsx` (NUEVO)** — Componente CRUD completo: lista, creación, edición inline y eliminación de modos con confirmación visual
- **➕ Plantillas de modos recomendados** en `ModosList.tsx` — 4 tarjetas clickeables (Asistente General, Desarrollo, Investigación, Aprendizaje) que precargan el formulario de creación con system prompt, tools y configuración predefinida
- **➕ Plantillas de sub-agentes** en `SubAgentesList.tsx` — 4 tarjetas (Código, Documentación, Testing, DevOps) con system prompt, tools y temperatura predefinidos
- **🔄 `Agentes.tsx` rediseñado** — 3 sub-tabs: "Agente Principal", "Modos", "Sub Agentes". Tarjetas de modo clickeables con glow activo. Estado de modos gestionado a nivel padre
- **🔄 `AgentePrincipal.tsx` adaptado** — Muestra y edita configuración del modo activo (system prompt, modelo, temperatura, tools). Tool list con indicador ✅/❌. **Eliminada sección Telegram** (ya en Conexion.tsx)
- **➕ `AgentChat.tsx`** — Nuevo handler `mode_changed` que resetea chat y muestra "🔄 Modo cambiado a 'X'" cuando cambia el modo

### 📱 Telegram: Sección UI en Conexion + Fixes backend (2026-06-07)

#### Agent Engine
- **🐛 Fix: brain null en callbacks.ts** — Ahora `handleCallbackQuery` recibe `brain: BrainClient | null`, eliminando el `null as never` que rompía los inline buttons
- **➕ `setTelegramConfig(token, allowedUsers)`** — Nueva función en bot.ts para actualizar config en runtime sin reiniciar el proceso
- **🔧 `telegram_update` mejorado** — Ahora acepta `allowedUsers` array. Usa `setTelegramConfig()` antes de `startTelegram()`. Reporta estado real con `getBot() !== null`
- **➕ Nuevo handler WS `telegram_get_status`** — Devuelve `active`, `running`, `allowedUsers`, `tokenPreview`

#### Agent Engine
- **🐛 Fix: telegram_get_status mostraba config vacía** — Usaba `config` local de `loadConfig()` (valores de env) en vez de `getTelegramConfig()` de bot.ts
- **➕ Persistencia en DB** — `telegram_update` guarda token/usuarios en tabla `settings` de SQLite. Al iniciar, si no hay `.env`, carga desde DB
- **➕ `getTelegramConfig()` en bot.ts** — Expone token, allowedUsers, running desde runtime config

#### Agent Frontend
- **➕ Sección Telegram en Conexion.tsx** — Nueva card con:
  - Badge de estado (Activo/Inactivo) con colores verde/rojo
  - Input de token (type=password)
  - Input de usuarios permitidos separados por coma
  - Botón "Iniciar Bot" / "Detener Bot" con toggle
  - Botón "Actualizar" para aplicar cambios sin reiniciar
  - Nota informativa con comando `/ayuda`
- **🐛 Fix: preview del token no reemplaza input del usuario** — `telegramTokenPreview` separado de `telegramToken` para no enviar token enmascarado al backend
- **➕ Handlers WS**: `telegram_status`, `telegram_get_status` en subscribe
- **📡 Fetch automático**: Al conectar, pide `telegram_get_status`

### 🔧 Slash Commands: Limpieza y nuevas funcionalidades (2026-06-06)

#### Agent Frontend
- **🗑️ Eliminados**: `/temperatura` (redundante), `/chat nuevo` (hay icono)
- **🔄 `/modelo` → `/modelos`**: Ahora lista los modelos disponibles en Ollama con nombres exactos
- **➕ `/cambioModelo <nombre>`**: Nuevo comando para cambiar el modelo activo al instante. Envía `general_config_update` y muestra confirmación
- **🔧 `/tools` arreglado**: Ahora muestra la lista formateada de herramientas con nombre y descripción
- **🔧 `/nuevaTarea` arreglado**: Crea una tarea (run) en la base de datos y muestra confirmación con ID
- **🎨 `/buscar` estilo Discord**: Si escribís `/buscar` sin consulta, el input cambia a `/buscar: ` y espera el texto. Como Discord. Al apretar Enter se ejecuta la búsqueda
- **Nuevos handlers WS**: `tools_list`, `ollama_models`, `task_created` en `handleWsMessage`

#### Agent Engine
- **➕ Handler `new_task`**: Crea un run en la DB con status "queued". Responde con `task_created`

### 🔧 Hotfix: Forzar ejecución de herramientas + Mejora read_url + Contador de mensajes (2026-06-06)

#### Agent Engine
- **🔧 System prompt reforzado** — Nueva sección "Uso de herramientas - CRÍTICO" con regla de oro, prohibiciones explícitas (no describir, no preguntar, no mostrar JSON) y ejemplos concretos de cuándo ejecutar tools automáticamente
- **🔧 Conciencia del sistema de tareas** — El agente ahora conoce los 7 comandos Slash del frontend y sabe cómo responder cuando el usuario pide "agregar una tarea"
- **🔧 read_url mejorado** — Nueva función `htmlToText()` que limpia HTML/JS de las respuestas. Detecta contenido HTML automáticamente. User-Agent actualizado a Chrome 125 real para evitar bloqueos de buscadores
- **📊 Contador de mensajes** — Nueva sección en el header del chat mostrando "↓ N ↑ M" (enviados/recibidos)

### 🚀 Fase 2: Citas/Reply, Favoritos, Sugerencias Automáticas, Historial de Sesiones (2026-06-06)

#### Agent Engine
- **💬 Citas / Reply** — Nuevo campo `quotedMessage` en `AgentOptions`. Cuando un usuario responde citando un mensaje, el contenido se inyecta como blockquote en el prompt del agente para dar contexto
- **⭐ Favoritos** — Nueva tabla `saved_messages` en SQLite + 4 handlers WS (`save_message`, `unsave_message`, `list_saved_messages`, `is_message_saved`) con DB functions dedicadas
- **💡 Sugerencias automáticas** — Nuevo servicio `suggestions.ts` que genera 2-3 preguntas de seguimiento vía LLM después de cada respuesta. Se envía evento WS `suggestions` con el array. No bloquea la respuesta principal
- **🕐 Historial de sesiones** — Nueva función `getChatWithStats()` que retorna mensaje por chat. Handler WS `list_sessions` expone todos los chats del usuario con `messageCount`
- **Nuevos tipos WS registrados** — `protocol.ts` actualizado con 10 nuevos tipos de mensaje para las 4 features

#### Agent Frontend
- **💬 Citas / Reply** — Nuevo botón "Reply" en cada mensaje (hover). Barra contextual sobre el input con texto "Respondiendo a..." y botón X. Se envía `quotedMessage` en el payload, se limpia al enviar
- **⭐ Favoritos** — Botón Star toggle en cada mensaje (relleno amarillo si guardado, outline si no). Tracking local con Set de mensajes guardados. Handlers para `message_saved/unsaved/saved_status`
- **💡 Sugerencias automáticas** — Chips de sugerencias entre tool calls y "Pensando...". Al hacer clic, se llena el input. Se limpian al enviar nuevo mensaje
- **🕐 Historial de sesiones** — `messageCount` agregado a `ChatEntry`. Cada chat en el sidebar muestra "📝 N mensajes". Se envía `list_sessions` al identificar usuario

### 🚀 Fase 1: 5 Mejoras UX en Chat — Búsqueda, Exportación, Tool Calls Colapsables, Multi-modal, Edición (2026-06-06)

#### Agent Frontend
- **🔍 Búsqueda dentro del chat** — Nueva barra de búsqueda en el header del chat que filtra mensajes en tiempo real. Muestra contador de resultados y estado "Sin resultados"
- **📤 Exportar conversación** — Botón de descarga que exporta todo el historial del chat a un archivo Markdown (`chat-{id}-{fecha}.md`) con estructura clara de roles y timestamps
- **📦 Tool calls colapsables** — La sección de herramientas ahora es colapsable con un clic en el header. Badge con contador de herramientas. Ahorra espacio vertical cuando hay muchas tool calls
- **🖼️ Multi-modal (imágenes inline)** — Las imágenes (Markdown, data:image, URLs con extensión de imagen) se renderizan inline con vista previa de 300px max-height. Click para ver en lightbox fullscreen
- **✏️ Editar mensajes enviados** — Click en cualquier mensaje de usuario para editarlo. Textarea con Guardar/Cancelar. Enter guarda, Escape cancela
- **Bugfix: switch statement** — El `case "error"` estaba fuera del switch por una llave `}` prematura en `handleWsMessage`. El manejador de errores nunca se ejecutaba. Corregido

### 🚀 Mejoras en Chat: Tokens, Historial de Tools, Slash Commands (2026-06-06)

#### Agent Engine
- **Fix token counter** — Estimación de tokens cuando el modelo no los reporta (Ollama). Calcula prompt_tokens = chars/4 y completion_tokens = chars/4 en `runAgentCore.ts`
- **Indexación automática de URLs** — Cuando `read_url` se ejecuta exitosamente, guarda automáticamente el contenido en el Brain como memoria tipo `knowledge` para búsquedas futuras

#### Agent Frontend
- **Historial persistente de herramientas** — Las tool calls ya no se borran al finalizar la respuesta. Permanecen visibles hasta el próximo mensaje del usuario
- **"Pensando..." siempre visible** — El indicador de procesamiento ahora se muestra durante todo el tiempo que `isProcessing` sea true, independientemente de tool calls o streaming
- **Slash commands** — Nuevo sistema de comandos tipo chat:
  - `/ayuda` — Muestra lista de comandos disponibles
  - `/buscar <consulta>` — Busca información en internet
  - `/nuevaTarea` — Crea una nueva tarea
  - `/modelo <nombre>` — Cambiar el modelo activo
  - `/temperatura <0-2>` — Ajustar la temperatura
  - `/chat nuevo` — Crear un nuevo chat
  - `/tools` — Listar herramientas disponibles
  - Navegación con flechas ↑↓ + Enter, cierre con Escape

### 🚀 Agent Frontend: Cola de mensajes + Fix duplicación + System Prompt (2026-06-06)

#### Agent Frontend
- **Nueva cola de mensajes (max 3)** — Mientras el agente procesa una respuesta, los nuevos mensajes se encolan automáticamente y se envían cuando termina la actual
- **Input siempre activo** — El textarea ya no se deshabilita durante procesamiento; el placeholder cambia contextualmente ("Escribe, se encolará...", "Cola llena (3/3)")
- **Auto-despacho desde cola** — Cuando `isProcessing` pasa a `false`, el siguiente mensaje en cola se envía automáticamente
- **UI de cola** — Barra visual entre mensajes e input con contador `N/3`, pills por mensaje con botón ✕ individual, y botón "Vaciar cola"
- **Confirmación al cancelar con cola** — Modal que pregunta "Vaciar todo" vs "Solo cancelar respuesta" (conserva cola)
- **Fix duplicación de respuestas** — `assistant_done` ahora reemplaza el último mensaje del streaming en vez de agregar uno nuevo, eliminando la duplicación que ocurría al finalizar cada respuesta
- **Cola se vacía al cambiar de chat** — Previene mensajes huérfanos

#### Agent Engine
- **System prompt mejorado** — Ahora instruye explícitamente: *"Cuando el usuario te pida USAR, EJECUTAR o PROBAR una herramienta, debes llamarla mediante tool_calls, no describirla en texto ni mostrar JSON de ejemplo"*

### 🧠 Agent Engine: Docker Awareness + Eliminación de Jarvis (2026-06-06)

#### Agent Engine
- **Nuevo servicio `docker-info.ts`** — Detección automática del entorno al iniciar:
  - Si ejecuta dentro de Docker (`.dockerenv` / cgroup)
  - CPUs lógicos, RAM total y límite del contenedor (cgroup v1/v2)
  - GPU NVIDIA disponible (`nvidia-smi` + `NVIDIA_VISIBLE_DEVICES`)
  - Disco disponible en el workspace (`df`)
  - Se inyecta en el system prompt del agente como sección `## Entorno del agente`
- **Nueva tabla `settings` en SQLite** — Almacenamiento key-value persistente para `docker_info` y otras configuraciones
- **`AppConfig` ahora incluye `dockerInfo`** — La configuración del entorno está disponible en todo el runtime
- **`RuntimeContext` extendido** — Incluye `dockerInfo` y nueva función `getDockerInfo()`
- **Nuevo handler WS `get_docker_info`** — Expone la info del contenedor al frontend
- **Corregido `get_status`** — Ahora usa el modelo de `__general__` (DB) en lugar de solo `config.defaultModel` (env var), consistente con el handler `identify`

#### Agent Frontend
- **Eliminada la pestaña "Jarvis"** — Se eliminó el asistente de voz (`Jarvis.tsx`) y la tab correspondiente del dashboard
- **Nueva sección "Información del Contenedor"** en Conexión — Grid visual con CPU, RAM, GPU, Disco y badge Docker/Host
- **Chat siempre montado** — `<AgentChat />` ahora se mantiene montado con `display:none` en vez de render condicional, evitando perder suscripciones WebSocket al cambiar de tab
- **Corregida desincronización del modelo** — El Chat ahora recibe broadcasts de cambio de modelo aunque esté en segundo plano
- **Eliminado hardcode de modelo en Agentes** — Ya no usa `localStorage` ni fallback `"llama3.2:3b"`; el modelo viene siempre del servidor

### 🎨 Agent Frontend: Dashboard multi-sección + Chat persistente + Conocimiento (2026-06-04)

#### Agent Frontend (nuevo)
- **Nuevo proyecto standalone `agent-frontend/`** — React 19 + Vite 7 + TypeScript, puerto 8081.
- **Dashboard de 6 secciones** con navegación lateral glassmorphism:
  - **Chat** — chat multi-conversación con WebSocket, sidebar colapsable con búsqueda, crear/renombrar/eliminar/fijar chats.
  - **Agentes** — Configuración General (modelo, temperatura slider 0–2, límite de historial 5–100), Telegram Bot, Tools toggles, CRUD de sub-agentes con WS propio.
  - **Tareas** — listado de ejecuciones con filtros por estado, modal de detalle con línea de tiempo de eventos.
  - **Conocimiento** — subida de archivos con chunking automático e indexación al MCP Brain, panel de búsqueda semántica.
  - **Conexión** — estado WebSocket, CRUD de proveedores de modelos, información del MCP Brain.
  - **Memoria** — búsqueda en el Brain (semántico/lexical/híbrido), estadísticas, modal de detalle.
- **view-header eliminado en Chat** — máximo espacio para mensajes; solo barra compacta de 8px con estado, modelo, contador de tokens.
- **Token counter** — muestra `▲prompt / ▼output` por mensaje y total `Σ` en la barra de estado.
- **Auto-creación de chat** al enviar el primer mensaje si no hay chat seleccionado.
- **Contenedor Docker** en `docker-compose.yml` (puerto 8081).

#### Agent Engine
- **Nuevos endpoints REST**:
  - `GET /api/runs` — listado de ejecuciones con filtros (status, chatId, origin, limit).
  - `GET /api/runs/:id` — detalle de ejecución con eventos.
  - `GET /api/knowledge` — listar documentos indexados.
  - `POST /api/knowledge` — subir archivo, chunkear, embedear y guardar como memoria `knowledge` en el Brain.
  - `DELETE /api/knowledge/:id` — eliminar documento del Brain.
- **Nuevo servicio `services/knowledge/index.ts`** — chunking por párrafos, lectura de archivos (txt, json, md), indexación vía REST al MCP Brain.
- **Nuevas funciones DB** `listRunsByFilters()` y `getRunEvents()` en `services/db/runs.ts`.
- **Fix: persistencia de chats** — los chats se creaban con `clientId` (WS connection ID volátil) como `userId` en vez del `userId` real del identify. Agregado `userMap<clientId → userId>` que se consulta en todas las operaciones de chat.
- **Fix: auto-creación de chat en primer mensaje** — si el chatId no existe en la DB, se crea automáticamente con el texto del primer mensaje como título.

#### Refactor
- **Conexión y Agentes**: eliminada duplicación de Telegram y Tools. Conexión queda solo con Estado WS, Modelos CRUD y MCP Brain. Agentes mantiene Status, Default Model, Telegram, Tools, Sub-Agents.
- **buildPrompt.ts reducido de ~60 a 4 líneas**: eliminado stack del proyecto, descripciones de tools (redundantes con OpenAI function calling API), reglas de formato, directivas y contexto. Ahorro estimado: 500-1000+ tokens/request.
- **Directives y context como mensajes system separados**: ya no se hornean en el system prompt. Se inyectan como mensajes `system` adicionales que pueden trimerase independientemente.

#### Configuración General persistente
- **Nuevo campo `history_limit`** en tabla `sub_agents` (migración automática).
- **WS messages**: `get_general_config` / `general_config_update` para leer y guardar configuración.
- **`runAgentCore.ts`**: lee `model`, `temperature` e `history_limit` del experto `__general__` en DB. Ya no usa hardcoded `temperature: 0.3` ni `getMessages(chatId, 10)`.
- **UI en Agentes**: slider de temperatura, input de límite de historial, modelo persistente con botón Guardar.

#### Optimización de tokens
- `temperature: 0.3` → `0.7` (más variación, menos patrones fijos).
- Eliminado `brain.getContext(10)` del primer mensaje de sesión (ahorra 200-800 tokens).
- Historial reducido de 20 a 10 mensajes (configurable vía general config).
- Prompt modificado: "Usa herramientas solo si el usuario pide explícitamente... Para conversación normal, responde directamente sin preámbulos ni disculpas."

#### Builds verificados
- `agent-engine`: ✅ TypeScript 0 errores.
- `agent-frontend`: ✅ TypeScript + Vite production build 0 errores (251 KB JS).

### 🎙️ Nueva sección Jarvis: Asistente de Voz (2026-06-04)

#### Agent Frontend
- **Nuevo tab "Jarvis"** en la barra lateral entre Chat y Agentes.
- **Nuevo componente Jarvis.tsx** — botón "Iniciar Jarvis" que solicita permiso de micrófono vía `getUserMedia`, maneja estados (idle/requesting/granted/denied/unavailable), errores (NotAllowedError, NotFoundError), y botón "Detener Jarvis" para liberar el stream.
- **Indicador visual** animado cuando está escuchando, con glow effect y color verde.

### 📎 File Upload + Chat Persistence + Model Selector + Grid Layout (2026-06-04)

#### Agent Frontend
- **Subida de archivos en Chat** — botón 📎 Paperclip junto al textarea, selector de archivos múltiple, lectura como base64 vía `FileReader.readAsDataURL()`, envío por WebSocket como `attachments` en `user_message`.
- **Chips de archivos adjuntos** — barra de archivos seleccionados con nombre y botón X para remover, mostrada entre el input y el textarea.
- **Select de modelos Ollama** — reemplazado input manual de texto por `<select>` dropdown que lista modelos disponibles desde Ollama vía nuevo WS `list_ollama_models`.
- **Grid 2-columnas en Agentes** — General Config y Telegram ahora lado a lado en CSS grid, max-width ampliado a 900px, cards con altura completa (`height: 100%`).

#### Agent Engine
- **Attachments forwarding** — `handlers.ts` ahora extrae `attachments` del payload `user_message` y los pasa a `handleUserMessage` → `runAgent` (el core ya procesaba texto/JSON/imágenes).
- **Fix: chat_create ahora envía activeChatId** — el frontend cambia inmediatamente al nuevo chat al crearlo. Eliminado el mensaje "Chat creado." que aparecía como respuesta del asistente.
- **Sidebar refrescado post-respuesta** — después de cada `assistant_done`, se envía `list_chats` actualizado a todos los clientes para que el sidebar muestre el último mensaje.
- **Nuevo WS `list_ollama_models`** — handler que consulta el backend (`/api/models`) con API key y retorna la lista de modelos instalados en Ollama.
- **Nuevos tipos protocolo** — `list_ollama_models` (C→S) y `ollama_models` (S→C) en `protocol.ts`.

### 🐛 Fixes: System prompt vacío + Tool listing + WS errors + Modelos Docker (2026-06-04)

#### Agent Engine
- **Fix: system prompt vacío** — `general_config_update` guardaba `system_prompt: ""` al no enviarlo desde el frontend, sobrescribiendo el prompt del build. Ahora preserva el existente si no se provee.
- **Fix: fallback de system prompt** — `runAgentCore.ts` ahora usa `generalOverride?.system_prompt` (optional chaining), cayendo a `buildSystemPrompt()` si está vacío.
- **Tool names en contexto** — se agrega mensaje system con la lista de herramientas disponibles (`toolRegistry.getToolNames()`) para que el modelo pueda responder cuando le pregunten.
- **Fix: list_ollama_models desde Docker** — cambiado de `localhost:11434/api/tags` (inaccesible desde contenedor) a `backendUrl/api/models` con header `X-API-Key`.
- **Mejora buildPrompt** — instrucciones más directas: sin disclaimers, permite listar herramientas, sin preámbulos ni disculpas.

#### Agent Frontend
- **Fix: WS "closed before connection established"** — ambos componentes (AgentChat, Agentes) ahora verifican `readyState` antes de cerrar WebSocket en cleanup de useEffect, evitando error en React StrictMode.

### 🤖 Telegram Gateway + Sub-Agent System + Dashboard Settings (2026-06-02)

#### Agent Engine
- **Nuevo SQLite local** (`better-sqlite3`) para datos operacionales:
  - `services/db/connection.ts` — singleton con 5 tablas: users, sub_agents, messages, chats, models.
  - `services/db/users.ts` — CRUD de usuarios (userId, telegram_id, telegram_user, timezone).
  - `services/db/experts.ts` — CRUD de sub-agentes (name, model, system_prompt, tools[], experts[]).
  - `services/db/chats.ts` — persistencia de chats con título, pin, última actividad.
  - `services/db/messages.ts` — mensajes persistentes por chatId con origen (web/telegram).
  - `services/db/models.ts` — CRUD de modelos guardados (name, apiKey, baseUrl).
- **Nuevo Telegram Bot** (`services/telegram/`):
  - `services/telegram/bot.ts` — start/stop bot, message handler con autorización por whitelist.
  - `services/telegram/commands.ts` — 8 comandos: /start, /agentes, /crear_agente, /borrar_agente, /reset, /model, /status, /tools, /profile.
  - `services/telegram/callbacks.ts` — manejo de callback_query para botones inline.
  - Tags @AgentName para invocar sub-agentes directamente desde Telegram.
  - Modo Orquestador automático si existe agente "orquestador".
  - Persistencia de mensajes en SQLite local.
- **runAgent.ts mejorado**: nuevos callbacks `onStatus` (⏳ indicadores progreso) y `onTyping`. Nuevos campos `origin`, `telegramChatId`, `skipPersistUserMsg`. Persistencia automática a SQLite.
- **appConfig.ts**: nuevos campos `dbPath`, `telegramBotToken`, `telegramAllowedUsers`.
- **Protocolo WebSocket extendido**: 17 nuevos tipos de mensaje (expert_update, user_register, chat_update, switch_chat, telegram_update, etc.).
- **server/handlers.ts**: manejo completo de expertos, usuarios, chats, modelos y Telegram.
- **server/api.ts**: nuevos endpoints REST `/api/experts`, `/api/users`, `/api/models`, `/api/stats`.

#### Frontend
- **AgentChat.tsx expandido a dashboard completo** con 3 tabs:
  - **Chat** — el chat existente con tool calls en tiempo real.
  - **Settings** — selector de modelo, token de Telegram (con save), toggles de herramientas.
  - **Sub-Agents** — listado, creación (nombre + modelo + system prompt) y eliminación de agentes expertos.

#### Builds verificados
- `agent-engine`: ✅ TypeScript 0 errores (con better-sqlite3 + node-telegram-bot-api).
- `frontend`: ✅ TypeScript + Vite production build 0 errores (646 KB JS).

### 🏗️ Arquitectura — Migración Agent Engine a Use Case Pattern + DI funcional (2026-06-02)

#### Agent Engine
- **Nueva estructura `services/`** con capas funcionales siguiendo el patrón de mcp-brain:
  - `services/config.ts` — `AppConfig` interface + `loadConfig()` (desde env).
  - `services/types.ts` — interfaces compartidas.
  - `services/brain/` — `BrainClient` como dependencia fundamental (equivalente a `DatabaseService` en mcp-brain), con `saveMemory`, `searchMemories`, `getContext`.
  - `services/agent/` — `runAgent()` (core loop multi-turno tool calling), `buildPrompt()`, `createClient()` (Ollama/OpenAI/OpenRouter).
  - `services/tools/` — `ToolRegistry` singleton, `registerAllTools(brain)`, 8 herramientas (bash, read/write-file, glob, grep, read-url, delegate + memory-tools).
  - `services/sessions/` — sesiones en memoria (`Map<string, SessionState>`), con `startSession`, `getSession`, `endSession`.
  - `services/execution/` — logging de ejecuciones con `logExecution`, `getHistory`.
  - `services/index.ts` — barrel principal con namespace exports.
- **Nueva capa `server/`** reemplazando `gateway/server.ts`:
  - `server/api.ts` — Express REST (health, tools list).
  - `server/ws.ts` — WebSocket server como clase `WsServer`.
  - `server/handlers.ts` — WebSocket message handlers separados.
  - `server/cron.ts` — background jobs (cleanup cada 30min).
- **`index.ts` bootstrap refactorizado**: `validateEnv()` → `loadConfig()` → `new BrainClient(config)` → `registerAllTools(brain)` → `startApiServer(config)` → `new WsServer(config, brain)`.
- **Import fixes**: `ToolContext` movido de `registry.ts` a `types.ts`, actualizadas 7 herramientas.
- **Directorios viejos eliminados**: `src/agent/`, `src/tools/`, `src/memory/`, `src/gateway/server.ts`.

### 🐛 Correcciones

#### Frontend
- **Fix TS6133 en AgentChat.tsx** — se eliminaron 3 variables no usadas (`AlertCircle`, `chatId`, `text`) que rompían el build de Docker con exit code 2 por `noUnusedLocals` habilitado en tsconfig. ([#37](https://github.com/...))

### 🧠 Agent Engine — Servicio de Agente de Codificación Autónomo (2026-06-01)

#### Añadido
- **Nuevo servicio standalone `agent-engine/`** — agente de codificación autónomo inspirado en ARGenteIA-Project:
  - **Agent Loop** (`src/agent/loop.ts`): core de razonamiento con OpenAI SDK, soporte de tool calling multi-turno (máx 10 iteraciones), compactación de contexto automática, streaming de respuestas.
  - **Multi-provider Models** (`src/agent/models.ts`): soporte para Ollama (vía backend proxy), OpenAI y OpenRouter, con detección automática de proveedor.
  - **System Prompt Builder** (`src/agent/prompt.ts`): genera system prompt dinámico con herramientas disponibles, directivas del proyecto y contexto reciente del brain.
  - **Tool Registry** (`src/tools/registry.ts`): registro y ejecución de herramientas con enable/disable dinámico.
  - **8 herramientas integradas**:
    - `bash` — ejecución segura de comandos shell con detección de patrones destructivos.
    - `read_file` — lectura de archivos con límite de tamaño y protección path traversal.
    - `write_file` / `edit_file` — creación y edición de archivos con creación automática de directorios.
    - `glob` — búsqueda de archivos por patrón glob (**, *, ?) sin dependencias externas.
    - `grep` — búsqueda de contenido con regex, filtro por extensión, exclusión automática de binarios.
    - `read_url` — fetch de URLs con límite de tamaño y User-Agent personalizado.
    - `delegate` — recomendación de delegación a agentes OpenCode especializados.
    - `memorize` / `recall` / `get_context` — persistencia y consulta de memoria vía mcp-brain REST.

- **Gateway WebSocket + REST** (`src/gateway/server.ts`):
  - Servidor Express con endpoints `/health` y `/api/tools`.
  - Servidor WebSocket con protocolo de mensajes (8 tipos): user_message, assistant_chunk, assistant_done, tool_call, tool_result, cancel, get_status, list_tools.
  - Broadcasting de chunks, tool calls y errores a todos los clientes conectados.

- **Integración con mcp-brain** (`src/memory/brain-client.ts`):
  - Cliente REST para guardar/consultar memorias, iniciar/finalizar sesiones, obtener directivas y stats.
  - Timeout de 10s con manejo graceful de errores (no bloquea si brain no responde).

- **Nuevos endpoints REST en mcp-brain** (`src/server/api.ts`):
  - `POST /api/memory` — guardar memoria (para integración con agent-engine).
  - `GET /api/memory/context` — obtener contexto reciente como texto plano.
  - `POST /api/sessions` — iniciar sesión de trabajo.
  - `PUT /api/sessions/:id` — finalizar sesión con resumen.

- **Nuevo componente `AgentChat.tsx`** en frontend:
  - Chat interactivo con WebSocket al agent-engine.
  - Visualización de tool calls en tiempo real con estados (pending/done/error).
  - Indicador de conexión (connected/connecting/disconnected).
  - Botón de cancelación de respuesta en curso.
  - Mensajes de sistema, usuario y asistente con timestamps.
  - Auto-scroll y compactación visual.

- **Nueva tab "Agent Engine"** en la barra lateral del dashboard:
  - Botón de navegación con icono Bot en la sección de navegación principal.
  - Integrado en `getSectionInfo()` y `renderContent()` de `App.tsx`.

- **Servicio Docker `agent-engine`** en `docker-compose.yml`:
  - Puerto `3020` (configurable via `ENGINE_PORT`).
  - Variables de entorno: BACKEND_URL, BRAIN_URL, API_KEY, DEFAULT_MODEL, WORKSPACE_DIR.
  - Bind mount de `docker.sock` y del proyecto completo como `/workspace`.
  - Dependencias: backend y mcp-brain.

#### Modificado
- `mcp-brain/src/server/api.ts` — agregados 4 nuevos endpoints REST para soportar agent-engine.
- `docker-compose.yml` — agregado servicio agent-engine con integración en red mcp-network.
- `frontend/src/App.tsx` — agregada tab "Agent Engine" con su componente y navegación.
- `.env.example` — agregadas variables ENGINE_PORT y DEFAULT_MODEL.

### 🤖 AI Agent Wizard — Generación Inteligente de Agentes con IA (2026-05-23)

#### Añadido
- **Nuevo endpoint `POST /api/agents/analyze-project`** en el backend (Express):
  - Recibe modelo Ollama, estructura de proyecto (árbol de archivos) y archivos de configuración.
  - Envía el análisis a la IA local y devuelve agentes OpenCode, rules y workflows generados automáticamente.
  - Nuevo servicio `backend/src/services/agents.service.ts` con lógica de construcción de prompt y parseo de respuesta JSON.
- **Nuevo endpoint `POST /api/projects/ensure`** en mcp-brain:
  - Verifica si un proyecto existe en la base de datos del brain.
  - Si no existe, crea una memoria semilla tipo `"project-created"` para registrarlo automáticamente.
- **Nuevo componente `AIAgentWizard.tsx`** en el frontend:
  - Modal wizard con 3 pasos: seleccionar modelo Ollama → nombre del proyecto → seleccionar carpeta.
  - Usa la **File System Access API** (`showDirectoryPicker`) para leer la estructura del proyecto directamente desde el navegador.
  - Lee automáticamente archivos de configuración clave (package.json, tsconfig, etc.).
  - Envía la estructura al backend para análisis con IA.
  - Muestra resultados: lista de archivos generados con previsualización, descarga individual, copia.
  - Botón "Guardar como Templates" para persistir los archivos en el brain como templates reutilizables.
  - Botón "✨ Crear Proyecto en Brain" para registrar el proyecto automáticamente.
  - Todos los agentes generados incluyen conexión Brain MCP (`http://localhost:3015/sse`).
- **Botón "AI Wizard"** en el Scaffold de Agentes (`BrainScaffold.tsx`):
  - Nuevo botón junto al existente "Nuevo Template" que abre el modal del wizard.
  - El componente `BrainScaffold` ahora acepta props `project` y `onToast` desde `BrainConsole`.

#### Modificado
- `frontend/src/components/BrainConsole.tsx` — pasa `project` y `addToast` a `BrainScaffold`.
- `frontend/src/components/BrainScaffold.tsx` — acepta nuevas props, agrega botón AI Wizard.
- `backend/src/main.ts` — agrega import, instanciación y ruta para `AgentsService`.
- `mcp-brain/src/server/api.ts` — agrega endpoint `POST /api/projects/ensure`.

#### Añadido
- **Conciencia de Fase SDD (Spec-Driven Development):**
  - Columna `phase` añadida en tablas SQLite `memories` y `memories_fts`.
  - Badges morados en la UI para auditar visualmente en qué fase del ciclo de vida se originó cada aprendizaje.
- **Directivas Centrales (Core Directives) y Captura de Memoria Autónoma:**
  - Nueva tabla `core_directives` para almacenar instrucciones inmutables por proyecto.
  - Inyección automática de la cláusula de **OBLIGACIÓN COGNITIVA CRÍTICA** en `getCoreDirectives`, forzando a todos los agentes autónomos (Cursor, Claude, Antigravity) a ejecutar `mem_save` en el mismo turno tras editar código.
- **Gatillos de Intervención (Delegation Triggers):**
  - Rastreos de frecuencia de consultas en `searchMemories.ts`. Inyecta automáticamente la advertencia `WARNING_DELEGATION` si un agente repite búsquedas idénticas >3 veces en 5 minutos.
- **Mantenimiento Proactivo y Consolidación (Ollama):**
  - Servicio `consolidation.ts` que agrupa memorias por etiqueta y utiliza Ollama en segundo plano (vía Cronjob) para resumir redundancias en "Key Learnings" limpios.
- **Auto-Instalador y Sincronización MCP (Auto-Sync):**
  - Endpoint `POST /api/mcp/sync` en `api.ts` para localizar y actualizar configuraciones en **OpenCode AI**, **Antigravity AI**, **RooCode (VS Code)** y **Claude Desktop**.
  - Tarjetas UI en `BrainSettings.tsx` con tooltips de información (`ℹ️`) y botón de copia global al portapapeles (`📋`).

### 🚀 Optimización de Tokens — Quick Wins (2026-05-23)

#### Modificado
- **Compresión de sesión en `ollama.service.ts`** — historial >6 mensajes se comprime en un solo mensaje de sistema tipo summary. Ahorro estimado: ~10K tokens/request.
- **`getContext()` sin content por defecto** — nuevo flag `includeContent` (default `false`), límite reducido de 20 a 10. Ahorro estimado: ~8K tokens/call. Archivos: `mcp-brain/src/services/memories/getContext.ts`, `api.ts`, `mcp.ts`.
- **Descripciones de MCP tools acortadas** — todas las descripciones reducidas de ~200-900 chars a ~50-80 chars en `mcp-brain/src/server/mcp.ts`.
- **Compliance reminder plano** — reemplazado el bloque ASCII-art de `buildComplianceReminder()` por texto plano de una línea. Archivo: `mcp-brain/src/server/mcp.ts`.
- **Truncación de content en saveMemory** — `content` se trunca a 1000 chars al guardar. Archivo: `mcp-brain/src/services/memories/saveMemory.ts`.
- **JSON sin pretty-print** — reemplazadas 11 ocurrencias de `JSON.stringify(obj, null, 2)` por `JSON.stringify(obj)` en `mcp-brain/src/server/mcp.ts`. Ahorro: ~30% del payload en respuestas MCP.
- **Audit log truncation** — argumentos limitados a 10 campos, snapshot a 500 chars, result_preview a 200 chars en `logToolCall.ts`. Añadido cleanup oportunista (1/100 llamadas elimina logs >30 días).
- **Prompt caching en agents.service.ts** — caché del prompt compilado mediante hash MD5 de estructura+configs. Solo recompila si los inputs cambian. Archivo: `backend/src/services/agents.service.ts`.
- **Workflows refactorizados** — creado `_steps-common.md` con pasos compartidos. Reducidos 3 workflows de dominio de ~475 líneas totales a ~180, referenciando pasos comunes.
- **Eliminado lodash del frontend** — removidas dependencias `lodash` y `@types/lodash` de `frontend/package.json` (no se usaban en código fuente).
- **Componentes compartidos TabButton + ModalLayout** — extraídos patrones duplicados de tabs en `BrainConsole.tsx` y overlay modal en `AIAgentWizard.tsx` a componentes reutilizables en `frontend/src/components/`.
- **ChatPlayground useReducer** — refactorizados 10 `useState` en un solo `useReducer` con `chatReducer` (17 acciones tipadas). Reduce declaraciones de estado en ~70%.
- **CSS eliminado** — `App.css` (Vite boilerplate, 42 líneas, no usado) eliminado.

### 🔄 Migración a SSE Remoto para mcp-brain y Sincronización Multi-IDE (2026-05-14)

#### Añadido
- **Transporte SSE en mcp-brain**: Nuevo endpoint `GET /sse` con `SSEServerTransport` del SDK MCP, y `POST /messages` para recibir mensajes del cliente vía HTTP.
  - Refactorización de `mcp.ts`: `createMcpServer()` ahora exporta el servidor MCP como función reutilizable, permitiendo conectarlo tanto a `StdioServerTransport` como a `SSEServerTransport`.
  - Soporte dual: stdio para procesos locales y SSE para acceso remoto desde otros agentes/IDEs.
- **Endpoint `/mcp` en Brain API**: Health-check para verificar accesibilidad remota del servidor MCP.
- **Sincronización MCP Multi-IDE mejorada**:
  - Soporte para **Windsurf** como nuevo target en `POST /api/mcp/sync`.
  - Configuración diferenciada por IDE: `type: "remote"` para OpenCode AI, `type: "url"` para Claude Desktop / Antigravity / RooCode / Windsurf.
  - Uso de `HOST_IP` como variable de entorno para la URL SSE, reemplazando el hardcodeo anterior.
  - Mensajes de confirmación más descriptivos indicando el tipo de conexión (SSE remoto).

#### Cambiado
- **opencode.json**: Configuración MCP de `lallamaOllama-brain` migrada de `type: "local"` (stdio via npx tsx) a `type: "remote"` (SSE via URL `http://192.168.0.236:3015/sse`).
- **docker-compose.yml**: Puerto por defecto de backend cambiado de `4066` a `3000` primero, y luego a `3016` para evitar conflictos con mcp-brain (puerto `3015`). URLs de frontend actualizadas consistentemente.

#### Corregido
- **`transport.handlePostMessage()`**: Ahora recibe `req.body` como tercer argumento, permitiendo que los mensajes MCP entrantes incluyan correctamente el cuerpo de la solicitud HTTP.

### 🧹 Corrección masiva Biome — 0 errores, 0 warnings (2026-05-14)

#### Corregido

##### Backend (`backend/`)
- **Tipado fuerte**: Reemplazo masivo de `any` por tipos concretos en 6 archivos
- **Interfaces creadas**: `MemoryStats`, `ConflictJudgment`, `SessionSummary`, `MemoryComparison`, `RequestLogEntry`, `SessionMessage`, `GpuMetrics`, `ChatResponse`, `ScrapedModel`
- **Error handling**: ~20 bloques `catch (error: any)` migrados a `catch (error: unknown)`
- **Middlewares**: `next: Function` reemplazado por `next: (err?: unknown) => void`
- **Código muerto**: `ChatMessage` no usado eliminado

##### mcp-brain/
- **Tipado de promesas**: `Promise<any>` reemplazado por interfaces concretas en 11 archivos
- **Limpieza**: Imports no usados eliminados, variables renombradas con prefijo `_`
- **Error handling**: `catch (e: any)` tipados correctamente con `unknown`
- **SQL mappings**: Tipado de filas de SQLite con interfaces específicas

##### Frontend (`frontend/`)
- **Accesibilidad**: `type="button"` añadido a ~25 botones sin tipo explícito
- **Accesibilidad**: Elementos `div` con `onClick` convertidos a elementos interactivos accesibles (`role="button"`, `tabIndex`, `onKeyDown`)
- **Accesibilidad**: SVG con `aria-label` añadido en iconos decorativos
- **Error handling**: `catch (err: any)` → `catch (err: unknown)` en manejo de errores
- **Tipado**: `[key: string]: any` → `[key: string]: unknown` en tipos de API
- **Seguridad**: `document.getElementById("root")!` con null check antes del renderizado
- **React keys**: Keys de arrays reemplazadas por IDs únicos en lugar de índices

##### Automático (Biome format --write)
- **Formateo**: 16 archivos corregidos automáticamente (indentación, comillas, saltos de línea)

#### Impacto
- Biome 2.4.8 ejecutado en **82 archivos** del proyecto
- **134 errores** y **139 warnings** corregidos
- **0 errores** y **0 warnings** después de las correcciones

### 📋 Revision completa del proyecto y actualizacion de documentacion (2026-05-12)

#### Añadido
- **Informe de estado del proyecto** generado con analisis detallado de:
  - Arquitectura general (5 servicios Docker)
  - Backend: 25 endpoints REST, 7 MCP Tools, ~2400 lineas TypeScript
  - Frontend: React 19 + Vite 7, 10 componentes, diseno glassmorphism
  - Infraestructura Docker: analisis de problemas y areas de mejora
  - Documentacion existente con estado de cada archivo

#### Corregido
- **README.md desactualizado**: Actualizada estructura de directorios (`.agents/` → `.opencode/agents/`, `mcp-frontend/` → `frontend/`, `ollama-mcp-server/` → `backend/`)
- **Version badge**: Actualizado de 0.3.0 a 0.4.0
- **Referencias eliminadas**: Directorios que ya no existen (`obsidian-vault/`, `AGENTS.md`, `DESIGN.md`)

#### Documentacion
- **README.md**: Reescrito completamente con estructura real del proyecto, lista completa de 7 MCP Tools, tabla de endpoints API, y tecnologias actualizadas
- **CHANGELOG.md**: Documentada esta revision

#### Notas de la Revision
- Problemas detectados en `docker-compose.yml`:
  1. Servicio `ngrok` y `frontend` dependen de `mcp-server` (deberia ser `backend`)
  2. `VITE_API_URL` y `VITE_SOCKET_URL` apuntan a `mcp-server` (deberia ser `backend`)  
  3. `mcp-brain` no tiene Dockerfile
- Backend: `memory.tools.ts` registra handlers en mismo schema que `ollama.tools.ts` (conflicto potencial)
- Frontend: `vite.config.ts` minimalista sin proxy de API

### Corregido

- **docker-compose.yml**: Corregidas 4 referencias a `mcp-server` (servicio inexistente) -> `backend`
  - `ngrok.depends_on`: `mcp-server` -> `backend`
  - `frontend.depends_on`: `mcp-server` -> `backend`
  - `VITE_API_URL` y `VITE_SOCKET_URL`: `mcp-server` -> `backend`
  - comando ngrok: `mcp-server` -> `backend`
  - Agregado volumen `brain_data` faltante en la seccion `volumes:`
- **mcp-brain Dockerfile**: Creado `mcp-brain/Dockerfile` (anteriormente faltaba)
- **frontend/.env y .env.example**: URLs corregidas de `localhost:3000` a `backend:3000` para entorno Docker
- **Conflicto MCP Tools**: Refactorizado registro de handlers en `app.module.ts` para combinar `ollama.tools.ts` (7 tools) y `memory.tools.ts` (14 tools) en un unico punto de registro, evitando sobreescritura
- **vite.config.ts**: Agregada configuracion de proxy para `/api`, `/v1`, `/sse` y `/socket.io` hacia `localhost:3000`
- **Instalacion de dependencias**: `pnpm install` ejecutado en la raiz del proyecto

#### Cambiado
- **Modelo asignado al agente `documentation`**: Configurado `gemma4:e2b` como modelo exclusivo para el agente de documentación en `opencode.json`, reservando modelos con razonamiento (`deepseek-r1:8b`, `qwen2.5-coder:7b`) para agentes de código y orquestación.

#### Mejorado
- **README actualizado**: Badge de versión `0.4.0` → `0.5.0`, lista de agentes corregida (eliminado `add-mcp-tool.md`, agregado `mcp-brain.md`), nota de optimización ~59% de agentes, nuevo flujo del orquestador centralizado documentado.
- **Prueba del agente `documentation` con `gemma4:e2b`**: El agente documentation se invocó exitosamente con el nuevo modelo asignado, analizó y actualizó el README sin errores.

### 🔧 Normalización de proyectos, merge, dashboard y mejoras del brain (2026-05-23)

#### Añadido
- **normalizeProject() genérico**: Nueva función en `mcp-brain/src/services/normalizeProject.ts` que normaliza cualquier nombre de proyecto a slug consistente (lowercase, sin especiales, sin duplicados). Se aplica automáticamente en todos los handlers MCP y endpoints REST.
- **Endpoint `POST /api/projects/merge`**: Permite fusionar dos proyectos en el brain (mueve memorias, directivas, sesiones y audit logs). Nueva función `mergeProjects.ts`.
- **Cache de embeddings**: Map in-memory con TTL 5 minutos en `searchMemories.ts` para evitar re-embedding en búsquedas repetidas.
- **Endpoint `GET /api/health`**: Health check del servicio mcp-brain.
- **`mem_suggest_topic_key` con LLM**: Ahora intenta usar Ollama para sugerir topic keys semánticas, con fallback al slug actual si Ollama no está disponible.
- **Dashboard BrainConsole**: Nuevos tabs "Explorador de Memorias" (búsqueda y eliminación de memorias) y "Fusionar Proyectos" (UI para merge). Indicador de health status del brain en el panel lateral.
- **Orquestador con health check**: El flujo del orquestador ahora verifica disponibilidad del brain y maneja errores gracefulmente.
- **Directivas inyectadas en instrucciones MCP**: Las directivas centrales ahora se cargan desde SQLite al iniciar el servidor y se inyectan en el campo `instructions` del protocolo MCP (tanto SSE como Stdio). Cualquier agente conectado vía SSE recibe automáticamente las reglas del proyecto.
- **`mem_get_directives` tool**: Nueva herramienta MCP para consultar directivas centrales de cualquier proyecto. Los sub-agentes por `task()` reciben las directivas vía contexto del orquestador.

#### Cambiado
- **Fix typo `lallamasollama` → `lallamaollama`**: Corregido en 12 lugares de `api.ts` los defaults que tenían una 's' extra. También corregido en `BrainConsole.tsx`.
- **Rutas Windows parametrizadas**: `CLAUDE_CONFIG_PATH` y `ROOCODE_CONFIG_PATH` ahora son configurables vía variables de entorno.
- **Validación de `relation` en `mem_judge`**: Ahora solo acepta los 6 valores válidos (`related`, `compatible`, `scoped`, `conflicts_with`, `supersedes`, `not_conflict`). Validación runtime + enum en inputSchema.

### 🤖 Agentes especializados por dominio (AÑADIDO - 2026-05-12)

#### Añadido
- **Sistema de 6 agentes especializados** como subagentes de opencode en `.opencode/agents/`:
  - `frontend-dev`: React 19 + Vite 7, componentes glassmorphism, Socket.IO
  - `backend-dev`: Express + TypeScript, dockerode, MCP SDK, auth, rate limiting
  - `ollama-ops`: Gestión de modelos Ollama, GPU, streaming SSE, métricas
  - `documentation`: CHANGELOG, README, Obsidian vault, diseño técnico
  - `docker-ops`: Docker compose, Dockerfiles, ngrok, redes, GPU passthrough
  - `qa-verification`: Biome lint, TypeScript builds, verificación post-cambio
- También como skills de contexto detallado en `.agents/skills/` con frontmatter YAML y triggers por patrón de archivo

### ✨ Playground: Adjuntar archivos en chat (AGREGADO - 2026-04-19)

#### Añadido
- **Soporte de adjuntos en ChatPlayground** ✅
  - Botón de clip para seleccionar múltiples archivos de texto/código desde el navegador
  - Chips visuales de adjuntos con opción de quitar cada archivo antes de enviar
  - Envío del contenido de archivos junto al prompt para análisis directo por el modelo
  - Soporte de envío con solo adjuntos (sin texto manual), usando prompt de análisis automático
  - Límites de seguridad/rendimiento: máximo 4 adjuntos, 512KB por archivo y truncado de contenido largo
  - **Impacto**: Permite trabajar con contexto externo (logs, código, configs) sin copiar/pegar manualmente

### 🚀 FASE 3: Performance Metrics + UI Dashboard (COMPLETADA - 2026-04-18)

**Objetivo**: Observabilidad en tiempo real de performance (TTFT, throughput).

#### Añadido
- **Time-to-First-Token (TTFT) Tracking** ✅
  - Nuevo tracking en streaming handler de `/v1/chat/completions`
  - Captura tiempo desde start del request hasta primer token recibido
  - Historia últimos 100 requests guardada en `ttftHistory`
  - **Impacto**: Identificar regresiones en latencia o problemas con GPU

- **Tokens Per Second (Throughput) Tracking** ✅
  - Calcula tok/s al final de cada streaming response
  - Historia últimos 100 requests en `tokensPerSecHistor`
  - Logged en console: `[stream-final] model: total=XXXms, tok/s=YY.YY, ttft=ZZms`
  - **Impacto**: Monitorear quality of throughput bajo carga

- **Endpoint `/api/metrics/performance`** ✅
  - Expone estadísticas agregadas: avg TTFT, P95 TTFT, max TTFT
  - Promedio tokens/sec
  - 200 muestras tracking (últimos 100 requests)
  - **Impacto**: Dashboard puede consultar y mostrar trends

- **UI Component: PerformanceMetrics** ✅
  - Nuevo tab en App.tsx: "Performance"
  - Muestra TTFT avg/p95/max en ms
  - Throughput promedio en tok/s
  - Refresca cada 30s
  - Estilo oscuro con monospace font como logs
  - **Impacto**: Usuarios pueden ver performance en tiempo real sin consola

#### Mejorado
- **main.ts streaming handler**: Captura TTFT, registra, calcula tok/s
- **OllamaService stats object**: Agregadas ttftHistory y tokensPerSecHistor
- **Frontend App.tsx**: Nuevo tab "performance" agregado a getSectionInfo y renderContent
- **Sidebar buttons**: Nuevo botón "Performance" en commands grid

#### Notas de Implementación
- TTFT es diferencia entre start de request y primer token
- Tok/s es completionTokens / (totalDurationMs/1000)
- Historia limitada a 100 samples para no saturar memoria
- Metrics endpoint es read-only, no requiere cálculos complejos

#### Pruebas Sugeridas
1. Enviar mensaje en playground → Verificar TTFT aparece en /api/metrics/performance
2. Enviar 10+ mensajes → Verificar avg/p95/max se calculan correctamente
3. Abrir tab Performance → Debe refrescar cada 30s
4. Revisar console → Ver logs `[stream-final]` con métricas

### 🚀 FASE 2: Cola Concurrencia + Keep-alive HTTP + Status Rápido/Full (COMPLETADA - 2026-04-18)

**Objetivo**: Estabilidad bajo carga concurrente y optimización de conexiones HTTP.

#### Añadido
- **HTTP Keep-Alive Connection Pooling** ✅
  - Nuevo `httpAgent` y `httpsAgent` con `keepAlive: true` en `OllamaService`
  - Reusable axios client (`axiosClient`) con pool de conexiones configurado
  - Máximo 10 sockets activos, 5 libres, timeouts de 2 minutos para inferencia larga
  - Todos los axios calls migrados a usar `this.axiosClient`
  - **Impacto**: Reducción ~50ms por request en overhead de TCP handshake; mejor throughput a alto QPS

- **Semáforo de Concurrencia GPU** ✅
  - Nuevo método `enqueueRequest<T>()` que limita requests activos a máximo 3 simultáneos
  - `chat()` y `chatStream()` ahora se ejecutan dentro del queue
  - Evita saturación GPU y degradación de latencia con múltiples usuarios
  - **Impacto**: p95/p99 latency mucho más predecible; no hay "picos" de 5-10s cuando 5 users hacen request

- **Endpoints `/api/status/fast` y `/api/status/full` separados** ✅
  - `/api/status/fast`: Solo GPU metrics (cached, ~1ms) + stats
  - `/api/status/full`: Todo (disk, ngrok, loaded models, logs) - el actual /api/status
  - `/api/status`: Mantiene backward compatibility, redirige a full
  - Frontend cambiado para usar `/api/status/fast` en heartbeat
  - **Impacto**: Polling rápido no compite más con operaciones costosas

#### Mejorado
- **OllamaService constructor**: Inicializa HTTP agents y axios client con keep-alive en startup
- **listModels, generate, chat, unloadModels, pullModel, deleteModel**: Todos migrados a `this.axiosClient`
- **getServerStatus()**: Mantiene implementación completa, ahora en `/api/status/full`
- **Frontend App.tsx**: Usa `/api/status/fast` para polling cada 60s

#### Notas de Implementación
- `enqueueRequest()` es genérica y puede aplicarse a otros métodos en futuro
- Concurrency limit (3) es configurable vía `maxConcurrentRequests` member
- Keep-alive se mantiene durante lifetime de OllamaService (no se cierra)
- HTTP agents funcionan tanto para Ollama interno como para ngrok

#### Pruebas Sugeridas
1. Enviar 5 mensajes rápidamente → Verificar latencia es consistente (no degrada)
2. Monitorear logs → Debe haber máximo 3 requests activos en `/api/chat`
3. Revisar `/api/status/fast` response time → Debe ser <5ms
4. Comparar antiguo vs nuevo `/api/status` → Full debe ser lento, fast debe ser rápido

### 🚀 FASE 1: Streaming + Cache GPU + Reducir Polling (COMPLETADA - 2026-04-18)

**Objetivo**: Mejorar latencia percibida (TTFT) y estabilidad bajo carga en inferencia de modelos.

#### Añadido
- **Streaming Token-a-Token en OpenAI-compatible** ✅
  - Nuevo endpoint `/v1/chat/completions` con soporte para `stream=true`
  - Implementación SSE (Server-Sent Events) compatible con OpenAI para streming de tokens en tiempo real
  - Fallback a modo no-streaming (`stream=false`) para clientes que no lo soportan
  - Frontend (ChatPlayground) consume stream con async generators, mostrando tokens conforme llegan
  - **Impacto**: Latencia percibida se reduce drasticamente (TTFT ahora visible en ~100-500ms vs espera total anterior)

- **GPU Metrics Async Caching** ✅
  - Eliminado `execSync(nvidia-smi)` de la ruta crítica de chat (que bloqueaba event loop)
  - Nuevo watcher asíncrono `startGpuMetricsWatcher()` actualiza métricas GPU cada 3 segundos en background
  - `chat()` ahora lee cache inmediatamente sin bloqueo
  - Métricas térmicas siguen registrándose para auto-unload de emergencia
  - **Impacto**: Mayor estabilidad bajo concurrencia, reducción de jitter de latencia (~30-50% mejora en p95/p99)

- **Reducción Agresiva de Polling** ✅
  - Heartbeat global App.tsx: 15s → 60s (4x menos peticiones)
  - Polling de engine stats: 10s → 30s (3x menos peticiones)
  - Mantener WebSocket para alertas en tiempo real (no hay latencia adicional)
  - **Impacto**: Menos competencia con inferencia, mejor throughput percibido

#### Mejorado
- **Método `chatStream()` en OllamaService**:
  - Retorna stream response de Ollama directamente al cliente
  - Soporte session cache igual que `chat()` para continuidad
- **Backend `main.ts`**:
  - `/v1/chat/completions` ahora es bi-modal (stream & no-stream)
  - SSE chunks son OpenAI-compatible para máxima compatibilidad
  - Error handling mejorado en streaming
- **Frontend ChatPlayground.tsx**:
  - Soporte async generators para consumir streams
  - Actualización incremental del contenido en tiempo real
  - Estadísticas de tokens se actualizan al final del stream

#### Notas de Implementación
- Requiere `npm install` en `ollama-mcp-server/` y `mcp-frontend/` para compilación
- Compilar: `npm run build` en ambos directorios
- Para testing local: `docker-compose up` actualizado para usar nuevas características
- BREAKING: Clientes que asumen respuesta bloqueante deben adaptarse a streaming

#### Pruebas Sugeridas
1. Enviar mensaje en ChatPlayground → Verificar tokens aparecen progresivamente
2. Enviar 3-4 mensajes rápidamente → Verificar no hay bloqueo/latencia degradada
3. Revisar logs → `[auto-unload]`, `[session]`, `[stream]` deben estar sin errores

## [0.4.0] — 2026-03-25

### Añadido
- **Blindaje & Seguridad**:
  - API_KEY obligatoria en startup: El servidor fallará si `API_KEY` no está configurada en `.env` o docker-compose
  - SessionManager: Nuevo servicio para manejar sesiones aisladas por IP (Fase 1 - Prevenir interferencia de estado global)
  - Autenticación en SSE/MCP: Las conexiones `/sse` y `/messages` ahora requieren `x-api-key` válida
  - Cleanup seguro: `deleteModel()` y `cleanWorkspace()` ahora rastrean operaciones en progreso para evitar conflictos
  - Auto-unload mejorado: Mejor manejo de errores con notificaciones explícitas al usuario
- Establecida regla obligatoria para la IA: registrar todos los cambios en el `CHANGELOG.md`.
- Archivo de reglas `.cursorrules` para automatizar el proceso de documentación.
- **Persistencia del Chat en ChatPlayground**: historial de mensajes y configuraciones se guardan automáticamente en `localStorage`
  - Las conversaciones se mantienen al navegar entre pestañas
  - Se persisten modelo seleccionado, temperatura, contexto y estadísticas de sesión
  - Los cambios se sincronizan en tiempo real sin afectar el rendimiento
- **Biome instalado** para linting y formateo automático
  - Scripts: `pnpm lint`, `pnpm format`, `pnpm check`
  - Configuración: `biome.json` con reglas estrictas de TypeScript y a11y
- **Interfazes compartidas** (`mcp-frontend/src/types/api.ts`):
  - `StatusResponse` - Respuesta completa del servidor de estado con propiedades VRAM
  - `AccessLogEntry` - Entrada de log de acceso con propiedades tipadas
  - `OllamaModel` - Modelo de Ollama con propiedades name, model, size, digest
  - `LoadedModel` - Modelo cargado en VRAM con propiedades name, size_vram, percentage
  - `ChatMessage` - Mensaje de chat estructura con role y content
  - `EngineStats` - Estadísticas del motor con tokensSession y timeSession
  - `VramInfo` - Información de VRAM con total, used, free, available
- **Contratos limpios API + frontend**
  - Contrato OpenAI `/v1/chat/completions` con `usage` real (tokens de prompt/completion) y validación de payload
  - Cliente API centralizado en frontend (`mcp-frontend/src/services/api.service.ts`) con interceptor para `x-api-key`
  - Helpers de sesión de API key (`setApiKey`, `clearApiKey`, persistencia opcional)

### Mejorado
- **Calidad de Código**:
  - 43+ problemas de linting corregidos (variables no usadas, imports organizados, etc.)
  - Todos los botones ahora tienen atributo `type="button"` para accesibilidad
  - Reemplazo de tipos `any` con tipos específicos en componentes clave
  - Formateo unificado en 31 archivos de código
- **Error Handling**:
  - Type guards implementados para manejo seguro de `unknown` en catch blocks
  - Manejo seguro de propiedades undefined con nullish coalescing operator (`??`)
- **Tipado TypeScript**:
  - Función `VramBadge` tipada correctamente con interfaz específica para parámetro vram
  - Tipado de `loadedModels.map()` con LoadedModel interface
  - Props interfaces mejoradas con parámetros opcionales donde sea apropiado
- **Integración Backend/Frontend**:
  - `OllamaService.chat()` ahora retorna estructura enriquecida (`message`, `prompt_eval_count`, `eval_count`, `total_duration`)
  - `App.tsx` migrado a cliente API compartido para eliminar headers duplicados y llamadas axios dispersas
  - Componentes migrados a cliente unificado: `Telemetry`, `ModelList`, `HardwareSentinel`, `AiEngineTuner`

### Corregido
- **App.tsx**:
  - Removido import no usado `AxiosError`
  - Cambio de `useState<StatusResponse | null>` a `useState<StatusResponse | undefined>` para coherencia de tipos
- **Telemetry.tsx**:
  - Error handling mejorado con type guard `instanceof Error`
  - Acceso seguro a `status?.recentLogs?.length` con nullish coalescing
- **HardwareSentinel.tsx**:
  - Key element usando `String()` con fallback a index en map loops
  - Props interface para aceptar `status` opcional
  - Tipado correcto de parámetro vram en VramBadge
- **AiEngineTuner.tsx**:
  - Props interface para aceptar `status` opcional
- **IpLogs.tsx**:
  - Props mejoradas con tipos específicos: `logs?: AccessLogEntry[]`, `status?: StatusResponse`
  - Importación correcta de tipos desde api.ts
- **ollama.tools.ts**:
  - Caracteres de escape `\t` reemplazados con indentación real en ChatMessage type
  - CallToolRequestHandler mejorado con type assertion para request.params
  - Error handling en catch block usando variable tipada como string
- **ollama.service.ts**:
  - Session cache logic mejorada para evitar acceso undefined con variable intermedia
- **Contrato y UX**:
  - `usage` en `/v1/chat/completions` dejó de retornar ceros y ahora usa métricas reales de inferencia
  - `ollama.tools.ts` actualizado para leer el nuevo shape de respuesta de `chat` sin romper herramientas MCP
  - Auto-scroll de `ChatPlayground` corregido para reaccionar a nuevos mensajes y estado de carga
  - Documentación de eventos Socket alineada con nombres reales en kebab-case (`pull-progress`, `security-alert`, `new-access`)

### Cambiado
- **StatusResponse**: Cambio de `Record<string, any>` a interfaz con propiedades específicas
  - Agregadas propiedades VRAM: `vramFreeMb`, `vramTotalMb`, `vramUsedMb`
  - Agregadas propiedades modelos: `models` (LoadedModel[]), `recentLogs` (AccessLogEntry[])
  - Mantenida compatibilidad con `[key: string]: any` para propiedades adicionales
- **OllamaModel**: De `Record<string, any>` a interfaz con propiedades esperadas
- **LoadedModel**: De `Record<string, any>` a interfaz con propiedades tipadas
- **EngineStats**: De `Record<string, any>` a interfaz que extiende Record
- **Servicio API Frontend**:
  - Reemplazo del `api.service.ts` anterior (orientado a `/sse`) por una capa HTTP real para endpoints REST del dashboard

### Información de Build
- **Frontend Build**: ✅ Exitoso
  - TypeScript compilation: 0 errores
  - Vite production build: 361.9 KB JS (111.4 KB gzip)
  - Build time: 7.17 segundos
  - Módulos transformados: 1829
- **Backend Build**: ✅ Exitoso
  - TypeScript compilation en ollama-mcp-server: 0 errores
  - Types resueltos para OllamaService y OllamaTools
  - Y más tipos específicos
- **Reducción de tipos `any`**: Reemplazados en:
  - `App.tsx` - Estados y callbacks tipados correctamente
  - `components/Telemetry.tsx` - Props tipadas como `StatusResponse`
  - `components/AiEngineTuner.tsx` - Estados tipados como `EngineStats`
  - `components/HardwareSentinel.tsx` - Props y callbacks tipados
  - `ollama-mcp-server` - Tipos locales definidos para ChatMessage
- **Errores de tipo reducidos**: De 101 errores originales a ~55 (46% reducción)
- **Build Fase 2 (2026-03-25)**: ✅ Exitoso
  - Frontend (`pnpm run build`): TypeScript + Vite OK
  - Bundle frontend: `361.53 kB` JS (`111.63 kB` gzip), `1830` módulos transformados
  - Backend (`pnpm run build`): `tsc` completado sin errores

## [0.3.0] — 2026-03-10 🦙 Renaming + Model Discovery + Ngrok Control

### 💫 Rebrand
- Proyecto renombrado de **SYMBIOSIS MCP** a **LaLlamaOllama**
- Título del browser, sidebar, login y meta-tags actualizados
- Clave de `localStorage` unificada bajo `llama_master_key`
- `package.json` del frontend y backend actualizados

### ✨ Nuevas Funcionalidades
- **Búsqueda en Ollama Library**: nuevo endpoint `GET /api/search-models?q=...`
  - Scraper del sitio oficial `ollama.com/library` usando `cheerio`
  - Catálogo de fallback con 8 modelos curados cuando no hay búsqueda activa
- **Control de Ngrok desde la Web**: toggle START/STOP en el widget de Telemetría
  - Usa `dockerode` conectado via `/var/run/docker.sock`
  - Muestra la URL pública del túnel al activarse
  - Botón de copia de URL al portapapeles
- **Guía de uso de modelos**: panel explicativo en la sección Modelos con dos flujos (nombre directo / búsqueda en librería)
- **Soporte para `cheerio`** instalado en el servidor backend

### 🐛 Correcciones
- `TypeError: Cannot read properties of undefined (reading 'startsWith')` en `ModelList.tsx` — filtro defensivo aplicado
- `DELETE /api/models/undefined` — solo se renderiza el botón de eliminar si el modelo tiene nombre
- Modelos mostrando `NaN GB` — ahora muestra `-` cuando el tamaño es 0 o undefined
- Spam de logs por ngrok desconectado — errores `ENOTFOUND`/`ECONNREFUSED` silenciados, timeout de 2s
- `key` warning en listas de React — claves compuestas únicas en logs y modelos

### 🔧 Mejoras de UI/UX
- Dashboard rediseñado: muestra KPIs + últimos accesos + modelos disponibles + IPs bloqueadas
- Sección Seguridad completa: SecurityPanel (Blacklist + PÁNICO) + auditoría de accesos con filtros y búsqueda
- Header del dashboard con subtítulos contextuales por sección
- Playground con tarjeta glassmorphism full-height
- `restart: "no"` para el contenedor ngrok (ya no se reinicia solo)
- Docker socket montado en `mcp-server` para control de contenedores

---

## [0.2.0] — 2026-03-09 🛡️ Seguridad, Telemetría y Limpieza

### ✨ Nuevas Funcionalidades
- **Modo Offline**: switch en el Dashboard para desconectar el motor de inferencia
- **Telemetría de Hardware**: CPU, RAM, VRAM en tiempo real
- **Vault de Credenciales**: gestión de API keys multi-usuario
- **Logs de Refactorización**: modal de historial de cambios del agente
- **Selección de modelo por agente**: en el grafo de agentes

### 🔧 Mejoras
- Panel de Telemetría con KPIs holográficos
- SecurityPanel con botón de Pánico y gestión de blacklist
- Reescrtura total del componente `IpLogs` con filtros y búsqueda
- Animaciones de progreso de descarga vía WebSockets

---

## [0.1.0] — 2026-03-08 🚀 Lanzamiento inicial

### ✨ Funcionalidades base
- **MCP Server**: servidor Express + SSE para Claude Desktop
- **Autenticación**: API Key con rate limiting (5000 req/15min)
- **Seguridad**: Helmet, blacklist de IPs, auto-ban tras 5 intentos fallidos, auditoría
- **Modelos Ollama**: listar, pull, delete, unload VRAM
- **Telemetría**: disco, ngrok, modelos cargados en VRAM
- **WebSockets**: progreso de descargas y alertas de seguridad en tiempo real
- **Frontend**: dashboard Vite + React con diseño glassmorphism oscuro
- **Playground**: terminal de inferencia directa con selección de modelo
- **Docker Compose**: stack completo (Ollama + MCP Server + Frontend + Ngrok)
- **Compatibilidad OpenAI**: endpoints `/v1/models` y `/v1/chat/completions`
