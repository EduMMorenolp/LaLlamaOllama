# Backend

> Proxy Ollama + MCP Server + Seguridad + Telemetría. Gateway principal para el runtime de LLMs.

## Funcionalidades

- **OpenAI Compatible**: endpoints `/v1/models` y `/v1/chat/completions` con streaming SSE
- **Gestión de Modelos**: buscar, descargar, eliminar desde API REST
- **Telemetría**: monitoreo de VRAM, GPU, disco, tráfico de red
- **Seguridad**: API Key auth, rate limiting, blacklist de IPs, auto-ban
- **Ngrok**: túnel externo controlable vía API
- **MCP Tools**: 7 herramientas estándar (list_models, pull_model, generate, chat, unload, get_status, delete)

## Stack

- Node.js 18+, Express 4, TypeScript
- Socket.io 4, Dockerode, Cheerio
- Helmet, @modelcontextprotocol/sdk

## Puerto

- REST/MCP/SSE: `3016`
