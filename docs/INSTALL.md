# Instalación y Configuración

Guía completa para instalar, configurar y desplegar LaLlamaOllama.

## Requisitos

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| RAM | 8 GB | 16 GB+ |
| GPU | - | NVIDIA con 8 GB VRAM |
| Docker | 24+ | 27+ |
| Node.js (dev) | 18 | 20 LTS |
| Espacio en disco | 10 GB | 50 GB (modelos) |

## Stack de servicios

```
agent-frontend  →  puerto 8081  (dashboard agente)
frontend        →  puerto 8080  (dashboard admin)
agent-engine    →  puerto 3020  (agente de código)
backend         →  puerto 3016  (API + MCP server)
mcp-brain       →  puerto 3015  (memoria persistente)
ollama          →  puerto 11434 (LLM runtime)
ngrok           →  -            (túnel opcional)
```

---

## Inicio rápido (Docker Compose)

### 1. Clonar y configurar

```bash
git clone https://github.com/tu-usuario/lallamaollama.git
cd lallamaollama
cp .env.example .env
```

### 2. Editar `.env`

Variables obligatorias:

```env
API_KEY=tu-api-key-segura
BACKEND_URL=http://backend:3016
BRAIN_URL=http://mcp-brain:3015
ENGINE_URL=http://agent-engine:3020
DEFAULT_MODEL=llama3.2:3b
```

### 3. Levantar todo

```bash
docker compose up -d
```

Esto inicia: `agent-frontend`, `frontend`, `agent-engine`, `backend`, `mcp-brain`, `ollama` y opcionalmente `ngrok`.

### 4. Acceder

| Servicio | URL |
|----------|-----|
| Agente Dashboard | http://localhost:8081 |
| Admin Dashboard | http://localhost:8080 |
| Agent Engine WS | ws://localhost:3021 |
| API Backend | http://localhost:3016 |
| MCP Brain | http://localhost:3015 |
| Ollama API | http://localhost:11434 |

---

## Configuración del Agent Engine

### Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `ENGINE_PORT` | `3020` | Puerto del servidor WebSocket |
| `API_KEY` | `""` | API Key para autenticación |
| `BACKEND_URL` | `http://backend:3016` | URL del backend Ollama |
| `BRAIN_URL` | `http://mcp-brain:3015` | URL del MCP Brain |
| `DEFAULT_MODEL` | `llama3.2:3b` | Modelo por defecto |
| `WORKSPACE_DIR` | `/workspace` | Directorio de trabajo |
| `REDIS_URL` | `redis://localhost:6379` | (opcional) Para cola BullMQ |
| `TELEGRAM_BOT_TOKEN` | `""` | (opcional) Token del bot de Telegram |
| `TELEGRAM_ALLOWED_USERS` | `""` | (opcional) Usuarios permitidos en Telegram |

### Configuración desde la UI (Agentes)

Desde el tab **Agentes** del Agent Dashboard (`http://localhost:8081`):

- **Modelo**: nombre del modelo (ej: `llama3.2:3b`, `gpt-4`, `openrouter/anthropic/claude-3`)
- **Temperatura**: slider de 0.0 (preciso) a 2.0 (creativo)
- **Límite de historial**: cantidad de mensajes anteriores que el agente recuerda (5-100)
- **Sub-agentes**: agentes especializados con modelo y system prompt propios

---

## Configuración del MCP Brain

### Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3015` | Puerto del servidor |
| `OLLAMA_URL` | `http://ollama:11434` | URL de Ollama para embeddings |
| `EMBED_MODEL` | `nomic-embed-text` | Modelo de embeddings |
| `HOST_IP` | `localhost` | IP del host (para SSE remoto) |
| `CLAUDE_CONFIG_PATH` | (automático) | Ruta a config de Claude |
| `ROOCODE_CONFIG_PATH` | (automático) | Ruta a config de RooCode |

---

## Despliegue Docker detallado

### Servicios y sus Dockerfiles

```yaml
servicios:
  agent-frontend:  ./agent-frontend/Dockerfile   → :8081
  frontend:        ./frontend/Dockerfile          → :8080
  agent-engine:    ./agent-engine/Dockerfile      → :3020
  backend:         ./backend/Dockerfile            → :3016
  mcp-brain:       ./mcp-brain/Dockerfile          → :3015
  ollama:          imagen oficial ollama/ollama    → :11434
```

### Build individual

```bash
# Agent Frontend
cd agent-frontend
docker build -t lallamaollama/agent-frontend .

# Agent Engine
cd agent-engine
docker build -t lallamaollama/agent-engine .

# Frontend admin
cd frontend
docker build -t lallamaollama/frontend .

# Backend
cd backend
docker build -t lallamaollama/backend .

# MCP Brain
cd mcp-brain
docker build -t lallamaollama/mcp-brain .
```

### Desarrollo sin Docker

```bash
# 1. Instalar dependencias de cada servicio
cd agent-engine && npm install
cd ../agent-frontend && npm install
cd ../backend && npm install
cd ../frontend && npm install
cd ../mcp-brain && npm install

# 2. Iniciar Ollama aparte
ollama serve

# 3. Iniciar servicios (cada uno en su terminal)
cd agent-engine && npm run dev    # puerto 3020
cd agent-frontend && npm run dev  # puerto 8081
cd backend && npm run dev         # puerto 3016
cd frontend && npm run dev        # puerto 8080
cd mcp-brain && npm run dev       # puerto 3015
```

---

## Solución de problemas

### Error: `WebSocket connection failed`

Verificar que `agent-engine` esté corriendo y accesible:

```bash
curl http://localhost:3020/health
```

Si usás Docker, revisá que los puertos estén expuestos:

```bash
docker compose ps
docker logs agent-engine
```

### Error: `MCP Brain not reachable`

```bash
curl http://localhost:3015/health
```

Si el Brain no responde, verificá la DB:

```bash
docker compose exec mcp-brain ls -la /data/
```

### Error: `No models available`

Asegurate de tener al menos un modelo en Ollama:

```bash
docker compose exec ollama ollama pull llama3.2:3b
```

### Error de compilación TypeScript

```bash
# Limpiar caché y rebuild
cd agent-engine && npx tsc --noEmit
cd agent-frontend && npx vite build
```

### Error: `API_KEY required`

Agregá `API_KEY` a tu archivo `.env`. Sin una API Key válida, el backend rechazará las conexiones.

---

## Variables de entorno completas

Ver `.env.example` en la raíz del proyecto para todas las variables disponibles.

```env
# Seguridad
API_KEY=tu-api-key

# URLs de servicios
BACKEND_URL=http://backend:3016
BRAIN_URL=http://mcp-brain:3015
ENGINE_URL=http://agent-engine:3020

# Modelo
DEFAULT_MODEL=llama3.2:3b

# Telegram (opcional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_USERS=

# Ngrok (opcional)
NGROK_AUTHTOKEN=

# MCP Brain
EMBED_MODEL=nomic-embed-text
HOST_IP=192.168.0.x
```
