import type { Database } from "sqlite";
import type sqlite3 from "sqlite3";

// Seeds: 5 templates base del sistema
const SEED_TEMPLATES = [
	{
		id: "antigravity-rule-project",
		tool: "antigravity",
		type: "rule",
		name: "Project Rule",
		description:
			"Regla always_on para un proyecto — contiene estructura, servicios Docker, convenciones de código y tipos de memoria.",
		output_path: ".agents/rules/{{project}}.md",
		variables: JSON.stringify([
			{
				name: "project",
				description: "Nombre del proyecto (slug, ej: lallamaollama)",
				required: true,
			},
			{
				name: "description",
				description: "Descripción corta del proyecto",
				required: true,
			},
			{
				name: "mcp_server_name",
				description: "Nombre del servidor MCP (ej: lallamaollama-brain)",
				required: true,
			},
			{
				name: "brain_url",
				description: "URL del servidor MCP (ej: http://192.168.0.236:3015/sse)",
				required: true,
			},
			{
				name: "project_structure",
				description: "Árbol de directorios del proyecto",
				required: false,
				default: "└── (describir estructura)",
			},
			{
				name: "coding_rules",
				description: "Reglas de código específicas del proyecto",
				required: false,
				default: "1. Seguir convenciones del proyecto.",
			},
		]),
		content: `---
trigger: always_on
glob:
description: Reglas específicas del proyecto {{project}}. Complementan las reglas globales de GEMINI.md.
---

# Reglas del Proyecto — {{project}}

## CEREBRO MCP DE ESTE PROYECTO

- **Nombre del servidor**: \`{{mcp_server_name}}\`
- **Proyecto activo**: \`{{project}}\`
- **URL**: \`{{brain_url}}\`

Siempre pasar \`project: "{{project}}"\` en toda llamada al cerebro.

---

## DESCRIPCIÓN

{{description}}

---

## ESTRUCTURA DEL PROYECTO

\`\`\`
{{project_structure}}
\`\`\`

---

## REGLAS DE CÓDIGO

{{coding_rules}}

---

## TIPOS DE MEMORIA POR TAREA

| Tarea | \`type\` |
|-------|---------|
| Nueva feature implementada | \`feature\` |
| Bug fix | \`bug-fix\` |
| Decisión de arquitectura | \`architecture\` |
| Convención establecida | \`convention\` |
| Cambio de configuración | \`configuration\` |
`,
	},
	{
		id: "antigravity-workflow-session-start",
		tool: "antigravity",
		type: "workflow",
		name: "Session Start",
		description:
			"Workflow de inicio de sesión — recupera contexto del cerebro MCP antes de comenzar a trabajar.",
		output_path: ".agents/workflows/session-start.md",
		variables: JSON.stringify([
			{
				name: "project",
				description: "Nombre del proyecto (slug)",
				required: true,
			},
		]),
		content: `---
description: Workflow de inicio de sesión para {{project}}. Recupera contexto del cerebro antes de comenzar a trabajar.
---

# Workflow — Inicio de Sesión en {{project}}

Al comenzar cualquier conversación sobre este proyecto, ejecutar en orden:

## PASO 1 — Activar proyecto

\`\`\`
mem_current_project(project: "{{project}}")
\`\`\`

## PASO 2 — Cargar contexto reciente

\`\`\`
mem_context(project: "{{project}}", limit: 10)
\`\`\`

## PASO 3 — Buscar contexto del tema actual

\`\`\`
mem_search(
  query: "<tema del pedido del usuario>",
  project: "{{project}}",
  mode: "hybrid",
  limit: 5
)
\`\`\`

Usar el contexto recuperado para:
- No repetir trabajo ya hecho
- Respetar decisiones arquitectónicas previas
- Mantener consistencia con convenciones establecidas

> Si un resultado aparece truncado, recuperar el contenido completo con:
> \`mem_get_observation(id: "<id>")\`
`,
	},
	{
		id: "opencode-agent-subagent",
		tool: "opencode",
		type: "agent",
		name: "Subagent",
		description:
			"Agente especializado (subagente) para OpenCode AI — enfocado en un dominio o directorio específico del proyecto.",
		output_path: ".opencode/agents/{{agent_name}}.md",
		variables: JSON.stringify([
			{
				name: "agent_name",
				description: "Nombre del agente (slug, ej: backend-dev)",
				required: true,
			},
			{
				name: "description",
				description: "Descripción de una línea del agente",
				required: true,
			},
			{
				name: "directory",
				description: "Directorio principal del agente (ej: backend/)",
				required: true,
			},
			{
				name: "stack",
				description: "Stack tecnológico (ej: Express 4 + TypeScript)",
				required: true,
			},
			{
				name: "port",
				description: "Puerto del servicio (si aplica)",
				required: false,
				default: "",
			},
			{
				name: "entry_point",
				description: "Archivo de entrada (ej: src/main.ts)",
				required: false,
				default: "src/index.ts",
			},
			{
				name: "build_command",
				description: "Comando de build (ej: npm run build)",
				required: false,
				default: "npm run build",
			},
		]),
		content: `---
name: {{agent_name}}
description: {{description}}
mode: subagent
permission:
  read:
    "{{directory}}**": "allow"
    "*": "deny"
  edit:
    "{{directory}}**": "allow"
    "*": "deny"
  glob: "allow"
  grep: "allow"
  task: "allow"
  mcp: "allow"
  todowrite: "allow"
---

Eres un agente especializado en {{directory}} del proyecto.

## PROYECTO

- **Ubicación**: \`{{directory}}\`
- **Stack**: {{stack}}
- **Puerto**: {{port}}
- **Entry point**: \`{{entry_point}}\`

## FLUJO DE TRABAJO

1. Antes de implementar: \`mem_search(query: "<tema>", project: "<proyecto>")\` para revisar decisiones previas
2. Implementa los cambios solicitados
3. **Registra en el cerebro** con \`mem_save\`:
   - \`project\`: nombre del proyecto
   - \`type\`: \`"bug-fix"\` / \`"feature"\` / \`"architecture"\` / \`"convention"\`
   - \`title\`: título corto y buscable
   - \`agent\`: \`"OpenCode {{agent_name}}"\`
   - \`content\`: formato \`**What** / **Why** / **Where** / **Learned**\`
4. Invoca \`qa-verification\` vía \`task\` con:
   - \`project\`: nombre del dominio
   - \`changes\`: descripción de lo implementado
   - \`commands\`: \`{{build_command}}\`
`,
	},
	{
		id: "opencode-agent-orchestrator",
		tool: "opencode",
		type: "agent",
		name: "Orchestrator",
		description:
			"Agente orquestador principal para OpenCode AI — punto de entrada único que delega a sub-agentes especializados.",
		output_path: ".opencode/agents/orchestrator.md",
		variables: JSON.stringify([
			{
				name: "project_name",
				description: "Nombre del proyecto",
				required: true,
			},
			{
				name: "project_description",
				description: "Descripción del proyecto",
				required: true,
			},
			{
				name: "subagents",
				description:
					"Lista de sub-agentes disponibles (uno por línea: nombre | especialidad)",
				required: false,
				default:
					"- qa-verification | Control de calidad\n- documentation | Documentación",
			},
		]),
		content: `---
name: orchestrator
description: Orquestador principal de {{project_name}}. Analiza requerimientos, delega a sub-agentes y consolida resultados.
mode: primary
permission:
  read: allow
  glob: allow
  grep: allow
  task: allow
  mcp: allow
---

Eres el orquestador principal de **{{project_name}}**.

{{project_description}}

## AGENTES ESPECIALIZADOS

{{subagents}}

## FLUJO DE TRABAJO

0. **Recuperar contexto** — \`mem_context(project: "<proyecto>", limit: 10)\`
1. Lee y analiza el requerimiento del usuario
2. Identifica sub-proyectos afectados
3. Delega a los sub-agentes vía \`task\`
4. Espera resultados y verifica consistencia
5. Invoca \`qa-verification\`
6. Invoca \`documentation\`
7. **Guarda resumen** — \`mem_session_summary(sessionId, summary)\`
8. Responde al usuario

## NOTAS

- NO edites código directamente. Delega siempre.
- Si \`qa-verification\` reporta errores, corrige antes de documentar.
- Si el requerimiento es ambiguo, pide aclaración antes de delegar.
`,
	},
	{
		id: "universal-workflow-memory-save",
		tool: "universal",
		type: "workflow",
		name: "Memory Save",
		description:
			"Workflow universal para guardar memorias en cualquier servidor MCP compatible. Incluye los 3 pasos: suggest_topic_key → mem_save → mem_judge.",
		output_path: ".agents/workflows/memory-save.md",
		variables: JSON.stringify([
			{
				name: "project",
				description: "Nombre del proyecto por defecto",
				required: true,
			},
			{
				name: "agent_identity",
				description: "Identidad del agente (ej: Antigravity / Claude Sonnet)",
				required: true,
			},
		]),
		content: `---
description: Workflow para guardar memorias en el Cerebro MCP. Ejecutar después de completar trabajo significativo.
---

# Workflow — Guardar Memoria en el Cerebro MCP

## CUÁNDO EJECUTAR

- ✅ Nueva feature o componente implementado
- ✅ Bug fix (cualquier tamaño)
- ✅ Decisión arquitectónica o de diseño
- ✅ Convención o patrón nuevo establecido
- ✅ Cambio de configuración o infraestructura
- ✅ Gotcha o edge case descubierto

---

## PASO 1 — (Opcional) Obtener topic_key para temas evolutivos

\`\`\`
mem_suggest_topic_key(title: "<título>", type: "<type>")
\`\`\`

---

## PASO 2 — Guardar

\`\`\`
mem_save(
  project:   "{{project}}",
  type:      "<feature|bug-fix|architecture|convention|configuration>",
  title:     "<título corto y buscable>",
  agent:     "{{agent_identity}}",
  content:   "**What**: ...\\n**Why**: ...\\n**Where**: ...\\n**Learned**: ...",
  topic_key: "<del Paso 1 — opcional>"
)
\`\`\`

---

## PASO 3 — Resolver conflictos (si judgment_required: true)

\`\`\`
mem_judge(
  judgment_id: "<candidates[i].judgment_id>",
  relation:    "related|compatible|scoped|conflicts_with|supersedes|not_conflict",
  reason:      "<explicación opcional>"
)
\`\`\`

**Resolver solo** si \`confidence >= 0.7\` y la relación NO es \`supersedes/conflicts_with\`.
**Preguntar al usuario** si hay duda o si la relación es \`supersedes/conflicts_with\` en tipo \`architecture\`.
`,
	},
];

export async function createTemplatesTable(
	db: Database<sqlite3.Database, sqlite3.Statement>,
) {
	await db.exec(`
		CREATE TABLE IF NOT EXISTS templates (
			id          TEXT PRIMARY KEY,
			tool        TEXT NOT NULL,
			type        TEXT NOT NULL,
			name        TEXT NOT NULL,
			description TEXT,
			content     TEXT NOT NULL,
			variables   TEXT NOT NULL DEFAULT '[]',
			output_path TEXT,
			is_seed     INTEGER NOT NULL DEFAULT 0,
			created_at  INTEGER NOT NULL,
			updated_at  INTEGER NOT NULL
		)
	`);

	// Seed base templates (INSERT OR IGNORE to be idempotent)
	const now = Date.now();
	for (const t of SEED_TEMPLATES) {
		await db.run(
			`INSERT OR IGNORE INTO templates
				(id, tool, type, name, description, content, variables, output_path, is_seed, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
			t.id,
			t.tool,
			t.type,
			t.name,
			t.description,
			t.content,
			t.variables,
			t.output_path,
			now,
			now,
		);
	}
}
