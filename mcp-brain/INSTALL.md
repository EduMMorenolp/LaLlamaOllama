# Instalación — MCP Brain

## Requisitos

- Node.js 18+
- npm
- Ollama con `nomic-embed-text` (para embeddings semánticos)

```bash
ollama run nomic-embed-text
```

## Instalación

```bash
cd mcp-brain
npm install
```

## Configuración

Variables de entorno (`.env`):

```env
OLLAMA_API_URL=http://127.0.0.1:11434
BRAIN_PORT=3015
HOST_IP=192.168.1.x    # IP local para SSE remoto
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

## Verificación

```bash
# Health-check
curl http://localhost:3015/health

# Buscar memoria
curl "http://localhost:3015/api/memory/search?q=hola&mode=hybrid"
```

## Conexión MCP

### Local (stdio)
Configurar en el cliente MCP como comando stdio.

### Remota (SSE)
Conectar a `http://localhost:3015/sse` para transporte SSE.
