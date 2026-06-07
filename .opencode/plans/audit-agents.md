# Auditoría de Agentes OpenCode — LaLlamaOllama

**Fecha:** 2026-06-04
**Alcance:** 1 agente primario + 5 subagentes + configuración global
**Versión del proyecto:** 0.4.0

---

## 1. VISIÓN GENERAL DE LA ARQUITECTURA

### 1.1 Estructura actual

```
.opencode/
├── agents/
│   ├── orchestrator.md    (primary)   — 68 líneas
│   ├── backend-dev.md     (subagent)  — 97 líneas
│   ├── frontend-dev.md    (subagent)  — 84 líneas
│   ├── mcp-brain.md       (subagent)  — 94 líneas
│   ├── docker-ops.md      (subagent)  — 67 líneas
│   └── documentation.md   (subagent)  — 58 líneas
opencode.json              — 63 líneas
```

### 1.2 Topología de delegación

```
Usuario → orchestrator
              ├── backend-dev     (Express + TypeScript, rutas, MCP tools)
              ├── frontend-dev    (React 19 + Vite 7, glassmorphism)
              ├── mcp-brain       (Memoria SQLite FTS5, MCP protocol)
              ├── docker-ops      (Docker Compose, Dockerfiles, GPU)
              └── documentation   (CHANGELOG, README, Postman)
```

### 1.3 Modelo asignado por defecto

| Agente | Modelo | ¿Explícito? |
|--------|--------|-------------|
| orchestrator | (default: llama3.2:3b) | No |
| backend-dev | (default) | No |
| frontend-dev | (default) | No |
| mcp-brain | (default) | No |
| docker-ops | (default) | No |
| documentation | `gemma4:e2b` | Sí |
| brain MCP server | (N/A — remoto en `localhost:3015`) | — |

---

## 2. ANÁLISIS POR AGENTE

### 2.1 orchestrator.md — PUNTUACIÓN: 85/100

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Propósito claro | ✅ | 5 pasos bien definidos |
| Tabla de agentes | ✅ | 5 agentes, sin huérfanos |
| Reglas de ruteo | ⚠️ | Faltan agent-engine y agent-frontend |
| Flujo de trabajo | ✅ | 10 pasos, maneja errores de brain |
| Auto-verificación | ✅ | Actualizado, cada subagente se verifica |
| Notas | ⚠️ | Line 61: referencia a `.agents/rules/` que NO existe |

**Hallazgos:**
- Ruteo incompleto: el docker-compose.yml despliega `agent-engine` (puerto 3020) y `agent-frontend` (puerto 8081) pero el orquestador no los conoce ni los rutea.
- NOTA en línea 61 referencia `.agents/rules/` — directorio que no existe.

---

### 2.2 backend-dev.md — PUNTUACIÓN: 92/100

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Stack | ✅ | Express 4 + TypeScript NodeNext, puerto, entry |
| Estructura dominio | ✅ | Árbol completo y exacto |
| Patrones de código | ✅ | 3 capas, UseCase, imports `.js`, error handling |
| Reglas | ✅ | Auth, SSE, Dockerode, rate limiting, CORS |
| MCP Tools | ✅ | ListToolsRequestSchema + CallToolRequestSchema |
| Scripts | ✅ | build, dev, lint |
| Auto-verificación | ✅ | build + lint |
| Flujo de trabajo | ✅ | 4 pasos |

**Hallazgos:**
- ✅ **Logger**: el patrón `logger.child({ component: "Xxx" })` es correcto y se usa en 7 archivos del código real (`main.ts`, `ollama.service.ts`, `chat.routes.ts`, etc.). El helper `childLogger()` existe pero no se usa en producción — el agente describe bien el patrón dominante.
- ✅ **3 Capas**: se cumple en toda la base de código. Route → UseCase → Service.
- ✅ **Error handling**: `error instanceof Error ? error.message : String(error)` es el estándar en todas las rutas.

