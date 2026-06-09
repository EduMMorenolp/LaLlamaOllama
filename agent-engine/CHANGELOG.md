# Agent Engine — Changelog

## [Unreleased]

### 🐛 Corrección de bugs y encoding

#### Corregido
- **🐛 Fix: Knowledge Upload 401** — Agregado `/knowledge/` a las exclusiones del `authMiddleware` en `api.ts` para que el upload de archivos funcione sin API key
- **🐛 Fix: Emojis corruptos en labels de modos por defecto** — Reemplazadas secuencias UTF-8 corruptas por caracteres reales: `🧑 Asistente`, `👨‍💻 Desarrollador`, `🔍 Investigador`, `🧬 Evolutivo`. También corregidos todos los acentos ilegibles en los `system_prompt`

#### Cambiado
- **🔧 `.env.example` actualizado** — `API_KEY` por defecto cambiado a `super-secret-mcp-key` para coincidir con docker-compose

## [1.0.0] — 2026-06-07

### 🚀 Versión estable 1.0.0

Alineación de versión con el proyecto raíz LaLlamaOllama.

### 📱 Telegram: Fixes + Persistencia en DB + Nuevo handler WS

#### Corregido
- **🐛 Fix: telegram_get_status mostraba config vacía** — Usaba `config` local de `loadConfig()` (valores de env) en vez de `getTelegramConfig()` de bot.ts que lee el runtime `_config` actualizado
- **🐛 Fix: telegram_update no persistía cambios** — Los cambios de token/usuarios por frontend se perdían al reiniciar el contenedor

#### Añadido
- **➕ `getTelegramConfig()` en bot.ts** — Expone `token`, `allowedUsers`, `running` desde el runtime config
- **➕ Persistencia en DB** — `telegram_update` ahora guarda `telegram_bot_token` y `telegram_allowed_users` en la tabla `settings` de SQLite. Al iniciar, si no hay token en `.env`, se carga desde DB

### 📱 Telegram: Fixes + Nuevo handler WS

#### Corregido
- **🐛 Fix: brain null en callbacks.ts** — `handleCallbackQuery` ahora recibe `brain: BrainClient | null`. Se agregó guard contra brain null con mensaje de error al chat. Se eliminó `null as never` en `runAgent()`
- **🐛 Fix: telegram_update** — Ya no muta `process.env.TELEGRAM_BOT_TOKEN` directamente. Usa `setTelegramConfig()` para actualizar config en runtime

#### Añadido
- **➕ `setTelegramConfig(token, allowedUsers)`** en bot.ts — Actualiza `_config.telegramBotToken` y `_config.telegramAllowedUsers` en memoria
- **➕ Handler WS `telegram_get_status`** — Devuelve `active`, `running`, `allowedUsers`, `tokenPreview`
- **➕ `telegram_status`** en protocol.ts — Nuevo tipo de mensaje servidor → cliente
- **➕ `telegram_get_status`** en protocol.ts — Nuevo tipo de mensaje cliente → servidor
- **🔧 `telegram_update` ahora acepta `allowedUsers`** array de strings

#### Cambiado
- **🔧 `get_status`** ahora usa `getBot() !== null` en vez de `!!process.env.TELEGRAM_BOT_TOKEN` para reportar estado real del bot

### Añadido
- **➕ Handler WS `new_task`** — Crea un run en la DB con estado "queued". Responde con `task_created`
- **💬 Reply / Quoted Messages** — Campo `quotedMessage` en `AgentOptions`. El contenido citado se inyecta como blockquote en el prompt del agente. Extraído del payload WS en `user_message`
- **⭐ Favoritos / Saved Messages** — Nueva tabla `saved_messages` en SQLite. Archivo `savedMessages.ts` con 4 funciones DB. 4 handlers WS: `save_message`, `unsave_message`, `list_saved_messages`, `is_message_saved`
- **💡 Auto Suggestions** — Nuevo servicio `services/agent/suggestions.ts`. Genera 2-3 preguntas de seguimiento vía LLM. Se dispara async después de `assistant_done`. Evento WS `suggestions`
- **🕐 Session History** — Función `getChatWithStats()` en `chats.ts`. Handler WS `list_sessions` que retorna todos los chats del usuario con `messageCount`
- **Nuevo servicio `docker-info.ts`** — Detección automática del entorno Docker (cgroup, CPUs, RAM, GPU, disco) al iniciar
- **Nueva tabla `settings` en SQLite** — Almacenamiento key-value persistente para `docker_info` y otras configuraciones
- **`AppConfig` ahora incluye `dockerInfo`** — Configuración del entorno disponible en todo el runtime
- **`RuntimeContext` extendido** — Incluye `dockerInfo` y nueva función `getDockerInfo()`
- **Nuevo handler WS `get_docker_info`** — Expone la info del contenedor al frontend
- General config persistente (`__general__` expert): modelo, temperatura, límite de historial
- Endpoints REST `/api/runs`, `/api/runs/:id`, `/api/knowledge` (CRUD)
- Servicio `services/knowledge/index.ts` — chunking e indexación al Brain
- WS handlers `get_general_config` / `general_config_update`
- Campo `history_limit` en tabla `sub_agents` (migración automática)

### Cambiado
- **`buildPrompt.ts`**: sección "Uso de herramientas - CRÍTICO" con regla de oro, prohibiciones explícitas, y ejemplos concretos. Nueva sección "Sistema de Tareas y Conocimiento" con comandos Slash
- **`read-url.ts`**: nueva función `htmlToText()` para limpiar HTML/JS. User-Agent actualizado a Chrome 125 real. Detección automática de contenido HTML
- **`buildPrompt.ts`**: instrucción explícita para usar `tool_calls` cuando el usuario pida ejecutar herramientas, en vez de describirlas en texto
- **`get_status`**: ahora usa `gc?.model || config.defaultModel` (DB) en lugar de solo `config.defaultModel` (env var), consistente con el handler `identify`

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

### Streaming
- **Streaming real activado**: `stream: true` en OpenAI API, procesamiento `for await...of` con emisión de chunks vía WebSocket
- `onChunk` callback ahora se invoca correctamente (antes estaba cableado pero nunca se llamaba)
- Soportes tool calls en streaming: acumulación de deltas, reconstrucción de llamadas

### Añadido
- Autenticación REST con API Key via header `X-API-Key` (salta `/health`)
- CORS configurado con orígenes permitidos (variable `ALLOWED_ORIGINS`)
- Rate limiting (100 req/min) en endpoints `/api`
- Endpoints proxy a Brain: `GET /api/memory/search` y `GET /api/memory/stats`
- Handler WebSocket `list_tasks` con filtros status/limit/offset
- Manejador global de errores Express
- Archivo `.env.example` con todas las variables documentadas

### Cambiado
- Eliminados módulos muertos: `services/sessions/` y `services/execution/`
- `cron.ts` ahora hace session cleanup real (llama a `resetAllSessions()`)
- Imports dinámicos en `runAgentCore.ts` migrados a estáticos (mejora performance)
- Límite de sesiones reducido: cleanup preventivo cuando >80 entradas
- Type assertions `as never` eliminadas (5 ocurrencias reemplazadas con tipos concretos)
- `brainUrl` ahora lee `VITE_BRAIN_URL` con fallback a `BRAIN_URL`

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
