import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { DatabaseService } from "../database/connection.js";
import { analysis, audit, memories, sessions, settings, templates } from "../services/index.js";
import { normalizeProject } from "../services/normalizeProject.js";
import { generate } from "../services/llm/generate.js";
import type { AgentCompliance } from "../services/audit/getAgentCompliance.js";

const VALID_RELATIONS = [
    "related",
    "compatible",
    "scoped",
    "conflicts_with",
    "supersedes",
    "not_conflict",
] as const;

let currentProject: string | null = null;

export function createMcpServer(dbService: DatabaseService, directives?: string): Server {
	const baseInstructions = `Provides persistent memory that survives across sessions and compactions.

CORE TOOLS (always available):
  mem_save — save decisions, bugs, discoveries, conventions PROACTIVELY (do not wait to be asked)
  mem_search — find past work, decisions, or context from previous sessions
  mem_context — get recent session history
  mem_session_summary — save end-of-session summary (MANDATORY before saying "done")
  mem_get_observation — get full untruncated content of a search result by ID
  mem_save_prompt — save user prompt for context
  mem_current_project — detect current project from cwd (recommended first call)
  mem_get_directives — get core directives for the current project

DEFERRED TOOLS:
  mem_update, mem_suggest_topic_key, mem_session_start, mem_session_end, mem_stats, mem_delete, mem_timeline, mem_capture_passive

PROACTIVE SAVE RULE: Call mem_save immediately after ANY decision, bug fix, discovery, or convention — not just when asked.

## CONFLICT SURFACING — when mem_save returns candidates

After every mem_save call, check the response for judgment_required.

IF judgment_required IS TRUE:
  Iterate candidates[] and call mem_judge once per candidate using the judgment_id from that candidate entry.

  HEURISTIC — when to ask the user vs. resolve autonomously:
  ASK the user when confidence is below 0.7, OR the relation is supersedes/conflicts_with AND type is architecture/policy/decision.
  RESOLVE silently when confidence >= 0.7 AND relation is not supersedes/conflicts_with.`;

	// Inject core directives into instructions if available
	const fullInstructions = directives
		? `## 🎯 DIRECTIVAS CENTRALES DEL PROYECTO\n\n${directives}\n\n---\n\n${baseInstructions}`
		: baseInstructions;

	const mcpServer = new Server(
		{
			name: "lallamallama-brain",
			version: "1.0.0",
		},
		{
			capabilities: { tools: {} },
			instructions: fullInstructions,
		} as { capabilities: { tools: Record<string, unknown> }; instructions: string }
	);

	mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
		const tools: Array<{
			name: string;
			description: string;
			inputSchema: { type: string; properties: Record<string, unknown>; required?: string[] };
		}> = [
				{
					name: "mem_save",
					description: `Save important observations to persistent memory. Call after completing significant work.

Provide identity in 'agent' field, format content as **What**/**Why**/**Where**/**Learned**`,
					inputSchema: {
						type: "object",
						properties: {
							project: { type: "string" },
							type: { type: "string" },
							title: { type: "string" },
							content: { type: "string" },
							tags: { type: "string" },
							topic_key: { type: "string" },
							agent: {
								type: "string",
								description:
									"Name of the AI Model or IDE making this change (e.g. Cursor, Claude Code, RooCode, Antigravity, OpenCode AI)",
							},
						},
						required: ["project", "type", "title", "content"],
					},
				},
				{
					name: "mem_save_prompt",
					description: "Save user prompt to persistent memory for session context.",
					inputSchema: {
						type: "object",
						properties: {
							project: { type: "string" },
							content: { type: "string" },
							sessionId: { type: "string" },
						},
						required: ["project", "content"],
					},
				},
				{
					name: "mem_capture_passive",
					description: "Extract structured learnings from text output automatically.",
					inputSchema: {
						type: "object",
						properties: {
							project: { type: "string" },
							content: { type: "string" },
							sessionId: { type: "string" },
						},
						required: ["project", "content"],
					},
				},
				{
					name: "mem_suggest_topic_key",
					description: "Suggest a stable topic_key for grouping related memories.",
					inputSchema: {
						type: "object",
						properties: {
							title: { type: "string" },
							type: { type: "string" },
						},
						required: ["title"],
					},
				},
				{
					name: "mem_update",
					description: "Update an existing memory",
					inputSchema: {
						type: "object",
						properties: {
							id: { type: "string" },
							title: { type: "string" },
							content: { type: "string" },
							tags: { type: "string" },
							topic_key: { type: "string" },
						},
						required: ["id"],
					},
				},
				{
					name: "mem_delete",
					description: "Delete a memory",
					inputSchema: {
						type: "object",
						properties: { id: { type: "string" } },
						required: ["id"],
					},
				},
				{
					name: "mem_search",
					description: "Search memories using lexical or semantic hybrid search",
					inputSchema: {
						type: "object",
						properties: {
							query: { type: "string" },
							project: { type: "string" },
							mode: { type: "string", description: "lexical, semantic, hybrid" },
							limit: { type: "number" },
						},
						required: ["query", "project"],
					},
				},
				{
					name: "mem_context",
					description: "Get recent memories for a project",
					inputSchema: {
						type: "object",
						properties: { project: { type: "string" }, limit: { type: "number" } },
						required: ["project"],
					},
				},
				{
					name: "mem_timeline",
					description: "Get chronological timeline of memories",
					inputSchema: {
						type: "object",
						properties: { project: { type: "string" }, limit: { type: "number" } },
						required: ["project"],
					},
				},
				{
					name: "mem_session_start",
					description: "Start a new logical work session",
					inputSchema: {
						type: "object",
						properties: { project: { type: "string" }, name: { type: "string" } },
						required: ["project", "name"],
					},
				},
				{
					name: "mem_session_end",
					description: "End the work session and save summary",
					inputSchema: {
						type: "object",
						properties: { sessionId: { type: "string" }, summary: { type: "string" } },
						required: ["sessionId", "summary"],
					},
				},
				{
					name: "mem_session_summary",
					description: "Save end-of-session summary with goal, discoveries, and next steps.",
					inputSchema: {
						type: "object",
						properties: { sessionId: { type: "string" }, summary: { type: "string" } },
						required: ["sessionId", "summary"],
					},
				},
				{
					name: "mem_compare",
					description: "Compare two memories using local LLM",
					inputSchema: {
						type: "object",
						properties: {
							memoryId1: { type: "string" },
							memoryId2: { type: "string" },
							model: { type: "string" },
						},
						required: ["memoryId1", "memoryId2", "model"],
					},
				},
				{
					name: "mem_stats",
					description: "Get statistics about the brain",
					inputSchema: {
						type: "object",
						properties: { project: { type: "string" } },
						required: ["project"],
					},
				},
				{
					name: "mem_suggest_tags",
					description: "Get tag suggestions for a text",
					inputSchema: {
						type: "object",
						properties: {
							title: { type: "string" },
							content: { type: "string" },
							model: { type: "string" },
						},
						required: ["title", "content", "model"],
					},
				},
				{
					name: "mem_get_observation",
					description: "Retrieve a specific memory by ID",
					inputSchema: {
						type: "object",
						properties: { id: { type: "string" } },
						required: ["id"],
					},
				},
				{
					name: "mem_current_project",
					description: "Set or get the active project",
					inputSchema: {
						type: "object",
						properties: { project: { type: "string" } },
					},
				},
				{
					name: "mem_judge",
					description: "Record verdict on a memory conflict surfaced by mem_save. Provide judgment_id and relation.",
					inputSchema: {
						type: "object",
						properties: {
							judgment_id: { type: "string" },
							relation: {
                            type: "string",
                            enum: ["related", "compatible", "scoped", "conflicts_with", "supersedes", "not_conflict"],
                            description: "Relation type for the judgment verdict",
                        },
							reason: { type: "string" },
						},
						required: ["judgment_id", "relation"],
					},
				},
			{
				name: "scaffold_list_templates",
				description: "List available scaffolding templates for agents, rules, or workflows.",
				inputSchema: {
					type: "object",
					properties: {
						tool: { type: "string", description: "Filtrar por tool: antigravity | opencode | universal" },
						type: { type: "string", description: "Filtrar por type: rule | workflow | agent" },
					},
				},
			},
			{
				name: "scaffold_file",
				description: "Generate a scaffold file from a stored template with provided variables.",
				inputSchema: {
					type: "object",
					properties: {
						template_id: { type: "string", description: "ID del template (usar scaffold_list_templates para ver IDs disponibles)" },
						variables: { type: "object", description: "Variables para rellenar el template (clave: valor)" },
					},
					required: ["template_id", "variables"],
				},
			},
			{
				name: "mem_get_directives",
				description: "Get core directives (project rules and personality) for a project.",
				inputSchema: {
					type: "object",
					properties: {
						project: { type: "string", description: "Project name (default: lallamaollama)" },
					},
				},
			},
		];

		// --- CAPA 4: Inject agent identity field to all tools for audit compliance ---
		for (const tool of tools) {
			if (!tool.inputSchema.properties.agent) {
				tool.inputSchema.properties.agent = {
					type: "string",
					description:
						"YOUR IDENTITY — REQUIRED for audit tracking. Example: 'OpenCode AI', 'Cursor', 'Claude Code', 'Antigravity Gemini'.",
				};
			}
		}

		// --- CAPA 5: Add compliance self-audit tool ---
		tools.push({
			name: "mem_my_compliance",
			description: "Check your compliance status with the shared brain audit system.",
			inputSchema: {
				type: "object",
				properties: {
					agent: {
						type: "string",
						description: "Your identity (optional — defaults to auto-detected agent)",
					},
				},
			},
		});

		return { tools };
	});

	mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
		const startTime = Date.now();
		const { name, arguments: args } = request.params;
		const agentIdentity = extractAgentIdentity(args);
		let response: { content: Array<{ type: string; text: string }>; isError?: boolean } | undefined;

		try {
			switch (name) {
				case "mem_save": {
					const agentName = (args?.agent as string) || "Agente Autónomo MCP";
					const res = await memories.saveMemory(
						dbService,
						args?.project as string,
						args?.type as string,
						args?.title as string,
						args?.content as string,
						args?.tags as string,
						undefined,
						args?.topic_key as string,
						undefined,
						agentName
					);
					response = { content: [{ type: "text", text: JSON.stringify(res) }] };
					break;
				}
				case "mem_save_prompt": {
					const project = normalizeProject(args?.project as string);
					const memory = await memories.saveMemory(
						dbService,
						project,
						"prompt",
						"User Prompt",
						args?.content as string,
						"prompt",
						args?.sessionId as string
					);
					response = { content: [{ type: "text", text: `Prompt saved successfully. ID: ${memory.memory.id}` }] };
					break;
				}
				case "mem_capture_passive": {
					const project = normalizeProject(args?.project as string);
					const content = args?.content as string;
					const learnings: string[] = [];
					const matches = content.match(/## Key Learnings:[\s\S]*?(?=\n## |$)/i);
					if (matches) {
						const lines = matches[0]
							.split("\n")
							.filter((l: string) => l.trim().startsWith("-") || /^\d+\./.test(l.trim()));
						learnings.push(...lines);
					}
					if (learnings.length === 0) {
						response = { content: [{ type: "text", text: "No key learnings found." }] };
						break;
					}

					for (const l of learnings) {
						await memories.saveMemory(
							dbService,
							args?.project as string,
							"learning",
							"Passive Learning",
							l,
							"passive",
							args?.sessionId as string
						);
					}
					response = { content: [{ type: "text", text: `Captured ${learnings.length} learnings.` }] };
					break;
				}
				case "mem_suggest_topic_key": {
					const title = args?.title as string;
					const type = (args?.type as string) || "general";
					const fallbackSlug = title
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, "-")
						.replace(/(^-|-$)+/g, "");

					try {
						const model = process.env.OLLAMA_MODEL || "llama3.2:3b";
						const llmResult = await generate(model, `Given the title "${title}" and type "${type}", suggest a short stable topic key (2-5 words, lowercase, hyphen-separated) for grouping related memories. Return only the key.`, { temperature: 0.1, num_ctx: 512 });
						const cleaned = llmResult.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
						if (cleaned.length > 0) {
							response = { content: [{ type: "text", text: type + "/" + cleaned }] };
							break;
						}
					} catch {
						// Ollama unavailable - fall through to slug fallback
					}

					response = { content: [{ type: "text", text: type + "/" + fallbackSlug }] };
					break;
				}
				case "mem_update": {
					const success = await memories.updateMemory(
						dbService,
						args?.id as string,
						args?.title as string,
						args?.content as string,
						args?.tags as string,
						args?.topic_key as string
					);
					response = { content: [{ type: "text", text: success ? "Memory updated." : "Memory not found." }] };
					break;
				}
				case "mem_delete": {
					const success = await memories.deleteMemory(dbService, args?.id as string);
					response = { content: [{ type: "text", text: success ? "Memory deleted." : "Memory not found." }] };
					break;
				}
				case "mem_search": {
					const project = normalizeProject(args?.project as string);
					const mems = await memories.searchMemories(
						dbService,
						args?.query as string,
						project,
						(args?.mode as "lexical" | "semantic" | "hybrid" | undefined) || "hybrid",
						(args?.limit as number) || 10
					);
					response = { content: [{ type: "text", text: JSON.stringify(mems) }] };
					break;
				}
				case "mem_context": {
					const project = normalizeProject(args?.project as string);
					const mems = await memories.getContext(
						dbService,
						project,
						(args?.limit as number) || 20
					);
					response = { content: [{ type: "text", text: JSON.stringify(mems) }] };
					break;
				}
				case "mem_get_observation": {
					const memory = await memories.getMemory(dbService, args?.id as string);
					response = {
						content: [{ type: "text", text: memory ? JSON.stringify(memory) : "Not found" }],
					};
					break;
				}
				case "mem_current_project": {
					if (args?.project) {
						currentProject = normalizeProject(args.project as string);
						response = { content: [{ type: "text", text: `Active project set to: ${currentProject}` }] };
					} else {
						response = {
							content: [
								{
									type: "text",
									text: currentProject ? `Active project: ${currentProject}` : "No active project set.",
								},
							],
						};
					}
					break;
				}
				case "mem_session_start": {
					const project = normalizeProject(args?.project as string);
					const id = await sessions.startSession(dbService, project, args?.name as string);
					response = { content: [{ type: "text", text: `Session started. ID: ${id}` }] };
					break;
				}
				case "mem_session_end": {
					const success = await sessions.endSession(
						dbService,
						args?.sessionId as string,
						args?.summary as string
					);
					response = {
						content: [
							{ type: "text", text: success ? "Session ended and summarized." : "Session not found." },
						],
					};
					break;
				}
				case "mem_session_summary": {
					const summary = await sessions.getSessionSummary(dbService, args?.sessionId as string);
					response = { content: [{ type: "text", text: JSON.stringify(summary) }] };
					break;
				}
				case "mem_timeline": {
					const project = normalizeProject(args?.project as string);
					const timeline = await memories.getTimeline(
						dbService,
						project,
						(args?.limit as number) || 20
					);
					response = { content: [{ type: "text", text: JSON.stringify(timeline) }] };
					break;
				}
				case "mem_suggest_tags": {
					try {
						const tags = await analysis.suggestTags(
							args?.model as string,
							args?.title as string,
							args?.content as string
						);
						response = { content: [{ type: "text", text: tags.join(", ") }] };
					} catch {
						response = {
							content: [
								{
									type: "text",
									text: "OLLAMA_UNAVAILABLE: Por favor, genera las etiquetas tú mismo basándote en tu propia comprensión del texto y luego invoca la herramienta de guardado nuevamente con esas etiquetas.",
								},
							],
						};
					}
					break;
				}
				case "mem_judge": {
					const relation = args?.relation as string;
					if (!VALID_RELATIONS.includes(relation as typeof VALID_RELATIONS[number])) {
						response = {
							content: [{ type: "text", text: `Error: Invalid relation "${relation}". Valid values: ${VALID_RELATIONS.join(", ")}` }],
							isError: true,
						};
						break;
					}
					const success = await analysis.judge(
						dbService,
						args?.judgment_id as string,
						relation,
						args?.reason as string
					);
					response = {
						content: [
							{ type: "text", text: success ? "Judgment recorded." : "Failed to record judgment." },
						],
					};
					break;
				}
				case "mem_compare": {
					try {
						const comparison = await analysis.compareMemories(
							dbService,
							args?.model as string,
							args?.memoryId1 as string,
							args?.memoryId2 as string
						);
						response = { content: [{ type: "text", text: JSON.stringify(comparison) }] };
					} catch (e: unknown) {
						const message = e instanceof Error ? e.message : String(e);
						if (message.includes("not found")) {
							response = { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
						} else {
							response = {
								content: [
									{
										type: "text",
										text: "OLLAMA_UNAVAILABLE: Por favor, usa mem_get_observation para leer ambas memorias en tu contexto y compáralas tú mismo utilizando tus propias capacidades de razonamiento.",
									},
								],
							};
						}
					}
					break;
				}
				case "mem_stats": {
					const project = normalizeProject(args?.project as string);
					const stats = await memories.getStats(dbService, project);
					response = { content: [{ type: "text", text: JSON.stringify(stats) }] };
					break;
				}
				case "mem_get_directives": {
					const project = normalizeProject((args?.project as string) || "lallamaollama");
					const content = await settings.getCoreDirectives(dbService, project);
					response = {
						content: [
							{
								type: "text",
								text: content
									? `## Directivas Centrales: ${project}\n\n${content}`
									: `No hay directivas definidas para "${project}".`,
							},
						],
					};
					break;
				}
				case "mem_my_compliance": {
					const targetAgent = (args?.agent as string) || agentIdentity;
					const compliance = await audit.getAgentCompliance(dbService, targetAgent, 24);
					response = { content: [{ type: "text", text: JSON.stringify(compliance) }] };
					break;
				}
				case "scaffold_list_templates": {
					const list = await templates.listTemplates(
						dbService,
						args?.tool as string | undefined,
						args?.type as string | undefined,
					);
					const summary = list.map((t) => ({
						id: t.id,
						tool: t.tool,
						type: t.type,
						name: t.name,
						description: t.description,
						output_path: t.output_path,
						variables: t.variables.map((v) => ({
							name: v.name,
							description: v.description,
							required: v.required,
							default: v.default,
						})),
						is_seed: t.is_seed,
					}));
					response = { content: [{ type: "text", text: JSON.stringify(summary) }] };
					break;
				}
				case "scaffold_file": {
					const tpl = await templates.getTemplate(dbService, args?.template_id as string);
					if (!tpl) {
						response = {
							content: [{ type: "text", text: `Template "${args?.template_id}" not found. Use scaffold_list_templates to see available templates.` }],
							isError: true,
						};
						break;
					}
					const vars = (args?.variables as Record<string, string>) || {};
					const result = templates.renderTemplate(tpl, vars);
					const payload = {
						content: result.content,
						output_path: result.output_path,
						missing: result.missing,
						template: { id: tpl.id, name: tpl.name, tool: tpl.tool, type: tpl.type },
						hint: result.missing.length > 0
							? `Faltan variables requeridas: ${result.missing.join(", ")}. Provéelas y vuelve a llamar scaffold_file.`
							: result.output_path
							? `Contenido listo. Pregunta al usuario: "¿Guardo el archivo en ${result.output_path}?" y si acepta, usa tu herramienta de escritura de archivos.`
							: "Contenido generado correctamente.",
					};
					response = { content: [{ type: "text", text: JSON.stringify(payload) }] };
					break;
				}
				default:
					response = { content: [{ type: "text", text: `Tool ${name} implemented but handler missing.` }] };
			}
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			response = { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
		}

		// --- CAPA 1: AUDIT LOG — automático, inevitable, transparente para el agente ---
		if (response) {
			const durationMs = Date.now() - startTime;
			const resultStatus = response.isError ? "error" : "success";
			const resultText = response.content?.[0]?.text || "";

			// Normalize project for audit logging
			const rawProject = args?.project as string | undefined;
			const auditProject = rawProject ? normalizeProject(rawProject) : "";

			// Fire-and-forget: no bloqueamos la respuesta del agente
			audit
				.logToolCall(dbService, {
					toolName: name,
					agentIdentity,
					args,
					resultStatus,
					resultPreview: resultText,
					durationMs,
					project: auditProject,
				})
				.catch((err: unknown) => console.error("[Audit] Error logging tool call:", err));
			// Cleanup oportunista: 1 de cada 100 llamadas elimina registros >30 días
			if (Math.random() < 0.01) {
				dbService.getDb().run(
					`DELETE FROM mcp_audit_log WHERE timestamp < ?`,
					[Date.now() - 30 * 24 * 60 * 60 * 1000]
				).catch((err: unknown) => console.error("[Audit] Cleanup error:", err));
			}

			// --- CAPA 3: COMPLIANCE REMINDER — solo herramientas de solo lectura ---
			if (resultStatus === "success" && isReadOnlyTool(name)) {
				try {
					const compliance = await audit.getAgentCompliance(dbService, agentIdentity, 24);
					if (compliance.needsReminder) {
						const reminder = buildComplianceReminder(compliance);
						response.content[0].text += "\n\n" + reminder;
					}
				} catch (err) {
					console.error("[Audit] Error checking compliance:", err);
				}
			}
		}

		return response;
	});

	return mcpServer;
}

