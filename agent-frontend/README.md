# Agent Frontend

> Dashboard del agente con chat multi-conversación, agentes configurables, conocimiento, tareas, conexión y memoria.

## Secciones

- **Chat**: conversaciones múltiples con sidebar, búsqueda, pin, renombrar/eliminar. WebSocket en vivo con streaming de tokens y tool calls.
- **Agentes**: Configuración General (modelo, temperatura, límite de historial), Telegram Bot, Tools toggles, CRUD de sub-agentes.
- **Tareas**: historial de ejecuciones del agente con filtros por estado y modal de detalle con línea de tiempo.
- **Conocimiento**: subida de archivos (txt, json, md) con chunking automático e indexación vectorial al MCP Brain.
- **Conexión**: estado WebSocket, CRUD de proveedores de modelos, información del MCP Brain.
- **Memoria**: búsqueda en el Brain (semántico, lexical, híbrido), estadísticas, detalle de memorias.

## Stack

- React 19, Vite 7, TypeScript
- Lucide Icons
- WebSocket nativo

## Puerto

- Dev: `8081`
- Producción: `80` (Docker)
