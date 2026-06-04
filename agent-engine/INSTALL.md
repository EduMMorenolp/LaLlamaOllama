# Instalación — Agent Engine

## Requisitos

- Node.js 18+
- npm
- Acceso a un MCP Brain (http://mcp-brain:3015)
- Ollama o API Key de OpenAI/OpenRouter

## Instalación

```bash
cd agent-engine
npm install
```

## Configuración

Variables de entorno (`.env`):

```env
ENGINE_PORT=3020
API_KEY=tu-api-key
BACKEND_URL=http://backend:3016
BRAIN_URL=http://mcp-brain:3015
DEFAULT_MODEL=llama3.2:3b
WORKSPACE_DIR=/workspace
REDIS_URL=redis://localhost:6379  # opcional, para cola
TELEGRAM_BOT_TOKEN=                # opcional
TELEGRAM_ALLOWED_USERS=            # opcional
```

## Desarrollo

```bash
npm run dev
```

## Producción

```bash
npm run build
npm start
```

## Docker

```bash
docker build -t lallamaollama/agent-engine .
docker run -p 3020:3020 --env-file .env lallamaollama/agent-engine
```

## Verificación

```bash
curl http://localhost:3020/health
# → {"status":"ok"}
```
