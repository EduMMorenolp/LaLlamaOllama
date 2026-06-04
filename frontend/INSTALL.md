# Instalación — Frontend

## Requisitos

- Node.js 18+
- npm
- Backend corriendo (puerto 3016)

## Instalación

```bash
cd frontend
npm install
```

## Configuración

Variables de entorno (`.env`):

```env
VITE_API_URL=http://localhost:3016
VITE_WS_URL=http://localhost:3016
VITE_API_KEY=tu-api-key
```

## Desarrollo

```bash
npm run dev
# → http://localhost:5173
```

## Producción

```bash
npm run build
npm run preview
```

## Docker

```bash
docker build -t lallamaollama/frontend .
docker run -p 5173:80 --env-file .env lallamaollama/frontend
```
