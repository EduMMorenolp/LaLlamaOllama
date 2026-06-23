# Reglas del Proyecto — LaLlamaOllama

Este documento centraliza las reglas principales de arquitectura, desarrollo y convenciones de código para el proyecto **LaLlamaOllama**. Todos los desarrolladores y agentes de IA deben apegarse estrictamente a estas normativas.

## 1. Arquitectura y Servicios

El proyecto está compuesto por múltiples microservicios interconectados a través de Docker.

| Servicio / Contenedor | Puerto | Stack Principal | Descripción |
|-----------------------|--------|-----------------|-------------|
| `ollama-motor` | `11434` | Ollama | Motor de Inferencia LLM. |
| `backend` | `3016` | Express 4 + TypeScript | API principal, middleware de seguridad y WebSocket. |
| `mcp-brain` | `3015` | MCP + REST | Cerebro (Model Context Protocol), base de datos SQLite y Use Cases. |
| `frontend` | `8080` | React 19 + Vite 7 | Dashboard de administración e interfaz principal. |
| `agent-engine` | `3020` | Express + BullMQ + SQLite | Motor del agente autónomo y procesamiento en background. |
| `agent-frontend` | `8081` | React + Vite | Interfaz de chat y panel de control del Agente (OpenCode). |
| `agent-engine-redis` | `6379` | Redis 7 Alpine | Caché y colas para el agente. |
| `mcp-ngrok-tunnel` | — | Ngrok | Exposición segura a internet. |

---

## 2. Cerebro MCP (Model Context Protocol)

El Cerebro (`mcp-brain`) actúa como la memoria central y proveedor de herramientas del proyecto.

- **Nombre del Servidor**: `lallamaollama-brain`
- **Proyecto Activo**: `lallamaollama`
- **URL SSE (Server-Sent Events)**: `http://192.168.0.236:3015/sse` o `http://brain:3015/sse` en red Docker.
- **Datos**: La base de datos SQLite y logs se guardan en el volumen `./data/` del contenedor.

> [!IMPORTANT]
> Siempre debes pasar `project: "lallamaollama"` en toda llamada a las herramientas (tools) del cerebro.

---

## 3. Linting y Formateo (OBLIGATORIO)

El proyecto utiliza **Biome** como linter y formateador principal (ubicado en la raíz del proyecto), excepto para el Frontend que utiliza ESLint.

### Configuración Activa (`biome.json`)
- **Indentación**: `tabs` (NO espacios). Ancho: `4`.
- **Ancho de línea (Line Width)**: `120` caracteres.
- **Comillas JS/TS**: Dobles (`"`).
- **Punto y coma (Semicolons)**: Siempre (`;`).
- **Trailing commas**: 
  - JS/TS: `es5` (en arrays y objetos multi-línea).
  - JSON: `none` (sin comas al final).
- **Linter**: Reglas `recommended` habilitadas.

### Comandos de Verificación
- **Revisión General (Backend, MCP, Engine)**: Ejecutar desde la raíz `npx biome check .`
- **Auto-Fixing**: `npx biome check --write .`
- **Frontend (React)**: Entrar a la carpeta y correr `npm run lint` (`cd frontend && npm run lint`).

> [!WARNING]
> **Regla de Oro**: Antes de dar cualquier tarea o feature por terminada, el código DEBE pasar `npx biome check .` sin reportar errores.

---

## 4. Reglas Generales de Código TypeScript

1. **TypeScript Estricto**: Está terminantemente prohibido el uso de `any`. Se deben utilizar tipos explícitos o inferidos de forma segura. Ante la duda al capturar errores, utilizar `unknown`.
2. **Importaciones (NodeNext)**: En `backend` y `mcp-brain`, las importaciones de archivos locales **deben** llevar la extensión `.js` al final (ej. `import { foo } from "./services/foo.js"`).
3. **Manejo de Errores**: Todo error capturado en un `catch` debe ser tratado de forma segura.
   ```typescript
   try {
     // código
   } catch (error: unknown) {
     const message = error instanceof Error ? error.message : String(error);
     log.error({ message }, "Error al ejecutar...");
   }
   ```
4. **Comandos de Shell**: Evitar el uso de comandos shell ejecutados con `exec` o `spawn` para interactuar con contenedores. Utilizar librerías nativas o la API de Docker (ej. `Dockerode`).
5. **Promesas (Async/Await)**: No usar callbacks ni cadenas largas de `.then()`. Privilegiar siempre `async/await`.
6. **Variables de Entorno**: Deben leerse desde `process.env` y ser validadas obligatoriamente en el archivo de inicio (ej. `main.ts` o `server.ts`) para fallar rápido (Fail Fast) si faltan.

---

## 5. Tipos de Memoria (Para Registros en el Cerebro)

Cuando se solicite registrar una memoria o generar un log de cambio arquitectónico, categorizar según el `type`:

| Tarea | `type` en Memoria |
|-------|-------------------|
| Nueva ruta API en backend | `feature` |
| Nueva MCP Tool | `feature` |
| Nuevo componente React | `feature` |
| Fix en Docker/compose | `bug-fix` o `configuration` |
| Decisión de diseño UI | `architecture` |
| Convención de código | `convention` |
| Cambio en schema de SQLite | `architecture` |
| Entrada en CHANGELOG.md | `changelog` |

---

## 6. Frontend: Reglas de Diseño UI
- Se utiliza React 19 con Vite.
- Los estilos se rigen por un sistema propio de **Vanilla CSS** con variables globales (en `index.css`).
- **Aesthetics First**: La interfaz prioriza el glassmorphism, esquemas de color vibrantes, modo oscuro y animaciones fluidas. Está prohibido utilizar diseños "básicos" o CSS inline que rompan la línea gráfica premium del proyecto.
