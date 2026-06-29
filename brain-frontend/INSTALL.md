# Brain Frontend — Instalación

## Con Docker Compose

```bash
docker compose up -d brain-frontend
```

## Desarrollo local

```bash
cd brain-frontend
npm install
npm run dev
```

## Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `VITE_BRAIN_URL` | `http://localhost:3015` | URL del MCP Brain API |

## Build producción

```bash
npm run build
docker build -t lallamaollama-brain-frontend .
```