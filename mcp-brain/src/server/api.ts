import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import cors from "cors";
import express from "express";
import type { DatabaseService } from "../database/connection.js";
import { brainAuthMiddleware } from "../middleware/auth.middleware.js";
import {
	analysis,
	conversation,
	memories,
	sessions,
	settings,
	templates,
} from "../services/index.js";
import { mergeProjects } from "../services/memories/mergeProjects.js";
import { normalizeProject } from "../services/normalizeProject.js";
import logger from "../utils/logger.js";
import { createMcpServer } from "./mcp.js";

const log = logger.child({ component: "api" });
const PORT = process.env.BRAIN_PORT || 3015;

export function startApiServer(
	dbService: DatabaseService,
	directives?: string,
) {
	const app = express();
	app.use(cors());
	app.use(express.json());

	// Request logging middleware
	app.use((req, res, next) => {
		const start = Date.now();
		res.on("finish", () => {
			log.info(
				{
					method: req.method,
					path: req.path,
					status: res.statusCode,
					durationMs: Date.now() - start,
				},
				"HTTP request",
			);
		});
		next();
	});

	// Auth middleware for all /api/* routes (except health, exempted in middleware)
	app.use("/api", brainAuthMiddleware);

	// Health check
	app.get("/api/health", (_req, res) => {
		const startTime = process.uptime();
		res.json({
			status: "ok",
			service: "mcp-brain",
			version: "1.0.0",
			uptime: Math.floor(startTime),
		});
	});

	// Returns true if running inside a Docker container
	function isRunningInDocker(): boolean {
		try {
			return (
				fs.existsSync("/.dockerenv") ||
				fs.readFileSync("/proc/1/cgroup", "utf8").includes("docker")
			);
		} catch {
			return false;
		}
	}

	// Auto-Sync MCP (SSE / Docker-based)
	app.post("/api/mcp/sync", async (req, res) => {
		const { target } = req.body;
		log.info({ target }, "POST /api/mcp/sync");
		try {
			const brainPort = process.env.BRAIN_PORT || "3015";
			const hostIp = process.env.HOST_IP || "localhost";
			const sseUrl = `http://${hostIp}:${brainPort}/sse`;

			// --- Config SSE para cada herramienta ---

			// OpenCode AI usa schema propio con "type": "remote"
			const openCodeSseConfig = {
				type: "remote",
				url: sseUrl,
			};

			// Claude Desktop / RooCode / Antigravity usan schema estandar con "type": "url"
			const claudeCompatSseConfig = {
				type: "url",
				url: sseUrl,
			};

			const dockerEnv = isRunningInDocker();

			const updateMcpFile = (
				filePath: string,
				serverKey: string,
				configObj: Record<string, unknown>,
			) => {
				if (dockerEnv) {
					// In Docker, return config as downloadable JSON instead of writing to host
					const configBlock = { mcpServers: { [serverKey]: configObj } };
					return res.json({
						success: true,
						dockerDownload: true,
						message: `Como estás dentro de Docker, descarga este archivo JSON y colócalo en: ${filePath}`,
						config: configBlock,
						targetPath: filePath,
					});
				}
				const dir = path.dirname(filePath);
				if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
				let data: { mcpServers?: Record<string, unknown> } = { mcpServers: {} };
				if (fs.existsSync(filePath)) {
					try {
						data = JSON.parse(fs.readFileSync(filePath, "utf8"));
					} catch {
						data = { mcpServers: {} };
					}
				}
				data.mcpServers = data.mcpServers || {};
				data.mcpServers[serverKey] = configObj;
				fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
			};

			// Antigravity usa Docker stdio para evitar problemas de certificados/HTTPS
			const hostProjectPath =
				process.env.HOST_PROJECT_PATH || "C:/path/to/project";
			const antigravityConfig = {
				command: "docker",
				args: [
					"run",
					"-i",
					"--rm",
					"-e",
					"OLLAMA_API_URL=http://host.docker.internal:11434",
					"--add-host=host.docker.internal:host-gateway",
					"-v",
					`${hostProjectPath}/data:/app/data`,
					"lallamaollama-mcp-brain",
					"node",
					"dist/index.js",
				],
			};

			if (target === "opencode") {
				const openCodePath = path.resolve(process.cwd(), "../opencode.json");
				if (fs.existsSync(openCodePath)) {
					const configData = JSON.parse(fs.readFileSync(openCodePath, "utf8"));
					configData.mcp = configData.mcp || {};
					configData.mcp["lallamaollama-brain"] = openCodeSseConfig;
					fs.writeFileSync(
						openCodePath,
						JSON.stringify(configData, null, 2),
						"utf8",
					);
					return res.json({
						success: true,
						message:
							"¡Configuración de OpenCode AI sincronizada con éxito! (SSE remoto)",
					});
				} else {
					return res.status(404).json({
						error:
							"No se encontró el archivo opencode.json en la raíz del proyecto.",
					});
				}
			} else if (target === "antigravity") {
				const agPath = path.join(
					os.homedir(),
					".gemini/antigravity/mcp_config.json",
				);
				updateMcpFile(agPath, "lallamaollama-brain", antigravityConfig);
				return res.json({
					success: true,
					message: `¡Motor Antigravity AI sincronizado con éxito! (Docker MCP en ${hostProjectPath})`,
				});
			} else if (target === "claudedesktop") {
				const claudeConfigPath =
					process.env.CLAUDE_CONFIG_PATH ||
					path.join(
						os.homedir(),
						"AppData",
						"Roaming",
						"Claude",
						"claude_desktop_config.json",
					);
				const cdPath = claudeConfigPath;
				updateMcpFile(cdPath, "lallamaollama-brain", claudeCompatSseConfig);
				return res.json({
					success: true,
					message: "¡Claude Desktop sincronizado con éxito! (SSE remoto)",
				});
			} else if (target === "roocode") {
				const rooConfigPath =
					process.env.ROOCODE_CONFIG_PATH ||
					path.join(
						os.homedir(),
						"AppData",
						"Roaming",
						"Code",
						"User",
						"globalStorage",
						"saoudrizwan.claude-dev",
						"settings",
						"claude_desktop_config.json",
					);
				const rooPath = rooConfigPath;
				updateMcpFile(rooPath, "lallamaollama-brain", claudeCompatSseConfig);
				return res.json({
					success: true,
					message:
						"¡RooCode / Cline sincronizado con éxito en VS Code! (SSE remoto)",
				});
			} else if (target === "cursor" || target === "claudecode") {
				return res.json({
					success: true,
					message: `¡Copia y pega este bloque en los ajustes de ${target.toUpperCase()}:`,
					config: { "lallamaollama-brain": claudeCompatSseConfig },
				});
			} else if (target === "windsurf") {
				return res.json({
					success: true,
					message: "¡Copia y pega este bloque en los ajustes de WINDSURF:",
					config: { "lallamaollama-brain": claudeCompatSseConfig },
				});
			} else {
				return res.status(400).json({ error: "Destino no soportado." });
			}
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.get("/api/memory/stats", async (req, res) => {
		const project = normalizeProject(
			(req.query.project as string) || "lallamaollama",
		);
		log.info({ project }, "GET /api/memory/stats");
		try {
			const stats = await memories.getStats(dbService, project);
			res.json(stats);
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.get("/api/memory/search", async (req, res) => {
		const q = (req.query.q as string) || "";
		const project = normalizeProject(
			(req.query.project as string) || "lallamaollama",
		);
		const mode =
			(req.query.mode as "lexical" | "semantic" | "hybrid") || "hybrid";
		const limit = parseInt((req.query.limit as string) || "50", 10);
		const offset = parseInt((req.query.offset as string) || "0", 10);
		const typeFilter = (req.query.type as string) || "";
		log.info(
			{
				project,
				query: q.substring(0, 80),
				mode,
				limit,
				offset,
				type: typeFilter || undefined,
			},
			"GET /api/memory/search",
		);
		try {
			const results =
				q.trim() === ""
					? await memories.getContext(dbService, project, limit, false, offset)
					: await memories.searchMemories(
							dbService,
							q,
							project,
							mode,
							limit,
							offset,
							typeFilter,
						);
			res.json(results);
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.get("/api/memory/timeline", async (req, res) => {
		const project = normalizeProject(
			(req.query.project as string) || "lallamaollama",
		);
		const type = req.query.type as string | undefined;
		const limit = parseInt((req.query.limit as string) || "100", 10);
		const offset = parseInt((req.query.offset as string) || "0", 10);
		log.info({ project, type, limit, offset }, "GET /api/memory/timeline");
		try {
			const results = await memories.getTimeline(
				dbService,
				project,
				limit,
				type,
				offset,
			);
			res.json(results);
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Get recent context (for agent-engine integration)
	app.get("/api/memory/context", async (req, res) => {
		const project = normalizeProject(
			(req.query.project as string) || "lallamaollama",
		);
		const limit = parseInt((req.query.limit as string) || "15", 10);
		try {
			const ctx = await memories.getContext(dbService, project, limit);
			if (Array.isArray(ctx)) {
				const text = ctx
					.map(
						(m: Record<string, unknown>) =>
							`[${m.type}] ${m.title}: ${String(m.content || "").substring(0, 500)}`,
					)
					.join("\n\n");
				res.json({ context: text });
			} else {
				res.json({ context: String(ctx) });
			}
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.get("/api/memory/:id", async (req, res) => {
		log.info({ id: req.params.id }, "GET /api/memory/:id");
		try {
			const memory = await memories.getMemory(dbService, req.params.id);
			if (!memory) return res.status(404).json({ error: "Memory not found" });
			res.json(memory);
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.put("/api/memory/:id", async (req, res) => {
		const { title, content, tags, phase, type } = req.body;
		log.info({ id: req.params.id, title, type }, "PUT /api/memory/:id");
		try {
			const success = await memories.updateMemory(
				dbService,
				req.params.id,
				title,
				content,
				tags,
				undefined,
				phase,
				type,
			);
			if (success) res.json({ message: "Memory updated" });
			else res.status(404).json({ error: "Memory not found" });
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.delete("/api/memory/:id", async (req, res) => {
		log.info({ id: req.params.id }, "DELETE /api/memory/:id");
		try {
			const success = await memories.deleteMemory(dbService, req.params.id);
			if (success) res.json({ message: "Memory deleted" });
			else res.status(404).json({ error: "Memory not found" });
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Projects
	app.get("/api/projects", async (_req, res) => {
		log.info("GET /api/projects");
		try {
			const db = dbService.getDb();
			const rows = await db.all(`
				SELECT DISTINCT project FROM memories 
				UNION 
				SELECT DISTINCT project FROM core_directives
			`);
			const projects = Array.from(
				new Set([
					"lallamaollama",
					...rows.map((r: { project: string }) => normalizeProject(r.project)),
				]),
			);
			res.json(projects);
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.delete("/api/projects/:name", async (req, res) => {
		const projectName = normalizeProject(req.params.name);
		log.info({ project: projectName }, "DELETE /api/projects/:name");
		if (projectName === "lallamaollama") {
			return res
				.status(403)
				.json({ error: "No se puede eliminar el proyecto principal." });
		}
		try {
			const result = await memories.deleteProject(dbService, projectName);
			res.json({
				success: true,
				message: `Proyecto "${projectName}" eliminado correctamente.`,
				deletedMemories: result.deletedMemories,
				deletedDirectives: result.deletedDirectives,
			});
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Ensure project exists (create if not)
	app.post("/api/projects/ensure", async (req, res) => {
		const rawName = (req.body.name as string) || "";
		log.info({ name: rawName }, "POST /api/projects/ensure");
		if (!rawName.trim()) {
			return res.status(400).json({ error: "name is required" });
		}
		const projectName = normalizeProject(rawName);
		try {
			const db = dbService.getDb();
			// Check if project already exists in memories or directives
			const existing = await db.get(
				`SELECT 1 FROM (
					SELECT project FROM memories WHERE project = ?
					UNION
					SELECT project FROM core_directives WHERE project = ?
				) LIMIT 1`,
				[projectName, projectName],
			);
			if (existing) {
				return res.json({ created: false, project: projectName });
			}
			// Create seed memory to register the project
			const seedId = `mem_${Date.now()}_seed`;
			const now = Date.now();
			await dbService.enqueueWrite(async () => {
				await db.run(
					`INSERT INTO memories (id, project, type, title, content, tags, createdAt, updatedAt)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						seedId,
						projectName,
						"project-created",
						`Proyecto ${projectName} creado automáticamente`,
						`**What**: Proyecto creado desde el AI Agent Wizard\n**Why**: Necesario para registrar agentes generados automáticamente\n**Where**: Proyecto: ${projectName}`,
						"auto-generated",
						now,
						now,
					],
				);
			});
			return res.status(201).json({ created: true, project: projectName });
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Merge projects
	app.post("/api/projects/merge", async (req, res) => {
		try {
			const source = normalizeProject(req.body.source as string);
			const target = normalizeProject(req.body.target as string);
			if (!source || !target) {
				return res
					.status(400)
					.json({ error: "source and target are required" });
			}
			if (source === target) {
				return res
					.status(400)
					.json({ error: "source and target must be different projects" });
			}
			const result = await mergeProjects(dbService, source, target);
			res.json(result);
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Directives
	app.get("/api/directives", async (req, res) => {
		const project = normalizeProject(
			(req.query.project as string) || "lallamaollama",
		);
		try {
			const content = await settings.getCoreDirectives(dbService, project);
			res.json({ project, content });
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.post("/api/directives", async (req, res) => {
		let { project = "lallamaollama", content } = req.body;
		project = normalizeProject(project);
		try {
			await settings.updateCoreDirectives(dbService, project, content || "");
			res.json({ success: true });
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Settings
	app.get("/api/settings/:key", async (req, res) => {
		try {
			const value = await settings.getGlobalSetting(dbService, req.params.key);
			res.json({ key: req.params.key, value });
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.post("/api/settings", async (req, res) => {
		const { key, value } = req.body;
		try {
			await settings.updateGlobalSetting(dbService, key, value);
			res.json({ success: true });
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Save memory (for agent-engine integration)
	app.post("/api/memory", async (req, res) => {
		const {
			project = "lallamaollama",
			type,
			title,
			content,
			tags,
			agent,
		} = req.body;
		log.info(
			{ project: normalizeProject(project), type, title, agent },
			"POST /api/memory",
		);
		if (!type || !title || !content) {
			return res
				.status(400)
				.json({ error: "type, title y content son obligatorios" });
		}
		try {
			const result = await memories.saveMemory(
				dbService,
				normalizeProject(project),
				type,
				title,
				content,
				tags || "",
				undefined,
				"",
				undefined,
				agent || "unknown",
			);
			res.status(201).json(result);
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Session management
	app.post("/api/sessions", async (req, res) => {
		const { project = "lallamaollama", name } = req.body;
		log.info(
			{ project: normalizeProject(project), name },
			"POST /api/sessions",
		);
		if (!name) return res.status(400).json({ error: "name is required" });
		try {
			const id = await sessions.startSession(
				dbService,
				normalizeProject(project),
				name,
			);
			res.status(201).json({ id, project: normalizeProject(project), name });
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.put("/api/sessions/:id", async (req, res) => {
		log.info({ id: req.params.id }, "PUT /api/sessions/:id");
		try {
			const success = await sessions.endSession(
				dbService,
				req.params.id,
				req.body.summary || "",
			);
			if (success) res.json({ success: true });
			else res.status(404).json({ error: "Session not found" });
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// ─── Conversation History ────────────────────────────────────────────────

	// Append a message to conversation history
	app.post("/api/conversation/append", async (req, res) => {
		const {
			sessionId,
			role,
			content,
			toolCalls,
			toolCallId,
			name,
			tokenCount,
		} = req.body;
		if (!sessionId || !role) {
			return res.status(400).json({ error: "sessionId and role are required" });
		}
		if (!["system", "user", "assistant", "tool"].includes(role)) {
			return res.status(400).json({ error: "Invalid role" });
		}
		try {
			const result = await conversation.appendMessage(dbService, {
				sessionId,
				role,
				content: content ?? null,
				toolCalls,
				toolCallId,
				name,
				tokenCount: tokenCount || 0,
			});
			res.status(201).json(result);
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Get conversation history
	app.get("/api/conversation/history", async (req, res) => {
		const sessionId = req.query.session_id as string;
		if (!sessionId) {
			return res
				.status(400)
				.json({ error: "session_id query param is required" });
		}
		const limit = parseInt((req.query.limit as string) || "50", 10);
		const offset = parseInt((req.query.offset as string) || "0", 10);
		try {
			const result = await conversation.getHistory(
				dbService,
				sessionId,
				limit,
				offset,
			);
			res.json(result);
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Summarize conversation history (compress old messages via LLM)
	app.post("/api/conversation/summarize", async (req, res) => {
		const { sessionId, model, maxMessages, keepRecent } = req.body;
		if (!sessionId) {
			return res.status(400).json({ error: "sessionId is required" });
		}
		try {
			const result = await conversation.summarizeHistory(
				dbService,
				sessionId,
				model || process.env.OLLAMA_MODEL || "qwen3.5:4b",
				maxMessages || 20,
				keepRecent || 5,
			);
			res.json(result);
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Delete conversation history for a session
	app.delete("/api/conversation/:sessionId", async (req, res) => {
		try {
			const success = await conversation.deleteSession(
				dbService,
				req.params.sessionId,
			);
			if (success) res.json({ success: true });
			else res.status(404).json({ error: "Session not found" });
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Consolidation
	app.post("/api/memory/consolidate", async (req, res) => {
		const project = normalizeProject(
			(req.body.project as string) || "lallamaollama",
		);
		log.info({ project }, "POST /api/memory/consolidate");
		try {
			const result = await analysis.consolidateMemories(dbService, project);
			res.json(result);
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// ─── Templates ────────────────────────────────────────────────────────────

	app.get("/api/templates", async (req, res) => {
		const tool = req.query.tool as string | undefined;
		const type = req.query.type as string | undefined;
		try {
			const list = await templates.listTemplates(dbService, tool, type);
			res.json(list);
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.get("/api/templates/:id", async (req, res) => {
		try {
			const tpl = await templates.getTemplate(dbService, req.params.id);
			if (!tpl) return res.status(404).json({ error: "Template not found" });
			res.json(tpl);
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.post("/api/templates", async (req, res) => {
		const { tool, type, name, description, content, variables, output_path } =
			req.body;
		if (!tool || !type || !name || !content) {
			return res
				.status(400)
				.json({ error: "tool, type, name y content son obligatorios" });
		}
		try {
			const tpl = await templates.saveTemplate(dbService, {
				tool,
				type,
				name,
				description,
				content,
				variables,
				output_path,
			});
			res.status(201).json(tpl);
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.put("/api/templates/:id", async (req, res) => {
		try {
			const tpl = await templates.updateTemplate(
				dbService,
				req.params.id,
				req.body,
			);
			if (!tpl) return res.status(404).json({ error: "Template not found" });
			res.json(tpl);
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.delete("/api/templates/:id", async (req, res) => {
		try {
			const result = await templates.deleteTemplate(dbService, req.params.id);
			if (result.protected)
				return res
					.status(403)
					.json({ error: "Los templates del sistema no pueden eliminarse." });
			if (!result.deleted)
				return res.status(404).json({ error: "Template not found" });
			res.json({ success: true });
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.post("/api/templates/:id/render", async (req, res) => {
		try {
			const tpl = await templates.getTemplate(dbService, req.params.id);
			if (!tpl) return res.status(404).json({ error: "Template not found" });
			const result = templates.renderTemplate(tpl, req.body.variables || {});
			res.json(result);
		} catch (e: unknown) {
			res
				.status(500)
				.json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Endpoint para acceso remoto vía HTTP/SSE
	app.get("/mcp", (_req, res) => {
		res.json({
			status: "ok",
			message: "LaLlamaOllama Brain MCP Server",
			timestamp: new Date().toISOString(),
		});
	});

	// --- MCP SSE Transport ---
	// The MCP SDK Server only supports ONE transport connection at a time.
	// When a new SSE client connects, we close the previous transport first.

	const sseServer = createMcpServer(dbService, directives);
	const sseTransports = new Map<string, SSEServerTransport>();
	let currentSessionId: string | null = null;

	app.get("/sse", brainAuthMiddleware, async (req, res) => {
		const ip =
			(req.headers["x-forwarded-for"] as string) ||
			req.socket.remoteAddress ||
			"unknown";
		log.info({ ip }, "SSE client connecting");

		// Close previous SSE transport if any (graceful reconnection)
		if (currentSessionId) {
			const prev = sseTransports.get(currentSessionId);
			if (prev) {
				try {
					await prev.close();
				} catch {
					/* ignore */
				}
				sseTransports.delete(currentSessionId);
			}
			// Also disconnect from the Server so we can reconnect
			try {
				await sseServer.close();
			} catch {
				/* not connected */
			}
		}

		const transport = new SSEServerTransport("/messages", res);
		sseTransports.set(transport.sessionId, transport);
		currentSessionId = transport.sessionId;
		res.on("close", () => {
			log.info({ sessionId: transport.sessionId }, "SSE client disconnected");
			if (currentSessionId === transport.sessionId) {
				currentSessionId = null;
			}
			sseTransports.delete(transport.sessionId);
		});
		await sseServer.connect(transport);
	});

	app.post("/messages", brainAuthMiddleware, async (req, res) => {
		const sessionId = req.query.sessionId as string;
		const transport = sessionId ? sseTransports.get(sessionId) : null;
		if (transport) {
			await transport.handlePostMessage(req, res, req.body);
		} else {
			res.status(400).send("No active SSE session");
		}
	});

	const serverInstance = app.listen(PORT, () => {
		log.info({ port: PORT }, `Brain API listening on port ${PORT}`);
		log.info(
			{ url: `http://localhost:${PORT}/mcp` },
			"MCP accessible remotely",
		);
		log.info({ url: `http://localhost:${PORT}/sse` }, "SSE endpoint");
	});

	serverInstance.on("error", (err: NodeJS.ErrnoException) => {
		if (err.code === "EADDRINUSE") {
			log.warn(
				{ port: PORT },
				"Port already in use, running in Stdio-only mode",
			);
		} else {
			log.error({ err }, "Server error");
		}
	});
}
