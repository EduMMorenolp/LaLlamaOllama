---
description: Workflow para agregar un nuevo use case, tabla, endpoint REST o tool MCP en mcp-brain.
---

# Workflow — Implementar en mcp-brain

> Ver pasos comunes en [`_steps-common.md`](./_steps-common.md)

## PASO 1 — Contexto previo

Ver `PASO COMÚN — Buscar contexto previo` en `_steps-common.md`.

---

## PASO 2 — Identificar el tipo de cambio

| Tipo | Acción |
|------|--------|
| A) Nuevo use case | `services/<dominio>/<verboX>.ts` |
| B) Nueva tabla SQLite | `database/schemas/<nombre>.ts` + registrar en `schemas/index.ts` |
| C) Nuevo endpoint REST | Modificar `server/api.ts` |
| D) Nueva tool MCP | Modificar `server/mcp.ts` (definición + handler) |

---

## WORKFLOW A — Nuevo Use Case

```typescript
// services/<dominio>/<verboNombre>.ts
import type { DatabaseService } from "../../database/connection.js";
export async function verboNombre(dbService: DatabaseService, /*params*/): Promise<ResultType> {
    const db = dbService.getDb();
    const rows = await db.all(`SELECT * FROM tabla WHERE campo = ?`, [valor]);
    await dbService.enqueueWrite(async () => {
        await db.run(`INSERT INTO tabla (...) VALUES (?)`, [valor]);
    });
    return resultado;
}
```

Exportar en barrel: `// services/<dominio>/index.ts` → `export * from "./<verboNombre>.js";`

---

## WORKFLOW B — Nueva Tabla SQLite

```typescript
// database/schemas/<nombre>.ts
export async function createXTable(db: Database<sqlite3.Database, sqlite3.Statement>) {
    await db.exec(`CREATE TABLE IF NOT EXISTS x (id TEXT PRIMARY KEY, campo TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
    const columns = await db.all("PRAGMA table_info(x)");
    // Migración segura: if (!columns.some(c => c.name === "nuevo")) await db.exec("ALTER TABLE x ADD COLUMN nuevo TEXT;");
    // Seeds idempotentes...
}
```

Registrar en `database/schemas/index.ts` → `await createXTable(db);`

---

## WORKFLOW C — Nuevo Endpoint REST

```typescript
// server/api.ts
app.get("/api/x", async (req, res) => {
    try { res.json(await serviceName.listX(dbService)); }
    catch (e: unknown) { res.status(500).json({ error: e instanceof Error ? e.message : String(e) }); }
});
app.post("/api/x", async (req, res) => {
    const { campo } = req.body;
    if (!campo) return res.status(400).json({ error: "campo es obligatorio" });
    try { res.status(201).json(await serviceName.saveX(dbService, { campo })); }
    catch (e: unknown) { res.status(500).json({ error: e instanceof Error ? e.message : String(e) }); }
});
```

---

## WORKFLOW D — Nueva Tool MCP

**Definición (ListToolsRequestSchema):**
```typescript
{ name: "nombre_tool", description: "Descripción clara", inputSchema: { type: "object", properties: { campo: { type: "string" } }, required: ["campo"] } }
```

**Handler (CallToolRequestSchema switch):**
```typescript
case "nombre_tool": {
    const campo = args?.campo as string;
    response = { content: [{ type: "text", text: JSON.stringify(await serviceName.funcionX(dbService, campo)) }] };
    break;
}
```

**Read-only:** agregar a `READ_ONLY_TOOLS`.

---

## PASO FINAL — Verificar y guardar

Ver `PASO COMÚN — Verificar TypeScript` y `PASO COMÚN — Guardar en el cerebro` en `_steps-common.md`.
