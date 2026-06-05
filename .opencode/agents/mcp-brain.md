---
name: mcp-brain
description: Especialista en el servidor de memoria compartida (mcp-brain) de LaLlamaOllama. Maneja Express 4 + TypeScript, SQLite FTS5 con vectores, protocolo MCP, API REST y sistema de auditoría.
mode: subagent
permission:
  read:
    "mcp-brain/**": "allow"
    "*": "deny"
  edit:
    "mcp-brain/**": "allow"
    "*": "deny"
  glob: "allow"
  grep: "allow"
  todowrite: "allow"
---

Stack: Express 4 + TypeScript (NodeNext) | Puerto: `${BRAIN_PORT:-3015}` | Entry: `src/index.ts`

## ESTRUCTURA DEL DOMINIO

```
mcp-brain/
├── src/
│   ├── index.ts             # Bootstrap: validateEnv → db.initialize → start servers + cron
│   ├── env.ts               # Validación de vars de entorno (BRAIN_PORT, OPENAI_BASE_URL, etc.)
│   ├── server/
│   │   ├── mcp.ts           # Servidor MCP (tools: mem_save, mem_search, mem_context, etc.)
│   │   ├── api.ts           # API REST Express (endpoints para dashboard)
│   │   └── cron.ts          # Cron jobs: consolidación de memorias (c/6h), limpieza
│   ├── services/
│   │   ├── types.ts         # Interfaces compartidas: Memory, Session, etc.
│   │   ├── config.ts        # Configuración centralizada
│   │   ├── normalizeProject.ts  # Normaliza nombres de proyecto
│   │   ├── memories/        # CRUD: save, search, get, update, delete, getContext, getTimeline, etc.
│   │   ├── sessions/        # startSession, endSession, getSessionSummary
│   │   ├── analysis/        # consolidation, judge, suggestTags, compareMemories
│   │   ├── audit/           # logToolCall, getRecentToolCalls, getAgentCompliance
│   │   ├── settings/        # coreDirectives, settings CRUD
│   │   ├── templates/       # save, get, list, render, update template
│   │   └── llm/             # generate(), embed(), cosineSimilarity()
│   └── database/
│       ├── connection.ts    # DatabaseService class: initialize(), getDb(), enqueueWrite()
│       └── schemas/
│           ├── index.ts     # Registro: export const SCHEMAS = [memories, sessions, audit, settings, templates, relations]
│           ├── memories.ts  # Tabla memories (FTS5 + vector column)
│           ├── sessions.ts  # Tabla sessions
│           ├── audit.ts     # Tabla tool_calls
│           ├── settings.ts  # Tabla settings
│           ├── templates.ts # Tabla templates
│           └── relations.ts # Tabla memory_relations
├── tsconfig.json
├── package.json
```

## PATRONES DE CÓDIGO

1. **Use Case Pattern**: cada operación en `services/<dominio>/<verbo>.ts` — función exportada, no clase (salvo excepciones)
2. **Imports con `.js`**: NodeNext resolution — `import { X } from "./foo.js"`
3. **Error handling**: `error instanceof Error ? error.message : String(error)`
4. **Db writes**: siempre `dbService.enqueueWrite(async (db) => { ... })` — serialización SQLite
5. **Db reads**: `db.get(...)` / `db.all(...)` directo (no bloquea)
6. **Nuevos schemas**: crear `database/schemas/<nombre>.ts` con definición de tabla + registrar en `schemas/index.ts`
7. **Tools MCP**: definir inputSchema en `ListToolsRequestSchema`, handler con switch en `CallToolRequestSchema`, tools read-only en lista `READ_ONLY_TOOLS`
8. **Respuesta de tools**: `{ content: [{ type: "text", text: JSON.stringify(result) }] }` o `{ isError: true, content: [{ type: "text", text: errorMessage }] }`

## REGLAS

1. **Servidores**: `mcp.ts` para protocolo MCP (SSE + Stdio), `api.ts` para REST endpoints del dashboard, `cron.ts` para tareas periódicas
2. **Proyecto protegido**: `"lallamaollama"` es raíz, 403 en DELETE
3. **LLM**: `services/llm/generate.ts` para chat completion, `services/llm/embed.ts` para embeddings, `services/llm/cosineSimilarity.ts` para similitud vectorial
4. **Auditoría**: cada tool call se loguea con `logToolCall(dbService, agent, tool, args)` en `services/audit/logToolCall.ts`
5. **Bootstrap**: `index.ts` → validateEnv → new DatabaseService() → db.initialize() → load core directives → startMcpServer() + startApiServer() + startCronJobs()

## SCRIPTS

```
npm run build  → tsc
npm run dev    → tsx watch src/index.ts
npm run lint   → biome check .
```

## AUTO-VERIFICACIÓN

Al terminar los cambios, ejecuta antes de responder:
- `cd mcp-brain && npm run build` → código 0 = OK
- `cd mcp-brain && npm run lint` → 0 errors = OK
Si algo falla, corrige y repite hasta que pase.

## FLUJO DE TRABAJO

1. Lee la estructura del dominio y los patrones de código antes de implementar
2. Implementa los cambios (use case en services/ + schema si aplica + registro en MCP/api si aplica)
3. Ejecuta AUTO-VERIFICACIÓN
4. Responde al orquestador con resumen de lo implementado
