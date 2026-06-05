# Agent Frontend — Changelog

## [Unreleased]

### Añadido
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
