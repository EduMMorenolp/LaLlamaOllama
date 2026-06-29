# LaLlamaOllama: MCP Brain Server

El **MCP Brain Server** es el módulo central de memoria a largo plazo (Long-Term Memory) de LaLlamaOllama, diseñado bajo la especificación del Model Context Protocol (MCP).

## Características Principales

- **Memoria Persistente:** Almacenamiento seguro en SQLite con soporte para operaciones ACID.
- **Búsqueda Full-Text:** Búsqueda ultrarrápida usando FTS5 nativo de SQLite.
- **Arquitectura de Casos de Uso:** Código altamente modular y puramente funcional.
- **Interfaces de Comunicación Duales:**
  - `stdio` (JSON-RPC) para agentes MCP locales.
  - `Express REST API` para consultas desde dashboards (agent-frontend, brain-frontend).
- **Independiente:** No requiere Ollama ni Backend para funcionar (v3).
- **Brain Frontend:** UI standalone React para explorar memorias (puerto 8082).

## Arquitectura del Proyecto

```
mcp-brain/
├── src/
│   ├── index.ts                 # Orquestador e Inicializador
│   ├── database/                # Conexión y Schemas de DB
│   ├── server/                  # Controladores MCP (stdio/SSE) y REST (Express)
│   └── services/                # Lógica de Negocio
│       ├── memories/            # CRUD central y Búsquedas
│       ├── sessions/            # Gestión de Contextos de Sesión
│       ├── audit/               # Auditoría y compliance
│       └── llm/                 # Embeddings y generación (no operativos en v3)
```

## Requisitos Previos

1. **Node.js** (v18 o superior).
2. No requiere Ollama ni Backend (v3).
3. Base de datos SQLite creada automáticamente al iniciar.

## Instalación y Uso

1. Instala las dependencias:
   ```bash
   npm install
   ```

2. Compila el proyecto:
   ```bash
   npm run build
   ```

3. Levanta el servidor en modo desarrollo:
   ```bash
   npm run dev
   ```

## Herramientas MCP Soportadas

- `mem_save`: Guarda decisiones y aprendizajes en memoria persistente.
- `mem_search`: Busca contexto antiguo vía búsqueda FTS5.
- `mem_judge`: Evalúa relación entre dos memorias.
- `mem_capture_passive`: Escanea outputs y extrae Key Learnings.
- `mem_suggest_topic_key`: Agrupa conocimiento bajo una misma etiqueta.
- `mem_session_summary`: Sintetiza hallazgos al final del trabajo.
- `mem_get_directives`: Consulta directivas centrales del proyecto.

---