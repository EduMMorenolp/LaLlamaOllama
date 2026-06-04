# Arquitectura — MCP Brain

```
src/
├── index.ts                  # Orquestador: inicia servidores MCP + REST
├── database/
│   ├── connection.ts         # SQLite + WriteQueue
│   ├── schemas/
│   │   ├── index.ts          # Init de tablas
│   │   ├── memories.ts       # Tabla memories con FTS5
│   │   ├── sessions.ts       # Tabla sessions
│   │   └── audit.ts          # Tabla mcp_audit_log
│   └── queries/
│       └── memories.ts       # Queries FTS5 + vectores
├── server/
│   ├── mcp.ts                # Servidor MCP (stdio + SSE)
│   └── rest.ts               # Express REST API
└── services/
    ├── llm/
    │   └── embeddings.ts     # Embeddings vía Ollama
    ├── memories/
    │   ├── save.ts           # Guardar + detección de conflictos
    │   ├── search.ts         # Búsqueda híbrida
    │   ├── context.ts        # Contexto de sesión
    │   └── stats.ts
    ├── sessions/
    │   └── session.ts        # CRUD de sesiones
    ├── analysis/
    │   ├── judge.ts          # Evaluación de conflictos
    │   ├── compare.ts        # Comparación entre memorias
    │   └── tags.ts           # Sugerencia de tags
    └── audit/
        └── audit.ts          # Log de auditoría
```

## Flujo de datos

### MCP Tool Call
```
Cliente MCP → stdio/SSE → mcp.ts handler
  → services/memories | analysis | audit
  → SQLite WriteQueue → DB commit → response
```

### REST API
```
HTTP Request → rest.ts → services → JSON Response
```

## Transportes

- **stdio**: procesos locales (Claude Desktop, OpenCode CLI)
- **SSE**: conexiones remotas HTTP (`/sse` + `/messages`)

## Búsqueda híbrida

1. Intenta embedding semántico (Ollama)
2. Calcula similitud coseno en vectores
3. Si Ollama falla → fallback a FTS5 léxico
4. Combina resultados con ranking por relevancia

## Auditoría (v2.0)

Toda llamada MCP se registra automáticamente en `mcp_audit_log`:
- timestamp, agent, tool, project, metadata
- Compliance check: verifica último `mem_save` del agente
- Herramienta `mem_my_compliance` para auto-auditoría
