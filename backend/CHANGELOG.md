# Backend — Changelog

## [Unreleased]

### 🖼️ Soporte multi-modal en proxy /v1/chat/completions

#### Añadido
- **➕ Zod schema acepta `ContentPart[]`** — `MessageSchema.content` ahora acepta `string | ContentPart[] | null` (text + image_url)
- **➕ Conversión a formato Ollama `images[]`** — `convertToOllamaMessages()` extrae imágenes de `image_url` parts y las envía como array `images` en el mensaje Ollama

#### Cambiado
- **🔧 `types/chat.ts`** — Nuevos schemas `ContentPartTextSchema`, `ContentPartImageSchema`, `ContentPartSchema` con `discriminatedUnion`
- **🔧 `ollama.service.ts`** — Handler para `Array.isArray(msg.content)` que construye `text` + `images` para Ollama

## [1.0.0] — 2026-06-07

### 🚀 Versión estable 1.0.0

Alineación de versión con el proyecto raíz LaLlamaOllama.

### Cambiado
- Refactor a Use Case Pattern con capas: types/, middleware/, repositories/, use-cases/, routes/
- `main.ts` reducido de 953 → 173 líneas (-82%)

## [0.5.0] — 2026-06-02

### Añadido
- Soporte para adjuntar archivos en playground
- AI Agent Wizard: generación inteligente de agentes con IA
- Endpoint `POST /api/agents/analyze-project`

## [0.4.0] — 2026-04-18

### Añadido
- Streaming token-a-token en `/v1/chat/completions`
- GPU Metrics Async Caching
- Performance Metrics (TTFT, throughput tok/s)
- HTTP Keep-Alive Connection Pooling
- Semáforo de concurrencia GPU (máx 3 concurrentes)
- Endpoints `/api/status/fast` y `/api/status/full`

## [0.3.0] — 2026-03-25

### Añadido
- API Key obligatoria en startup
- SessionManager por IP
- Autenticación en SSE/MCP
- Biome linter
- Persistencia de chat en localStorage

## [0.2.0] — 2026-03-10

### Añadido
- Búsqueda en Ollama Library con Cheerio
- Control de Ngrok desde la Web
- Scraper de ollama.com/library

## [0.1.0] — 2026-03-08

### Añadido
- Servidor Express + SSE para Claude Desktop
- API Key con rate limiting
- Seguridad: Helmet, blacklist, auto-ban
- Modelos Ollama: listar, pull, delete, unload
- WebSockets para progreso de descargas