---

### 2.3 frontend-dev.md — PUNTUACIÓN: 90/100

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Stack | ✅ | React 19 + Vite 7, API base, entry |
| Estructura dominio | ✅ | Árbol completo |
| Patrones de código | ✅ | Componentes, props, hooks, estilos, iconos, API, Socket |
| Reglas | ✅ | Glassmorphism, estado, telemetría, API key, estilos |
| Eventos Socket.IO | ✅ | pull-progress, security-alert, new-access |
| Scripts | ✅ | build, dev, lint, preview |
| Auto-verificación | ✅ | build + lint |
| Flujo de trabajo | ✅ | 4 pasos |

**Hallazgos:**
- ⚠️ `VITE_ENGINE_URL` se define en docker-compose.yml (líneas 77, 85, 97) pero no se menciona en el agente. Si bien `agent-engine` no tiene agente propio, el frontend principal sí referencia esta URL.

---

### 2.4 mcp-brain.md — PUNTUACIÓN: 93/100

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Stack | ✅ | Express + TypeScript, BRAIN_PORT, entry |
| Estructura dominio | ✅ | Árbol más detallado de todos — servicios, schemas, servidores |
| Patrones de código | ✅ | enqueueWrite, db reads, MCP tools, imports `.js` |
| Reglas | ✅ | Servidores, proyecto protegido, LLM, auditoría, bootstrap |
| Scripts | ✅ | build, dev, lint |
| Auto-verificación | ✅ | build + lint |
| Flujo de trabajo | ✅ | 4 pasos |

**Hallazgos:**
- ✅ El árbol de estructura es el más completo y preciso. Coincide con la implementación real.
- ⚠️ El `.dockerignore` en `mcp-brain/` existe correctamente (no es un typo), pero docker-ops.md no lo lista.

---

### 2.5 docker-ops.md — PUNTUACIÓN: 55/100

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Stack | ❌ | Dice "4 servicios" pero el compose real tiene 7 |
| Estructura | ❌ | Faltan 4 Dockerfiles, falta redis |
| Reglas | ⚠️ | Correctas pero incompletas |
| Auto-verificación | ✅ | YAML, Dockerfiles, EXPOSE, volúmenes |
| Flujo de trabajo | ✅ | 4 pasos |

**Errores detectados:**

| Afirmación en el agente | Realidad |
|------------------------|----------|
| "4 servicios (ollama, backend, frontend, ngrok)" | 7 servicios: ollama, backend, ngrok, frontend, **agent-frontend**, **mcp-brain**, **redis**, **agent-engine** |
| `├── .dockerignore` (raíz) | No existe el archivo `.dockerignore` en la raíz |
| `frontend/Dockerfile` multi-stage: vite → nginx | ✅ Correcto |
| `backend/Dockerfile` multi-stage | ✅ Correcto (pero no se listó) |
| `mcp-brain/Dockerfile` | Existe pero NO se listó en la estructura |
| `agent-engine/Dockerfile` | Existe pero NO se listó |
| `agent-frontend/Dockerfile` | Existe pero NO se listó |
| `redis` service | Existe en compose pero NO se menciona |

---

### 2.6 documentation.md — PUNTUACIÓN: 80/100

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Estructura | ✅ | CHANGELOG, README, Postman, agentes |
| README secciones | ✅ | 9 secciones bien definidas |
| Changelog categorías | ✅ | 5 categorías en español |
| Reglas | ✅ | Formato, idioma, versionado, Postman sync |
| Flujo de trabajo | ⚠️ | Solo 3 pasos, sin auto-verificación |

**Hallazgos:**
- ⚠️ **Sin AUTO-VERIFICACIÓN**: documentation.md no tiene sección de auto-verificación. Podría verificar que los archivos existen y tienen formato válido.
- ⚠️ **README secciones**: no se menciona `agent-engine` ni `agent-frontend` como servicios en la arquitectura.
- ℹ️ La Postman Collection existe en `postman-collection/LaLlamaOllama-Postman-Collection.json`.

