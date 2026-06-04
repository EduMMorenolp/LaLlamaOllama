# Agent Engine

> Agente de código autónomo con tool calling multi-turno, memoria persistente y soporte multi-provider.

## Funcionalidades

- **Agent Loop**: razonamiento multi-turno (máx 10 iteraciones) con compactación de contexto automática
- **Tool Registry**: 8 herramientas integradas (bash, read/write-file, glob, grep, read-url, delegate, memorización)
- **Multi-provider**: Ollama, OpenAI y OpenRouter con detección automática
- **Chat persistente**: conversaciones en SQLite con historial configurable
- **Sub-agentes**: agentes especializados con modelo y system prompt propios
- **Telegram Bot**: comando /start, /agentes, /crear_agente, /status, /tools y más
- **Cola BullMQ**: ejecución asíncrona con Redis (opcional)
- **WebSocket**: streaming de respuestas, tool calls, estados en tiempo real
- **REST API**: health, tools, runs, knowledge endpoints

## Stack

- Node.js 18+, Express 4, TypeScript (NodeNext)
- better-sqlite3, OpenAI SDK, node-telegram-bot-api
- bullmq + ioredis (opcional)

## Puerto

- WebSocket/REST: `3020`