// ---------------------------------------------------------------------------
// Helpers de auditoría y compliance
// ---------------------------------------------------------------------------

const READ_ONLY_TOOLS = new Set([
	"mem_search",
	"mem_context",
	"mem_timeline",
	"mem_stats",
	"mem_get_observation",
	"mem_current_project",
	"mem_get_directives",
	"mem_my_compliance",
	"mem_suggest_tags",
	"mem_suggest_topic_key",
	"mem_compare",
	"scaffold_list_templates",
]);

function isReadOnlyTool(name: string): boolean {
	return READ_ONLY_TOOLS.has(name);
}

/**
 * Extrae la identidad del agente desde los argumentos de la tool.
 * Muchas tools tienen un campo `agent` opcional. Si no está presente,
 * usamos un fallback para identificar la sesión.
 */
function extractAgentIdentity(args: Record<string, unknown> | undefined): string {
	if (!args) return "unknown-agent";
	return (args.agent as string) || (args.caller as string) || "unknown-agent";
}

/**
 * Construye un mensaje de recordatorio de compliance para incluir
 * en la respuesta de una tool de solo lectura.
 */
function buildComplianceReminder(compliance: AgentCompliance): string {
	const lastSave = compliance.lastSaveTimestamp
		? `${new Date(compliance.lastSaveTimestamp).toLocaleString()} (${compliance.hoursSinceLastSave}h ago)`
		: "NEVER";
	return [
		`[COMPLIANCE] Agent: ${compliance.agentIdentity} | Score: ${compliance.complianceScore}% (${compliance.totalSaves}/${compliance.totalCalls}) | Last save: ${lastSave}`,
		`Policy: ALL agents must log work via mem_save. Call mem_save with your recent changes, or check mem_my_compliance anytime.`,
	].join("\n");
}

export async function startMcpServer(dbService: DatabaseService, directives?: string) {
	const mcpServer = createMcpServer(dbService, directives);
	const transport = new StdioServerTransport();
	await mcpServer.connect(transport);
	console.error(`[Brain MCP] MCP Server running on Stdio`);
}
