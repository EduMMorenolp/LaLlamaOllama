# Agent Frontend — Changelog

## [Unreleased]

### 🧠 Cerebro: Gestor visual de memorias con CRUD, timeline y consolidación

#### Añadido
- **➕ `Knowledge.tsx` reescrito** — Nuevo diseño con 3 sub-tabs: `🧠 Cerebro`, `📅 Línea de Tiempo`, `📄 Archivos RAG`
- **➕ Cerebro tab** — Browser de memorias con barra de estadísticas (total + counts por tipo), filtro por tipo, buscador textual
- **➕ Creación de memorias** — Formulario inline con campos: título, contenido, tipo (select), tags
- **➕ Edición y eliminación** — Modal de edición con todos los campos editables; confirmación de eliminación con opción de borrado múltiple (checkboxes + bulk delete)
- **➕ Consolidación manual** — Botón "Consolidar" que dispara `POST /api/memory/consolidate` con feedback visual
- **➕ Timeline view** — Vista cronológica agrupada por día con filtro por tipo
- **➕ Quick‑memo** — Botón flotante "+" para crear memoria rápida sin cambiar de tab
- **🔧 `App.tsx`** — Descripciones de tabs actualizadas: "Cerebro → Memorias, timeline y archivos RAG", "Memoria → Búsqueda avanzada en MCP Brain"

### 🐛 Corrección de bugs y encoding

#### Corregido
- **🐛 Fix: Tareas `/api/runs/undefined`** — `task_created` WS handler ahora mapea correctamente `runId` → `id`, `text` → `userText` y setea valores por defecto
- **🐛 Fix: Memoria "semanticlexicalhybrid"** — Botones de modo de búsqueda ahora muestran etiquetas legibles: "Semántica", "Léxica", "Híbrida"
- **🐛 Fix: Chat mensajes repetidos** — Handlers `tools_list` y `ollama_models` actualizan el último mensaje system en lugar de duplicarlo; keys únicas en vez de `key={i}` para evitar duplicados de renderizado
- **🐛 Fix: Emojis y caracteres corruptos** — Corregidos emoji `🔍` y texto "Chat vacío" en `AgentChat.tsx`

#### Cambiado
- **🔧 `.env.example` actualizado** — `VITE_API_KEY` descomentado con valor `super-secret-mcp-key`

## [1.0.0] — 2026-06-07

### 🚀 Versión estable 1.0.0

Alineación de versión con el proyecto raíz LaLlamaOllama.

### 📱 Telegram: Sección UI en Conexion.tsx

#### Añadido
- **➕ Sección Telegram en Conexion.tsx** — Nueva card con:
  - Badge de estado (Activo/Inactivo) con colores semánticos
  - Input de token (type=password) con placeholder de ejemplo
  - Input de usuarios permitidos separados por coma con ayuda textual
  - Botón principal "Iniciar Bot" / "Detener Bot" según estado actual
  - Botón "Actualizar" para aplicar cambios sin reiniciar
  - Nota informativa con referencia al comando `/ayuda`
- **➕ Handlers WS**: Suscripción a `telegram_status` y `status` (telegramActive)
- **➕ Fetch automático**: Al conectar WebSocket, envía `telegram_get_status`
- **➕ Nuevo state**: `telegramRunning`, `telegramToken`, `telegramAllowedUsers`, `telegramSaving`
- **➕ Icono Send** importado de lucide-react para la sección

