# LaLlamaOllama

> **Panel de control local para modelos LLM de Ollama con seguridad avanzada, telemetría en tiempo real y memoria persistente.**

[![Version](https://img.shields.io/badge/version-0.5.0-blue?style=flat-square)](./CHANGELOG.md)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?style=flat-square&logo=docker)](./docker-compose.yml)

---

## Que es LaLlamaOllama?

LaLlamaOllama es un servidor de control (**Model Control Panel**) que envuelve a [Ollama](https://ollama.com) con:

- **Dashboard Web**: interfaz de administracion premium con glassmorphism
- **Gestor de Modelos**: busca, descarga y elimina modelos directamente desde el dashboard
- **Telemetria**: monitor de disco, VRAM, trafico y sesiones activas
- **Seguridad**: autenticacion por API Key, blacklist de IPs, auto-ban, rate limiting
- **Performance Metrics**: TTFT, throughput tok/s en tiempo real
- **Streaming**: tokens en vivo via SSE compatible con OpenAI
- **Cerebro MCP**: memoria persistente con busqueda semantica, fases SDD, directivas centrales, consolidacion proactiva y auto-sincronizacion con IDEs (Cursor, Claude, Antigravity)
- **Tunel Ngrok**: expone el servidor al exterior con un click desde la web

---

## Inicio Rapido

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/lallamaollama.git
cd lallamaollama

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tu API_KEY y NGROK_AUTHTOKEN (opcional)

# 3. Levantar el stack completo
docker compose up -d

# 4. Acceder al Dashboard
open http://localhost:8080
```

---

## Estructura del Proyecto

```
LaLlamaOllama/

├── backend/                    # Backend Express + TypeScript + MCP SDK
│   └── src/
│       ├── main.ts             # Entry point (Express + endpoints + SSE)
│       ├── app.module.ts       # Modulo NestJS-style
│       ├── auth/               # Autenticacion API Key
│       ├── ollama/
│       │   ├── ollama.service.ts   # Servicio Ollama (GPU, colas, cache)
│       │   └── ollama.tools.ts     # MCP Tools catalog (7 tools)
│       ├── session/            # Session Manager por IP
│       └── memory/             # Sistema de memoria SQLite
│
├── frontend/                   # Dashboard React 19 + Vite 7
│   └── src/
│       ├── App.tsx             # Componente raiz + routing + auth
│       ├── components/         # 10 componentes UI
│       │   ├── Telemetry.tsx          # KPIs + control ngrok/Ollama
│       │   ├── ChatPlayground.tsx     # Terminal de inferencia con streaming
│       │   ├── ModelList.tsx          # Gestion de modelos
│       │   ├── SecurityPanel.tsx      # Blacklist + panico
│       │   ├── IpLogs.tsx             # Auditoria de accesos
│       │   ├── HardwareSentinel.tsx   # Monitor GPU/VRAM
│       │   ├── AiEngineTuner.tsx      # Consumo energetico
│       │   ├── PerformanceMetrics.tsx # TTFT, throughput
│       │   ├── BrainConsole.tsx       # Cerebro MCP UI
│       │   └── ConnectionPanel.tsx    # Configuracion de conexion
│       ├── services/
│       │   ├── api.service.ts         # Cliente Axios centralizado
│       │   └── socket.service.ts      # WebSockets (pull, security, access)
│       └── types/api.ts              # Interfaces compartidas
│
├── mcp-brain/                  # Cerebro MCP independiente (Stdio + REST)
│   └── src/
│       ├── index.ts            # MCP Server + Express API
│       ├── database.ts         # SQLite + FTS5
│       └── memory.ts           # Memory Service (embeddings, busqueda)
│
├── .opencode/agents/           # Agentes OpenCode (8 agentes, optimizados ~59%)
│   ├── orchestrator.md         # Orquestador centralizado
│   ├── backend-dev.md          # Backend specialist (Express + MCP)
│   ├── frontend-dev.md         # Frontend specialist (React + Vite)
│   ├── docker-ops.md           # Docker specialist
│   ├── documentation.md        # Documentation specialist
│   ├── qa-verification.md      # QA verification specialist
│   ├── mcp-brain.md            # Servicio de memoria compartida MCP
│   └── agent-creator.md        # Agent creator
│
├── postman-collection/         # Coleccion de Postman
├── .env.example                # Variables de entorno plantilla
├── biome.json                  # Configuracion Biome v2
├── CHANGELOG.md                # Historial de versiones
├── docker-compose.yml          # Stack completo (5 servicios)
├── opencode.json               # Configuracion de OpenCode
├── package.json                # Dependencias del proyecto
└── README.md                   # README del proyecto
```

---


### Flujo de trabajo con orquestador

El orquestador centralizado (orchestrator.md) coordina todo el ciclo de desarrollo:
1. **Delega** tareas a los sub-agentes especializados (backend, frontend, docker, documentation, etc.)
2. **Sub-agentes** ejecutan su trabajo y reportan resultados
3. **QA verification** ejecuta una validacion al final del ciclo
4. **Orquestador** guarda los resultados en el cerebro MCP (mem_save) y actualiza el CHANGELOG.md

Este flujo centralizado asegura trazabilidad, memoria compartida entre sesiones y documentacion siempre actualizada.

## Tecnologias

| Capa | Stack |
|---|---|
| **Runtime LLM** | [Ollama](https://ollama.com) |
| **Backend** | Node.js, Express 4, TypeScript, Socket.io 4 |
| **Protocolo MCP** | `@modelcontextprotocol/sdk` v1 |
| **Frontend** | React 19, Vite 7, TypeScript, Lucide Icons |
| **Infraestructura** | Docker Compose, Ngrok, Nginx |
| **Base de Datos** | SQLite + FTS5 (memoria persistente) |
| **Scraping** | Cheerio (Ollama Library) |
| **Control Docker** | Dockerode |
| **Linting** | Biome v2 |

---

## Endpoints API

### OpenAI Compatibles
- `GET /v1/models` - Listar modelos
- `POST /v1/chat/completions` - Chat con streaming SSE

### Estado y Metricas
- `GET /api/status` - Estado completo del servidor
- `GET /api/status/fast` - Estado rapido (cached)
- `GET /api/status/full` - Estado completo (costoso)
- `GET /api/metrics/performance` - TTFT, throughput

### Gestion de Modelos
- `GET /api/models` - Listar modelos instalados
- `POST /api/pull` - Descargar modelo
- `DELETE /api/models/:name` - Eliminar modelo
- `POST /api/unload` - Liberar VRAM
- `POST /api/clean` - Limpiar cache

### Seguridad
- `GET /api/auth/settings` - Configuracion de auth
- `POST /api/auth/ollama` - Toggle auth Ollama
- `POST /api/auth/mcp` - Toggle auth MCP
- `POST /api/ban` - Banear IP
- `POST /api/unban` - Desbanear IP

### Ngrok
- `GET /api/ngrok/status` - Estado del tunel
- `POST /api/ngrok/start` - Iniciar tunel
- `POST /api/ngrok/stop` - Detener tunel

### Hardware
- `GET /api/hardware` - VRAM y configuracion
- `POST /api/hardware/auto-unload` - Configurar auto-unload
- `POST /api/hardware/num-ctx` - Configurar contexto global

### Brain (Cerebro MCP)
- `GET /api/memory/stats` - Estadisticas de memoria
- `GET /api/memory/search` - Busqueda semantica/lexical
- `DELETE /api/memory/:id` - Eliminar memoria
- `GET /api/settings/core_directives` - Obtener directivas de proyecto
- `POST /api/settings/core_directives` - Guardar directivas de proyecto
- `POST /api/memory/consolidate` - Ejecutar consolidacion manual
- `POST /api/mcp/sync` - Inyectar configuracion MCP en IDEs

### MCP Tools (7 herramientas)
| Tool | Descripcion |
|------|-------------|
| `list_models` | Lista modelos instalados |
| `pull_model` | Descarga modelo de Ollama Library |
| `generate` | Genera respuesta para un prompt |
| `chat` | Envia mensaje a un modelo |
| `unload_models` | Libera VRAM |
| `get_server_status` | Obtiene telemetria del servidor |
| `delete_model` | Elimina modelo del disco |

---

## Licencia

MIT (c) 2026 LaLlamaOllama Team
