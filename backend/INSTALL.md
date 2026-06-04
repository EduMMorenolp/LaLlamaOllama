# Instalación — Backend

## Requisitos

- Node.js 18+
- npm
- Ollama (local o remoto)
- Docker (para control de ngrok vía dockerode)

## Instalación

```bash
cd backend
npm install
```

## Configuración

Variables de entorno (`.env`):

```env
PORT=3016
API_KEY=tu-api-key
OLLAMA_URL=http://ollama:11434
NGROK_AUTHTOKEN=           # opcional
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
docker build -t lallamaollama/backend .
docker run -p 3016:3016 -v /var/run/docker.sock:/var/run/docker.sock --env-file .env lallamaollama/backend
```

## Verificación

```bash
curl -H "x-api-key: tu-api-key" http://localhost:3016/api/status/fast
```
