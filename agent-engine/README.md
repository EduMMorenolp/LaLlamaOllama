# Agent Engine

> Agente de código autónomo con tool calling multi-turno, memoria persistente y soporte multi-provider.  
> **v3:** Conexión directa a Ollama (sin proxy Backend), Skills System y Task Management integrados.

## Funcionalidades

- **Agent Loop**: razonamiento multi-turno (máx 10 iteraciones) con compactación de contexto automática
- **Tool Registry**: 37+ herramientas integradas (bash, read/write-file, glob, grep, read-url, skills, tasks, etc.)
- **Multi-provider**: Ollama (conexión directa nativa), OpenAI y OpenRouter con detección automática
- **Skills System**: memoria procedural que aprende y reutiliza flujos de trabajo
- **Task Management**: 5 herramientas nativas para gestionar tareas del usuario
- **Chat persistente**: conversaciones en SQLite con historial configurable
- **Sub-agentes**: agentes especializados con modelo y system prompt propios
- **Telegram Bot**: comando /start, /agentes, /crear_agente, /status, /tools y más
- **Cola BullMQ**: ejecución asíncrona con Redis (opcional)
- **WebSocket**: streaming de respuestas, tool calls, estados en tiempo real
- **REST API**: health, tools, runs, knowledge endpoints
- **Perfil de usuario**: aprendizaje automático de preferencias, persona y estilo

## Stack

- Node.js 18+, Express 4, TypeScript (NodeNext)
- better-sqlite3, node-telegram-bot-api
- bullmq + ioredis (opcional)

## Puerto

- WebSocket/REST: `3020`
