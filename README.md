# LaLlamaOllama

> **Plataforma de orquestación inteligente para LLMs locales.**  
> Dashboard glassmorphism + Agent Engine autónomo + Cerebro MCP con memoria persistente + Chat multi-agente.

[![Version](https://img.shields.io/badge/version-3.0.0-blue?style=flat-square)](./CHANGELOG.md)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?style=flat-square&logo=docker)](./docker-compose.yml)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)

---

## ¿Qué es LaLlamaOllama?

LaLlamaOllama es un **ecosistema completo** para ejecutar, gestionar y orquestar modelos de lenguaje (LLMs) de forma local, privada y profesional. Combina:

- **Dashboard administrativo** — interfaz premium glassmorphism para monitorear GPU, modelos, seguridad y telemetría en tiempo real.
- **Agent Engine** — agente de código autónomo con tool calling multi-turno, memoria persistente y soporte multi-provider (Ollama, OpenAI, OpenRouter).
- **Chat multi-agente** — conversaciones persistentes con sub-agentes especializados, historial completo y herramientas en vivo.
- **MCP Brain** — cerebro de memoria compartida con búsqueda semántica (FTS5 + embeddings), directivas de proyecto y consolidación automática.
- **Brain Frontend** — UI standalone React para navegar memorias del MCP Brain, con búsqueda full-text, estadísticas y editor Markdown.
- **Skills System** — memoria procedural donde el agente aprende flujos de trabajo repetitivos y los reutiliza automáticamente.

---

## Servicios

### 🖥️ Dashboard de Administración
- Telemetría en vivo: VRAM, CPU, disco, tráfico de red
- Gestión de modelos: buscar, descargar, eliminar desde la UI
- Monitor de seguridad: blacklist de IPs, auto-ban, rate limiting, API Key auth
- Performance: TTFT, throughput tok/s, historial de inferencia
- Túnel Ngrok: expón tu servidor con un clic
- Consola del Brain: explorar memorias, fusionar proyectos, ver directivas

### 🤖 Agent Engine
- Agente de codificación autónomo con tool calling multi-turno
- Multi-provider: Ollama (conexión directa, sin proxy), OpenAI, OpenRouter
- Tool calling en tiempo real con búsqueda, edición de archivos, bash y más
- Conversaciones persistentes con SQLite local
- Sub-agentes especializados configurables desde la UI
- **Skills System** — memoria procedural que aprende y reutiliza flujos de trabajo
- **Task Management** — 5 herramientas nativas para gestionar tareas
- WebSocket en vivo: streaming de respuestas, tool calls, estados

### 🧠 MCP Brain (Cerebro Compartido)
- Memoria persistente con SQLite + FTS5 + embeddings vectoriales
- Búsqueda semántica, lexical e híbrida
- Directivas de proyecto inyectadas en el protocolo MCP
- Consolidación automática de memorias redundantes
- **Totalmente independiente** — no requiere Ollama ni Backend para operar
- Sincronización multi-IDE: OpenCode, Cursor, Claude Desktop, Windsurf, RooCode

### 🧠 Brain Frontend
- UI standalone para navegar memorias, estadísticas y búsqueda full-text
- Componentes: lista de memorias con filtros, cuadrícula de estadísticas, SearchView, MemoryModal (ver/crear/editar con Markdown)
- Conexión directa a la API REST de mcp-brain
- Puerto 8082, imagen Docker: `lallamaollama-brain-frontend`

### 💬 Chat Multi-Agente
- Múltiples conversaciones con pin, búsqueda y organización
- Sub-agentes especializados con modelo y system prompt propios
- Contador de tokens por mensaje y sesión
- Herramientas configurables (enable/disable por toggle)
- Integración con Telegram Bot

### 📚 Conocimiento
- Subida de archivos con chunking automático
- Indexación vectorial vía MCP Brain
- Búsqueda semántica sobre documentos indexados

---

## Arquitectura

LaLlamaOllama se compone de **6 servicios Docker** que se comunican entre sí:

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| **backend** | 3000 | API principal (Express) — proxy Ollama histórico, telemetría, seguridad |
| **frontend** | 8080 | Dashboard administrativo glassmorphism (React) |
| **mcp-brain** | 3015 | Cerebro de memoria compartida — SQLite + FTS5 |
| **brain-frontend** | 8082 | UI standalone para navegar memorias del MCP Brain |
| **agent-engine** | 3020 | Agente autónomo con tool calling, skills y task management |
| **agent-frontend** | 8081 | Frontend del agente — chat, sub-agentes, WebSocket |

Los **3 dashboards** del ecosistema:
- **Admin Dashboard** (8080) — monitoreo de GPU, modelos, seguridad, telemetría
- **Agent Frontend** (8081) — chat interactivo con el agente, sub-agentes, configuración
- **Brain Frontend** (8082) — explorador de memorias, estadísticas y búsqueda full-text

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **LLM Runtime** | Ollama |
| **Agent Engine** | Node.js, Express 4, TypeScript, better-sqlite3 |
| **MCP Brain** | Node.js, Express 4, TypeScript, SQLite FTS5 |
| **Brain Frontend** | React 19, Vite 7, TypeScript |
| **Frontend** | React 19, Vite 7, TypeScript, Lucide Icons |
| **Agent Frontend** | React 19, Vite 7, TypeScript, WebSocket |
| **Infraestructura** | Docker Compose, Ngrok, Redis |
| **Control Docker** | Dockerode |
| **Linting** | Biome v2 |

---

## Requisitos

- **Node.js 18+**
- **Docker Compose** (para despliegue completo)
- **OpenCode** instalado ([opencode.ai](https://opencode.ai))
- **NVIDIA GPU** con controladores CUDA (recomendado, no obligatorio)

---

## ¿Para quién?

- **Desarrolladores** que necesitan un agente de código local con herramientas reales (bash, grep, glob, read/write)
- **Equipos** que quieren compartir contexto entre sesiones de IA vía MCP Brain
- **Usuarios avanzados** que gestionan múltiples modelos Ollama y necesitan telemetría
- **Creadores de agentes** que configuran sub-agentes especializados para diferentes tareas

---

## Licencia

MIT © 2026 LaLlamaOllama Team
