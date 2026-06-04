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
