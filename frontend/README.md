# Frontend

> Dashboard principal de LaLlamaOllama con monitoreo y control.

## Secciones

- **Dashboard**: métricas del sistema (CPU, VRAM, disco, tráfico)
- **Playground**: chat interactivo con streaming y selección de modelos
- **Agentes**: CRUD de sub-agentes configurables
- **Telegram**: bot configurable con modelos y prompts
- **Tools**: herramientas personalizadas con templates
- **Seguridad**: logs de intentos, blacklist, auto-ban stats
- **Historial**: conversaciones persistidas con filtros

## Stack

- React 19, Vite 7, TypeScript
- Recharts, Socket.IO Client
- Estética Glassmorphism

## Puerto

- Dev: `5173`
- Producción: `80` (Docker)
