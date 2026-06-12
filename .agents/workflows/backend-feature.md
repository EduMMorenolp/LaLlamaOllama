---
description: Workflow para implementar una nueva ruta o funcionalidad en el backend (Express 4 + TypeScript).
---

# Workflow — Implementar en Backend

> Ver pasos comunes en [`_steps-common.md`](./_steps-common.md)

## PASO 1 — Contexto previo

Ver `PASO COMÚN — Buscar contexto previo` en `_steps-common.md`.

---

## PASO 2 — Identificar dónde agregar en main.ts

| Dominio | Buscar en main.ts |
|---------|-------------------|
| Modelos Ollama | `// Rutas de Compatibilidad OpenAI` |
| Telemetría / Estado | `// --- Endpoints de Telemetría` |
| Auth | `// --- Auth Settings` |
| Hardware | `// --- Hardware Sentinel` |
| Engine/Stats | `// --- AI Engine Tuner` |
| Ngrok | `// --- Control de Ngrok` |
| Ollama Motor | `// --- Control de Ollama Motor` |
| Brain | `// --- Control de Cerebro MCP` |
| Nuevo dominio | Agregar bloque comentado al final |

---

## PASO 3 — Implementar la ruta

```typescript
app.<method>("/api/<ruta>", authMiddleware, async (req, res) => {
    try {
        const result = await appModule.ollamaService.<método>(/*params*/);
        res.json(result);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
    }
});
```

**Reglas:**
- `authMiddleware` SIEMPRE como segundo argumento
- Usar `Dockerode` (nunca `exec`)
- Si requiere emit: `io.emit("evento", { dato })`
- Parámetros tipados: `const { campo } = req.body as { campo: string }`

---

## PASO 4 — MCP Tool (opcional)

Si también debe ser MCP Tool:
1. Definición en `ollama/ollama.tools.ts`
2. Handler en `ollama.service.ts`

---

## PASO 5 — Verificar

Ver `PASO COMÚN — Verificar TypeScript` en `_steps-common.md`.

---

## PASO 6 — Postman Collection

Abrir `docs/postman-collection/LaLlamaOllama-Postman-Collection.json` y agregar request en la carpeta correcta con headers y body example. Ver `postman.md`.

---

## PASO 7 — Guardar

Ver `PASO COMÚN — Guardar en el cerebro` en `_steps-common.md`.
