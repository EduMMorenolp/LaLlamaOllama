---
description: Workflow para crear o modificar componentes React en el frontend (React 19 + Vite 7).
---

# Workflow — Implementar en Frontend

> Ver pasos comunes en [`_steps-common.md`](./_steps-common.md)

## PASO 1 — Contexto previo

Ver `PASO COMÚN — Buscar contexto previo` en `_steps-common.md`.

---

## PASO 2 — Identificar el tipo de cambio

| Tipo | Acción |
|------|--------|
| Nuevo componente | `frontend/src/components/<Nombre>.tsx` |
| Nueva pestaña en BrainConsole | Modificar `BrainConsole.tsx` + crear el componente |
| Nuevo servicio HTTP | Modificar `services/api.service.ts` |
| Nuevo tipo global | Agregar a `types/` |
| Estilo global | Modificar `index.css` |
| Página nueva | Ruta en `App.tsx` |

---

## PASO 3 — Crear el componente

```tsx
import type React from "react";
import { useCallback, useEffect, useState } from "react";
// import { brainApi } from "../services/api.service";

interface Props { /* props tipadas */ }

export const MiComponente: React.FC<Props> = ({ prop }) => {
    const [data, setData] = useState<TipoData | null>(null);
    const [loading, setLoading] = useState(false);
    const fetchData = useCallback(async () => {
        setLoading(true);
        try { const res = await brainApi.get("/api/..."); setData(res.data); }
        catch (e) { console.error("Error", e); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { fetchData(); }, [fetchData]);
    return (<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>{/* contenido */}</div>);
};
```

---

## PASO 4 — Design system

**Card glassmorphism:** `<div className="card-glass" style={{ padding: "20px" }}>`

**Botón primario:**
```tsx
<button type="button" style={{ padding: "8px 16px", borderRadius: "8px", background: "var(--accent)", border: "none", color: "white", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>Acción</button>
```

**Label sección:**
```tsx
<h3 style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1.5px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "16px" }}>TÍTULO</h3>
```

**Input estándar:**
```tsx
<input style={{ width: "100%", padding: "8px 10px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "6px", color: "white", fontSize: "13px" }} />
```

---

## PASO 5 — Nueva pestaña en BrainConsole

1. Importar el componente en `BrainConsole.tsx`
2. Agregar al tipo `useState<"auditor" | "directives" | "settings" | "scaffold" | "nuevo-tab">`
3. Agregar botón de tab (mismo estilo que `Layers`)
4. Render condicional: `{activeTab === "nuevo-tab" && <NuevoComponente />}`

---

## PASO 6 — Verificar

Ver `PASO COMÚN — Verificar TypeScript` en `_steps-common.md`.

---

## PASO 7 — Guardar

Ver `PASO COMÚN — Guardar en el cerebro` en `_steps-common.md`.
