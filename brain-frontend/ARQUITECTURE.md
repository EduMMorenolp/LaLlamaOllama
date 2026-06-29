# Brain Frontend — Arquitectura

## Conexión

```
Brain Frontend (React 19, puerto 8082)
  │
  └── HTTP ── MCP Brain (Express, puerto 3015)
               │
               └── SQLite FTS5 (memorias persistidas)
```

## Componentes

| Componente | Ruta | Propósito |
|------------|------|-----------|
| `Memories.tsx` | Lista principal | Filtro por tipo, listado, eliminación |
| `Stats.tsx` | Panel superior | Totales por tipo de memoria |
| `SearchView.tsx` | Búsqueda | Full-text search sobre memorias |
| `MemoryModal.tsx` | Modal | Ver, crear y editar (Markdown) |

## APIs consumidas (MCP Brain)

- `GET /api/memory` — Listar con filtros
- `GET /api/memory/search?q=...` — Búsqueda
- `GET /api/memory/stats` — Estadísticas
- `POST /api/memory` — Crear
- `PUT /api/memory/:id` — Actualizar
- `DELETE /api/memory/:id` — Eliminar