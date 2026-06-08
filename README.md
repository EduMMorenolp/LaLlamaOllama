# LaLlamaOllama

> **Plataforma de orquestación inteligente para LLMs locales.**  
> Dashboard glassmorphism + Agent Engine autónomo + Cerebro MCP con memoria persistente + Chat multi-agente.

[![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)](./CHANGELOG.md)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?style=flat-square&logo=docker)](./docker-compose.yml)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)

---

## ¿Qué es LaLlamaOllama?

LaLlamaOllama es un **ecosistema completo** para ejecutar, gestionar y orquestar modelos de lenguaje (LLMs) de forma local, privada y profesional. Combina:

- **Dashboard administrativo** — interfaz premium glassmorphism para monitorear GPU, modelos, seguridad y telemetría en tiempo real.
- **Agent Engine** — agente de código autónomo con tool calling multi-turno, memoria persistente y soporte multi-provider (Ollama, OpenAI, OpenRouter).
- **Chat multi-agente** — conversaciones persistentes con sub-agentes especializados, historial completo y herramientas en vivo.
- **MCP Brain** — cerebro de memoria compartida con búsqueda semántica (FTS5 + embeddings), directivas de proyecto y consolidación automática.

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
- Agente de codificación autónomo con 8 herramientas integradas
- Multi-provider: Ollama, OpenAI, OpenRouter (detección automática)
- Tool calling en tiempo real con búsqueda, edición de archivos, bash y más
- Conversaciones persistentes con SQLite local
- Sub-agentes especializados configurables desde la UI
- WebSocket en vivo: streaming de respuestas, tool calls, estados

### 🧠 MCP Brain (Cerebro Compartido)
- Memoria persistente con SQLite + FTS5 + embeddings vectoriales
- Búsqueda semántica, lexical e híbrida
- Directivas de proyecto inyectadas en el protocolo MCP
- Consolidación automática de memorias redundantes vía Ollama
- Sincronización multi-IDE: OpenCode, Cursor, Claude Desktop, Windsurf, RooCode

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

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **LLM Runtime** | Ollama |
| **Agent Engine** | Node.js, Express 4, TypeScript, better-sqlite3 |
| **MCP Brain** | Node.js, Express 4, TypeScript, SQLite FTS5 + embeddings |
| **Frontend** | React 19, Vite 7, TypeScript, Lucide Icons |
| **Agent Frontend** | React 19, Vite 7, TypeScript, WebSocket |
| **Infraestructura** | Docker Compose, Ngrok |
| **Control Docker** | Dockerode |
| **Linting** | Biome v2 |

---

## ¿Para quién?

- **Desarrolladores** que necesitan un agente de código local con herramientas reales (bash, grep, glob, read/write)
- **Equipos** que quieren compartir contexto entre sesiones de IA vía MCP Brain
- **Usuarios avanzados** que gestionan múltiples modelos Ollama y necesitan telemetría
- **Creadores de agentes** que configuran sub-agentes especializados para diferentes tareas

---

## Licencia

MIT © 2026 LaLlamaOllama Team