---

## 3. ANÁLISIS TRANSVERSAL

### 3.1 Consistencia de patrones entre agentes

| Elemento | backend-dev | frontend-dev | mcp-brain | docker-ops | documentation |
|----------|:-----------:|:------------:|:---------:|:----------:|:------------:|
| ESTRUCTURA | ✅ | ✅ | ✅ | ❌ | ✅ |
| PATRONES | ✅ | ✅ | ✅ | — | — |
| REGLAS | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| SCRIPTS | ✅ | ✅ | ✅ | — | — |
| AUTO-VERIFICACIÓN | ✅ | ✅ | ✅ | ✅ | ❌ |
| FLUJO | ✅ | ✅ | ✅ | ✅ | ✅ |

### 3.2 Servicios en docker-compose.yml vs Agentes

| Servicio | Puerto | ¿Tiene agente? | ¿En orquestador? | ¿En docker-ops? |
|----------|:-----:|:--------------:|:----------------:|:----------------:|
| ollama | 11434 | ❌ (externo) | ❌ | ✅ |
| **backend** | 3016 | ✅ backend-dev | ✅ | ✅ |
| **frontend** | 8080:80 | ✅ frontend-dev | ✅ | ✅ |
| **mcp-brain** | 3015 | ✅ mcp-brain | ✅ | ❌ |
| **ngrok** | — | ❌ (gestionado por backend) | ❌ | ✅ |
| **agent-engine** | 3020 | ❌ **SIN AGENTE** | ❌ | ❌ |
| **agent-frontend** | 8081:80 | ❌ **SIN AGENTE** | ❌ | ❌ |
| **redis** | 6379 | ❌ (externo) | ❌ | ❌ |

### 3.3 Permisos

