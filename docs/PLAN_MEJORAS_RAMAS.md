# Plan de Mejoras — Ramas por Fase

> Basado en la auditoría completa vs Hermes Agent y OpenClaw (28 Jun 2026)

---

## FASE 1 — Impacto Inmediato (Alta Prioridad)

| Rama | Descripción | Archivos est. |
|------|-------------|:---:|
| `feature/skills-system` | Sistema SKILL.md con progressive disclosure, auto-creación y reutilización de skills procedurales | ~12 |
| `feature/fts5-search` | Búsqueda full-text FTS5 sobre conversaciones en SQLite | ~3 |
| `feature/discord-gateway` | Adaptador Discord para el gateway (usando discord.js) | ~4 |

### Detalle

#### `feature/skills-system`
- Implementar SKILL.md procedural memory (YAML frontmatter + markdown)
- Progressive disclosure: Level 0 (lista), Level 1 (contenido completo), Level 2 (archivo específico)
- Tool de auto-creación de skills post-ejecución
- Registro en `toolRegistry` como `skill_manage`, `skill_view`, `skills_list`
- Almacenamiento en `~/.lallama/skills/`
- **Basado en:** Hermes Agent skills system

#### `feature/fts5-search`
- Migrar tabla `messages` a SQLite FTS5 virtual table
- Tool `session_search` para búsqueda full-text sobre conversaciones históricas
- Trigram tokenizer para soporte CJK/substring
- **Basado en:** Hermes Agent FTS5 session storage

#### `feature/discord-gateway`
- Nuevo adaptador gateway usando `discord.js`
- Misma interfaz que el adaptador Telegram actual
- Soporte: mensajes, archivos, comandos slash
- Sesiones aisladas por canal/hilo
- **Basado en:** OpenClaw/Hermes multi-channel gateway

---

## FASE 2 — Diferenciación (Media Prioridad)

| Rama | Descripción | Archivos est. |
|------|-------------|:---:|
| `feature/browser-automation` | Tool de browser automation con Playwright | ~5 |
| `feature/docker-sandbox` | Aislamiento de ejecución de tools en contenedores Docker | ~6 |
| `feature/self-improvement` | Background review post-turno que extrae memory/skills de la conversación | ~4 |
| `feature/whatsapp-gateway` | Adaptador WhatsApp para el gateway (Baileys) | ~4 |

### Detalle

#### `feature/browser-automation`
- Nueva tool `browser` basada en Playwright
- Acciones: `navigate`, `snapshot`, `click`, `type`, `screenshot`, `extract`
- Modo headless con Chromium
- Timeout configurable por acción
- Sandbox dentro de contenedor Docker (opcional)
- **Basado en:** Hermes Agent browser_tool.py

#### `feature/docker-sandbox`
- Container por sesión/agente para ejecución de `bash` tool
- Read-only rootfs, capabilities dropped, PID limits
- Workspace persistente vía volúmenes
- Tool enhanced: `bash` con flag `sandboxed: true/false`
- **Basado en:** Hermes Agent Docker backend, OpenClaw sandboxing

#### `feature/self-improvement`
- Background job post-turno en `runAgentCore.ts`
- Analiza la conversación completa vs. el resultado
- Extrae: patrones de éxito/fracaso, oportunidades de skill, mejoras de prompt
- Usa LLM auxiliar (modelo más barato) para el análisis
- Staging: escribe propuestas a `DREAMS.md` o cola de aprobación
- **Basado en:** Hermes Agent GEPA + background review

#### `feature/whatsapp-gateway`
- Adaptador WhatsApp vía Baileys (WebSocket, QR pairing)
- Soporte: mensajes de texto, imágenes, audio, documentos
- Sesiones aisladas por número de teléfono
- Integración con transcripción Whisper para audios
- **Basado en:** OpenClaw WhatsApp adapter

---

## FASE 3 — Madurez (Baja Prioridad)

| Rama | Descripción | Archivos est. |
|------|-------------|:---:|
| `feature/vision-tools` | Análisis de imágenes vía LLM multimodal (Ollama) | ~3 |
| `feature/multi-agent-routing` | Binding/routing determinista de mensajes a agentes específicos por canal/grupo | ~5 |
| `feature/skills-marketplace` | Repositorio comunitario de skills instalables desde registro remoto | ~8 |

### Detalle

#### `feature/vision-tools`
- Tool `vision_analyze` para analizar imágenes
- Soporte multimodal nativo en Ollama (LLaVA, BakLLaVA, etc.)
- Encode a base64, enviar como contenido multimodal al LLM
- Integración con el sistema de adjuntos existente
- **Basado en:** Hermes Agent vision_analyze tool

#### `feature/multi-agent-routing`
- Binding rules: `peer match` (DM/group exacto), `role match` (Discord roles), `channel match`
- Cada binding apunta a un agente con su propio workspace, SOUL.md, tools permitidas
- Aislamiento total de sesiones por agente
- UI en agent-frontend para gestionar bindings
- **Basado en:** OpenClaw multi-agent routing con bindings

#### `feature/skills-marketplace`
- Registro remoto de skills (formato SKILL.md + metadatos)
- Comandos: `install`, `update`, `list`, `search`, `verify`
- Verificación de seguridad: análisis de permisos declarados vs. reales
- Integración con el sistema de skills de Fase 1
- **Basado en:** OpenClaw ClawHub + Hermes skills hub

---

## Estrategia de flujo

```
main ──── feature/skills-system ──→ PR ──→ merge
   │
   ├── feature/fts5-search ────→ PR ──→ merge
   │
   ├── feature/discord-gateway ─→ PR ──→ merge
   │
   ├── feature/browser-automation ─→ PR ──→ merge
   │
   └── ... (cada feature independiente)
```

Cada rama se crea desde `main`, se desarrolla en paralelo (si no hay dependencias), y se integra vía PR con code review.

### Convenciones
- **Nombres:** `feature/<slug>` con kebab-case
- **Commits:** siguiendo conventional commits (`feat:`, `fix:`, `refactor:`, etc.)
- **PR:** mínimo 1 approval antes de merge a `main`
- **Post-merge:** borrar rama remota y local
