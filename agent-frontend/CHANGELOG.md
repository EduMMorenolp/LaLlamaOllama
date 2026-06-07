# Agent Frontend — Changelog

## [Unreleased]

### Añadido
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