### Añadido
- **➕ `/cambioModelo <nombre>`** — Nuevo comando para cambiar modelo activo vía `general_config_update`
- **🎨 `/buscar` estilo Discord** — Sin consulta → input cambia a `/buscar: ` y espera texto como Discord
- **🔧 `/tools` funcional** — Muestra lista formateada de herramientas con nombre + descripción
- **🔧 `/nuevaTarea` funcional** — Crea tarea en DB, muestra confirmación con ID
- **🔄 `/modelo` → `/modelos`** — Lista modelos Ollama disponibles con nombres exactos
- **Handlers WS**: `tools_list`, `ollama_models`, `task_created` agregados
- **💬 Citas / Reply** — Botón "Reply" en cada burbuja, barra contextual sobre el input, `quotedMessage` en payload WS
- **⭐ Favoritos / Saved Messages** — Botón Star toggle (relleno/outline), tracking local con Set, handlers WS save/unsave
- **💡 Sugerencias automáticas** — Chips clicables entre tool calls y "Pensando...". Se llena input al hacer clic
- **🕐 Historial de sesiones** — `messageCount` en ChatEntry, cada chat muestra "📝 N mensajes" en sidebar. Envío automático de `list_sessions` al identificar usuario
- **🔍 Búsqueda dentro del chat** — Barra de búsqueda en el header que filtra mensajes en tiempo real con contador de resultados
- **📤 Exportar conversación** — Botón de descarga que genera archivo Markdown con todo el historial del chat
- **📦 Tool calls colapsables** — Header clickeable con badge de contador; colapsa/expande la lista de herramientas
- **🖼️ Multi-modal (imágenes inline)** — Renderizado de imágenes en el flujo del chat (data:image, Markdown, URLs). Lightbox fullscreen al hacer clic
- **✏️ Editar mensajes enviados** — Click en mensaje de usuario para editarlo con textarea + Guardar/Cancelar. Enter/Escape para acelerar
- **Cola de mensajes (max 3)** — Mientras el agente procesa, los mensajes se encolan y se envían automáticamente al terminar
- **Input siempre activo** — Textarea nunca se deshabilita; placeholder contextual ("Escribe, se encolará...")
- **UI de cola** — Barra con contador N/3, pills por mensaje con ✕ individual, botón "Vaciar cola"
- **Confirmación al cancelar con cola** — Modal "Vaciar todo" vs "Solo cancelar respuesta"
- **Sección "Información del Contenedor"** en Conexión — Grid visual con CPU, RAM, GPU, Disco
- Proyecto standalone Vite + React 19 (puerto 8081)
- Dashboard de 6 secciones con sidebar navegable
- Chat multi-conversación con WebSocket, búsqueda, CRUD, pin
- Agentes: Configuración General, Telegram, Tools, Sub-Agents
- Tareas: listado con filtros, modal de detalle con timeline
- Conocimiento: upload → chunk → index al Brain + búsqueda semántica
- Conexión: WS status, Modelos CRUD, Brain info
- Memoria: búsqueda 3 modos, stats, detalle
- Token counter (▲prompt / ▼output por mensaje + Σ total)
- Auto-creación de chat al enviar primer mensaje
- Configuración General persistente (modelo, temp, history_limit)

### Cambiado
- **📊 Contador de mensajes en header** — Muestra "↓ N ↑ M" (enviados/recibidos) entre el título del chat y los botones. Solo visible cuando hay mensajes
- **Bugfix: switch statement en handleWsMessage** — El `case "error"` estaba fuera del `switch` por una llave `}` prematura. El manejador de errores nunca se ejecutaba. Corregido eliminando la llave extra
- **Chat siempre montado** — `<AgentChat />` usa `display:none` en vez de render condicional, preservando WS subscriptions al cambiar de tab
- **Fix duplicación de respuestas** — `assistant_done` reemplaza el último mensaje del streaming en vez de agregar uno nuevo
- **Eliminado hardcode de modelo en Agentes** — Ya no usa `localStorage` ni fallback `"llama3.2:3b"`; modelo viene siempre del servidor
- **Eliminada pestaña Jarvis** — Asistente de voz removido del dashboard
- Eliminada duplicación Telegram/Tools (ahora solo en Agentes)
- view-header eliminado en Chat (más espacio para mensajes)
- Prompt del chat mejorado: sin preámbulos, tools solo cuando se piden

### Docker
- Dockerfile multi-stage
- Servicio en docker-compose.yml (puerto 8081)

## [Unreleased - Junio 2026]

### Streaming
- **Streaming en tiempo real**: nuevo handler `assistant_chunk` que concatena tokens incrementalmente
- Indicador "Procesando..." solo se muestra cuando no hay mensaje assistant en curso

### Añadido
- **WebSocketContext compartido**: Provider único en `main.tsx`, eliminadas 3 conexiones WS redundantes
- **Jarvis funcional**: Speech-to-Text (Web Speech API) + envío por WS + TTS automático
- **ErrorBoundary**: componente clase en todas las vistas con UI de reintento
- **Toast notifications**: sistema de notificaciones toast con auto-dismiss (success/error/info)
- **ConfirmModal**: modal personalizado reemplaza `confirm()` nativo en Chat y Knowledge
- **Paginación**: botón "Cargar más" en Tareas y Memoria
- **Markdown rendering**: mensajes del asistente renderizados con react-markdown + remark-gfm
- **Tooltips**: en todos los botones de icono (Send, Cancel, Attach, etc.)
- **Footer stats**: contador de tokens y hora actual en el chat

### Cambiado
- Llamadas a Brain redirigidas a través del Engine (proxy `/api/memory/*`)
- Header `X-API-Key` añadido a todas las peticiones REST
- `config.ts` ahora lee `VITE_API_KEY` y `VITE_BRAIN_URL`
- **Idioma unificado a español**: textos en inglés reemplazados (Connected, Stop, Tool Calls, etc.)
- Filtros de Tareas en español (Todas, En cola, Ejecutando, Completado, Fallido)
