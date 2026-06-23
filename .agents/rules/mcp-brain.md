---
trigger: glob
glob: "mcp-brain/**"
description: Reglas específicas para trabajar en mcp-brain (servidor MCP + API REST, SQLite FTS5, puerto 3015).
---

# Reglas — mcp-brain

## STACK

- **Runtime**: Node.js con TypeScript (`moduleResolution: NodeNext`)
- **Protocolo MCP**: `@modelcontextprotocol/sdk` (stdio + SSE)
- **HTTP**: Express 4 para API REST
- **DB**: SQLite (`sqlite` + `sqlite3`) con FTS5 y Vector Embeddings
- **LLM**: Ollama (embeddings y análisis) via HTTP
- **Puerto**: 3015 (env `BRAIN_PORT`)

## ESTRUCTURA

```
mcp-brain/src/
├── index.ts              → Orquestador: abre DB, aplica schemas, arranca API y MCP
├── env.ts                → Variables de entorno validadas
├── database/
│   ├── connection.ts     → DatabaseService: getDb(), enqueueWrite()
│   └── schemas/
│       ├── index.ts      → applySchemas() — registra todas las tablas
│       ├── memories.ts   → tabla memories + FTS5 + triggers
│       ├── sessions.ts   → tabla sessions
│       ├── relations.ts  → tabla memory_relations
│       ├── settings.ts   → tablas core_directives + global_settings
│       ├── audit.ts      → tabla audit_log
│       └── templates.ts  → tabla templates + seeds
├── services/
│   ├── index.ts          → barrel export de todos los services
│   ├── types.ts          → tipos compartidos
│   ├── config.ts         → constantes de configuración
│   ├── memories/         → CRUD memories + búsqueda híbrida + delete cascading
│   ├── sessions/         → CRUD sessions + summaries
│   ├── llm/              → embeddings (Ollama) + análisis semántico
│   ├── analysis/         → consolidación de memorias
│   ├── audit/            → log de tool calls + compliance
│   ├── settings/         → global_settings + core_directives
│   └── templates/        → CRUD templates + renderTemplate
└── server/
    ├── api.ts            → Express REST (todos los endpoints HTTP)
    └── mcp.ts            → Servidor MCP (tools stdio + SSE handlers)
```

## ARQUITECTURA — USE CASE PATTERN

**Regla fundamental**: cada función de negocio vive en su propio archivo.

```
services/<dominio>/
├── index.ts              → barrel export
├── types.ts              → interfaces del dominio (opcional)
├── listX.ts              → función listX(dbService, ...) → X[]
├── getX.ts               → función getX(dbService, id) → X | null
├── saveX.ts              → función saveX(dbService, data) → X
├── updateX.ts            → función updateX(dbService, id, data) → X | null
└── deleteX.ts            → función deleteX(dbService, id) → boolean
```

**Dependency injection**: siempre recibir `dbService: DatabaseService` como parámetro.
Nunca importar una instancia global de la DB.

## REGLAS CRÍTICAS

### Escrituras a la DB
**SIEMPRE** usar `dbService.enqueueWrite()` para INSERT/UPDATE/DELETE:
```typescript
await dbService.enqueueWrite(async () => {
    await db.run("INSERT INTO ...", [...params]);
});
```
Esto garantiza serialización de escrituras en SQLite.

Las **lecturas** (`db.get`, `db.all`) van directamente sin encolar.

### Nuevo schema / tabla
1. Crear `database/schemas/<nombre>.ts` con `async function createXTable(db)`
2. Importar y llamar en `database/schemas/index.ts` dentro de `applySchemas()`
3. Usar `CREATE TABLE IF NOT EXISTS` para idempotencia
4. Usar `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para migraciones seguras
5. Agregar seed data en la misma función si aplica

### Nueva tool MCP (`mcp.ts`)
1. Definir la tool en el array del `ListToolsRequestSchema` handler
2. Agregar el `case "tool_name"` en el switch del `CallToolRequestSchema` handler
3. Si es read-only: agregar el nombre a `READ_ONLY_TOOLS` (activa compliance reminder)
4. La identidad del agente se extrae automáticamente de `args.agent`
5. El audit log es automático — no hace falta llamarlo manualmente

### Nuevo endpoint REST (`api.ts`)
1. Agregar en la sección correcta (por dominio)
2. Importar el service de `services/index.ts`
3. Manejo de errores estándar:
   ```typescript
   } catch (e: unknown) {
       res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
   }
   ```

### MCP Tool response format
```typescript
response = { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
// Con error:
response = { content: [{ type: "text", text: "mensaje" }], isError: true };
```

## PROYECTO PROTEGIDO

El proyecto `"lallamaollama"` es el proyecto raíz protegido.
La API devuelve 403 si se intenta eliminarlo.
Esta protección DEBE mantenerse en cualquier endpoint de borrado.

## VERIFICACIÓN

```bash
cd mcp-brain && npm run build
# o verificación de tipos sin emitir:
cd mcp-brain && npx tsc --noEmit
```
