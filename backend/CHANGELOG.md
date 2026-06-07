# Backend — Changelog

## [Unreleased]

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
