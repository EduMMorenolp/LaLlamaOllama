# Instalación — Agent Frontend

## Requisitos

- Node.js 18+
- npm
- Agent Engine corriendo (puerto 3020)

## Instalación

```bash
cd agent-frontend
npm install
```

## Configuración

Variables de entorno (`.env`):

```env
VITE_ENGINE_URL=http://localhost:3020
VITE_BRAIN_URL=http://localhost:3015
```

## Desarrollo

```bash
npm run dev
# → http://localhost:8081
```

## Producción

```bash
npm run build
npm run preview
```

## Docker

```bash
docker build -t lallamaollama/agent-frontend .
docker run -p 8081:80 --env-file .env lallamaollama/agent-frontend
```
