# Agent Engine — Changelog

## [Unreleased]


### 🔧 npm audit fix — 0 vulnerabilidades

#### Cambiado
- **`node-telegram-bot-api` 0.66.0 → 1.1.1** — Migración a versión mayor que elimina 14 vulnerabilidades. Breaking change: callbacks → promises, tipos exportados directamente (se eliminó `@types/node-telegram-bot-api`).
- **`@xenova/transformers` 2.17.2 → `@huggingface/transformers` 4.2.0** — Paquete renombrado por archivación del original (`@xenova/transformers` archivado). `quantized: true` reemplazado por `dtype: "q8"`.
- **Código actualizado**: `bot.ts`, `callbacks.ts`, `commands.ts` (type imports), `transcriber.ts` (import path + opciones).

#### Corregido
- **14 vulnerabilidades npm audit** — Reducidas a 0 (7 moderate, 4 high, 3 critical).
- **TypeScript compila con 0 errores** — Package-lock.json regenerado.
### 🧵 Retención de hilo: Sesiones persistentes y resúmenes de contexto

#### Eliminado
- **🗑️ `cron.ts`** — Eliminado cron job que reseteaba TODAS las sesiones cada 30 minutos (causa raíz de pérdida de contexto)

#### Cambiado
- **🔧 `db.ts`** — Aumentado session TTL de 30 min a 24h; purge solo de sesiones inactivas > 24h
- **🔧 `buildPrompt.ts`** — Inyección de `<session_summary>` desde mcp-brain en system prompt; recordatorio de `memorize` reforzado
- **🔧 `runAgentCore.ts`** — Guardado automático de resúmenes en mcp-brain al alcanzar umbrales de contexto (80K chars / 60 mensajes)
- **🔧 `prompts.ts`** — Recordatorio de `mem_save` después de tool calls relevantes

### 👤 Perfil de Usuario: Aprendizaje automático y personalización evolutiva

#### Añadido
- **➕ Columnas en tabla `users`** — 11 nuevas columnas: `persona`, `language`, `interests`, `dislikes`, `communication_style`, `tone_preference`, `interaction_count`, `last_topics`, `average_sentiment`, `model_preference`, `metadata`
- **➕ `userLearning.ts`** — Nuevo servicio de auto-aprendizaje post-respuesta que extrae temas, analiza sentimiento, detecta estilo de comunicación (técnico/casual/formal) y persona (desarrollador/estudiante/escritor/diseñador/emprendedor/sysadmin)
- **➕ `afterResponseLearning()`** — Se ejecuta automáticamente tras cada respuesta exitosa del agente, actualizando `interaction_count`, `last_topics`, `average_sentiment` y guardando memorias `user_profile` en mcp-brain
- **➕ Perfil combinado en system prompt** — Se inyecta `<user_profile>` con datos de la DB local + memorias de mcp-brain al iniciar cada sesión
- **➕ `updateUserStats()` / `updateUserPreferences()`** — Nuevas funciones en `users.ts` para actualizar estadísticas y preferencias de usuario atómicamente
- **➕ `formatUserProfileForPrompt()`** — Convierte el perfil estructurado a texto legible para el prompt del LLM
- **➕ Handler WS `user_feedback`** — Permite al frontend enviar preferencias explícitas del usuario (persona, estilo, tono, intereses, disgustos, modelo) que se persisten al instante en DB y mcp-brain

#### Cambiado
- **🔧 `buildPrompt.ts`** — Sección `Memoria Proactiva` reforzada con lista detallada de qué memorizar (datos personales, estilo, intereses, disgustos, tono, persona, modelo preferido)
- **🔧 `runAgentCore.ts`** — Refactor del cálculo de `userId` como variable temprana para reutilización en toda la función

### 🧠 Resúmenes automáticos de sesiones + Workspace persistente + Feedback loop + Búsqueda FTS

#### Añadido
- **➕ `sessionSummary.ts`** — Genera resúmenes de conversación vía LLM cuando el contexto supera 80K chars o 60 mensajes. El resumen se inyecta como `<session_summary>` en el system prompt. Fallback a resumen estadístico si el LLM falla
- **➕ Tabla `workspace_context`** — Persiste proyecto, último archivo, último directorio, archivos abiertos (top 10) y tags por usuario
- **➕ `workspace.ts`** — Funciones `getWorkspaceContext()`, `upsertWorkspaceContext()`, `trackFileAccess()`, `formatWorkspaceForPrompt()`
- **➕ Tracking automático en `read_file`, `write_file`, `edit_file`** — Cada acceso a archivo actualiza el workspace context del usuario
- **➕ Inyección de `<workspace_context>`** en system prompt al iniciar sesión
- **➕ Tabla `message_feedback`** — Almacena ratings 👍/👎 por usuario, chat y mensaje con razón opcional
- **➕ `feedback.ts`** — Funciones `saveFeedback()`, `getFeedbackStats()`, `getRecentFeedback()`
- **➕ Handler WS `message_feedback`** — Recibe ratings del frontend y los persiste
- **➕ Ajuste automático de `tone_preference`** — `userLearning.ts` analiza el ratio de feedback positivo/negativo y ajusta el tono (si +80% → cálido, si -30% → neutral)
- **➕ FTS5 en `messages`** — Virtual table `messages_fts` con triggers de sync INSERT/UPDATE/DELETE y población inicial de datos existentes
- **➕ `searchMessages()` / `countSearchResults()`** — Búsqueda full-text en historial de chats con snippets, ranking y paginación
- **➕ Handler WS `search_messages`** — Busca en todos los mensajes del usuario o globalmente