| Agente | read | edit | glob | grep | bash | task | mcp | websearch |
|--------|:----:|:----:|:----:|:----:|:----:|:----:|:---:|:---------:|
| orchestrator | allow | — | allow | allow | — | allow | allow | — |
| backend-dev | backend/** | backend/** | allow | allow | — | — | — | — |
| frontend-dev | frontend/** | frontend/** | allow | allow | — | — | — | — |
| mcp-brain | mcp-brain/** | mcp-brain/** | allow | allow | — | — | — | — |
| docker-ops | docker-compose.yml, Dockerfiles, *.yml | docker-compose.yml, Dockerfiles, *.yml | allow | allow | allow | — | — | — |
| documentation | *.md, obsidian-vault/** | *.md, obsidian-vault/** | allow | allow | — | — | — | — |

**Evaluación:** Los scopes de permisos son correctos y específicos. docker-ops necesita bash para `docker compose config`. documentation no necesita bash. Todo coherente.

---

## 4. HALLAZGOS CRÍTICOS

### 🔴 CRÍTICO 1: Servicios sin agente ni ruteo
`agent-engine` (Express + TypeScript, puerto 3020) y `agent-frontend` (React + Vite, puerto 8081) son servicios desplegados en producción via docker-compose pero **no existe ningún agente** para ellos. El orquestador no puede delegar tareas a estos dominios.

**Impacto:** Cualquier cambio en estos servicios requiere intervención manual. El orquestador no los conoce.

### 🔴 CRÍTICO 2: docker-ops.md desactualizado
- Afirma 4 servicios cuando el compose tiene 7.
- Faltan 4 Dockerfiles en la estructura.
- Afirma existencia de `.dockerignore` raíz que no existe.

**Impacto:** El agente docker-ops operará con información incorrecta, pudiendo generar configuraciones incompletas.

### 🟡 MEDIO 3: documentation sin auto-verificación
Es el único subagente sin sección `AUTO-VERIFICACIÓN`. No valida que los archivos que modifica existan, tengan formato correcto, o que el CHANGELOG siga el versionado.

### 🟡 MEDIO 4: Referencia huérfana en orchestrator.md
Línea 61: `- Reglas detalladas de cada dominio en .agents/rules/` — ese directorio NO existe.

### 🟢 LEVE 5: Sin modelo específico para agentes clave
backend-dev, frontend-dev, mcp-brain y docker-ops usan el modelo por defecto (llama3.2:3b) sin configuración explícita. Si el rendimiento no es óptimo, no hay forma de saberlo desde la configuración.

---

## 5. RECOMENDACIONES

### Inmediatas (prioridad alta)

1. **Crear agentes para `agent-engine` y `agent-frontend`:**
   - Seguir el mismo patrón de los agentes existentes (ESTRUCTURA + PATRONES + REGLAS + SCRIPTS + AUTO-VERIFICACIÓN + FLUJO)
   - `agent-engine`: Express + TypeScript, puerto 3020, Redis + BullMQ + SQLite
   - `agent-frontend`: React + Vite + nginx, puerto 8081 (estilo similar a frontend-dev pero más simple)
   - Registrar ambos en orchestrator.md y opencode.json

2. **Corregir docker-ops.md:**
   - Cambiar Stack a "7 servicios"
   - Agregar `mcp-brain/Dockerfile`, `agent-engine/Dockerfile`, `agent-frontend/Dockerfile` a la estructura
   - Agregar `redis` a la lista de servicios
   - Eliminar referencia al `.dockerignore` raíz (no existe)

3. **Eliminar referencia huérfana en orchestrator.md:**
   - Cambiar línea 61 o eliminar la nota

### Corto plazo (prioridad media)

4. **Agregar AUTO-VERIFICACIÓN a documentation.md:**
   ```markdown
   ## AUTO-VERIFICACIÓN
   Al terminar los cambios, verifica antes de responder:
   - Los archivos .md referenciados existen
   - CHANGELOG.md tiene formato válido: ## [X.Y.Z] - YYYY-MM-DD
   - README.md mantiene las secciones requeridas
   - Postman Collection es JSON válido
   ```

5. **Verificar que el modelo `gemma4:e2b` existe en el provider para documentation**

### Mediano plazo (prioridad baja)

6. **Considerar asignar explícitamente modelos a backend-dev y mcp-brain** si se detectan problemas de rendimiento con el modelo default.

7. **Estandarizar nombres de contenedores en docker-compose.yml**: algunos usan `mcp-ollama-motor`, `backend`, `brain`, `agent-engine`, etc. El agente docker-ops debería reflejar estos nombres exactos.

---

## 6. CONCLUSIONES

**Puntaje global del sistema de agentes: 78/100**

| Dominio | Puntaje | Estado |
|---------|:-------:|--------|
| Arquitectura general | 85 | ✅ Sólida |
| backend-dev | 92 | ✅ Excelente |
| frontend-dev | 90 | ✅ Muy bueno |
| mcp-brain | 93 | ✅ Excelente |
| docker-ops | 55 | ❌ Requiere corrección |
| documentation | 80 | ✅ Bueno (falta auto-verificación) |
| Configuración (opencode.json) | 90 | ✅ Limpia |
| Cobertura de servicios reales | 60 | ❌ Faltan 2 agentes |

**Fortalezas:**
- Patrón de diseño consistente entre todos los agentes
- Secciones ESTructura + PATRONES + REGLAS + SCRIPTS + AUTO-VERIFICACIÓN están bien logradas
- Permisos correctamente scopedos
- Flujo de auto-verificación incorporado en 4/5 subagentes
- MCP brain bien integrado como fuente de contexto

**Debilidades:**
- 2 servicios productivos sin representación como agentes (agent-engine, agent-frontend)
- docker-ops desactualizado contra la realidad del compose
- documentation sin auto-verificación
- 1 referencia huérfana en orquestador

---

*Auditoría generada por OpenCode — revisión estructural y funcional del sistema de agentes.*