### 🧠 Modos, Recordatorios y Prompt Engineering

#### Añadido
- **➕ Tool `switch_mode`** — Nueva herramienta que permite al agente cambiar de modo cuando el usuario lo solicita explícitamente
- **➕ Inyección dinámica de modos** — El agente ahora conoce todos los modos disponibles y sus herramientas, puede sugerir cambios cuando falta una capability
- **➕ `schedule_task` + `notify_telegram`** en modo `asistente` — El modo por defecto ahora puede programar recordatorios y enviar notificaciones por Telegram
- **➕ `switch_mode`** en modo `asistente` — Permite cambiar a otros modos cuando el usuario lo pide

#### Cambiado
- **🔧 System prompts reestructurados con XML tags** — Todos los modos (`asistente`, `coach-personal`, `investigador`, `evolutivo`) ahora usan `<role>`, `<purpose>`, `<style>`, `<capabilities>` siguiendo best practices de Anthropic y OpenAI
- **🔧 `buildPrompt.ts` reescrito con XML tags** — Separación clara en secciones: `<role>`, `<style>`, `<tool_use>`, `<behavior>`, `<safety>`, `<context>`

#### Corregido
- **🐛 Fix: `notify_telegram` con chat_id específico** — Ahora convierte strings numéricos a `number` antes de `sendMessage`

#### Añadido
- **➕ 4 nuevos métodos en `BrainClient`** — `getMemory(id)`, `updateMemory(id, data)`, `deleteMemory(id)`, `getTimeline(type?)`
- **➕ 5 nuevos endpoints REST proxy** — `POST /api/memory` (crear), `GET /api/memory/:id` (obtener), `PUT /api/memory/:id` (actualizar), `DELETE /api/memory/:id` (eliminar), `GET /api/memory/timeline` (timeline cronológico)
- **➕ Consolidate proxy** — `POST /api/memory/consolidate` que proxea a mcp-brain
- **➕ `offset` en proxies** — `search` y `timeline` reenvían `offset` para paginación
- **➕ WS broadcast** — Emite `memory_changed` tras POST/PUT/DELETE/consolidate
- **➕ Tools `update_memory` y `delete_memory`** — Nuevas tools del agente para editar/eliminar memorias
- **🔧 `authMiddleware`** — Añadido `req.path === "/memory"` a la whitelist para que POST /api/memory funcione sin API key
- **🔧 Orden de arranque** — `WsServer` creado antes de `startApiServer`, se inyecta como tercer parámetro

### 📱 Telegram: Adjuntos multi-modal, Whisper, typing persistente y reacciones

#### Añadido
- **➕ Transcripción de audio con Whisper** — Nuevo `src/services/telegram/transcriber.ts`. Al recibir un `voice` o `audio` por Telegram, se transcribe automáticamente vía Ollama (`whisper-small`). Cachea resultados en SQLite por `file_id` (`src/services/telegram/cache.ts`). Si el modelo no está descargado, hace auto-pull vía `POST /api/pull`
- **➕ Tool pública `transcribe_audio(file_path)`** — Nueva `src/services/tools/transcribe-audio.ts`. Cualquier agente puede transcribir archivos de audio del workspace
- **➕ Adjuntos como base64 data URI** — Todos los archivos (imágenes, documentos, audio, video) se leen del disco y se convierten a `data:...;base64,...` en vez de pasar rutas
- **➕ Reacciones en mensajes Telegram** — 🕐 al comenzar a procesar, ✅ al responder, ❌ si hay error. Logging para diagnóstico (`[TG-Reaction]`)
- **➕ Typing indicator persistente** — `setInterval` cada 4s mantiene el "escribiendo..." visible durante todo el procesamiento

#### Cambiado
- **🔧 Adjuntos multi-modal en backend proxy** — El esquema Zod (`chat.ts`) ahora acepta `content` como `string | ContentPart[] | null`. `convertToOllamaMessages()` extrae imágenes y las envía como `images[]` en el formato nativo de Ollama
- **🔧 Ya no hay detección de modelo visión** — Todos los modelos reciben imágenes como `image_url`. El backend proxy convierte automáticamente al formato Ollama

#### Corregido
- **🐛 Fix: Imágenes por Telegram fallaban con 400** — El proxy backend rechazaba contenido array multi-modal. Ahora acepta `ContentPart[]` y convierte a `images[]` de Ollama
- **🐛 Fix: Whisper model not found** — Auto-pull de `whisper-small` si no está descargado, con reintento automático
- **🐛 Fix: Typing indicator se cortaba a los 5s** — Ahora se refresca cada 4s con `setInterval` y se detiene al terminar

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

