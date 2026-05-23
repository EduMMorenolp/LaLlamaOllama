import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import cors from "cors";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { DatabaseService } from "../database/connection.js";
import { analysis, memories, settings, templates } from "../services/index.js";
import { normalizeProject } from "../services/normalizeProject.js";
import { mergeProjects } from "../services/memories/mergeProjects.js";
import { createMcpServer } from "./mcp.js";

const PORT = process.env.BRAIN_PORT || 3015;

export function startApiServer(dbService: DatabaseService, directives?: string) {
	const app = express();
	app.use(cors());
	app.use(express.json());

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

	// Auto-Sync MCP (SSE / Docker-based)
	app.post("/api/mcp/sync", async (req, res) => {
		const { target } = req.body;
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

			const updateMcpFile = (filePath: string, serverKey: string, configObj: Record<string, unknown>) => {
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
			const hostProjectPath = process.env.HOST_PROJECT_PATH || "C:/path/to/project";
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
					fs.writeFileSync(openCodePath, JSON.stringify(configData, null, 2), "utf8");
					return res.json({
						success: true,
						message: "¡Configuración de OpenCode AI sincronizada con éxito! (SSE remoto)",
					});
				} else {
					return res
						.status(404)
						.json({ error: "No se encontró el archivo opencode.json en la raíz del proyecto." });
				}
			} else if (target === "antigravity") {
				const agPath = path.join(os.homedir(), ".gemini/antigravity/mcp_config.json");
				updateMcpFile(agPath, "lallamaollama-brain", antigravityConfig);
				return res.json({
					success: true,
					message: `¡Motor Antigravity AI sincronizado con éxito! (Docker MCP en ${hostProjectPath})`,
				});
			} else if (target === "claudedesktop") {
				const claudeConfigPath = process.env.CLAUDE_CONFIG_PATH || path.join(os.homedir(), "AppData", "Roaming", "Claude", "claude_desktop_config.json");
					const cdPath = claudeConfigPath;
				updateMcpFile(cdPath, "lallamaollama-brain", claudeCompatSseConfig);
				return res.json({
					success: true,
					message: "¡Claude Desktop sincronizado con éxito! (SSE remoto)",
				});
			} else if (target === "roocode") {
				const rooConfigPath = process.env.ROOCODE_CONFIG_PATH || path.join(
						os.homedir(),
						"AppData", "Roaming", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "claude_desktop_config.json"
					);
					const rooPath = rooConfigPath;
				updateMcpFile(rooPath, "lallamaollama-brain", claudeCompatSseConfig);
				return res.json({
					success: true,
					message: "¡RooCode / Cline sincronizado con éxito en VS Code! (SSE remoto)",
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
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.get("/api/memory/stats", async (req, res) => {
		const project = normalizeProject((req.query.project as string) || "lallamaollama");
		try {
			const stats = await memories.getStats(dbService, project);
			res.json(stats);
		} catch (e: unknown) {
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.get("/api/memory/search", async (req, res) => {
		const q = (req.query.q as string) || "";
		const project = normalizeProject((req.query.project as string) || "lallamaollama");
		const mode = (req.query.mode as "lexical" | "semantic" | "hybrid") || "hybrid";
		try {
			const results =
				q.trim() === ""
					? await memories.getContext(dbService, project, 50)
					: await memories.searchMemories(dbService, q, project, mode, 50);
			res.json(results);
		} catch (e: unknown) {
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.delete("/api/memory/:id", async (req, res) => {
		try {
			const success = await memories.deleteMemory(dbService, req.params.id);
			if (success) res.json({ message: "Memory deleted" });
			else res.status(404).json({ error: "Memory not found" });
		} catch (e: unknown) {
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Projects
	app.get("/api/projects", async (_req, res) => {
		try {
			const db = dbService.getDb();
			const rows = await db.all(`
				SELECT DISTINCT project FROM memories 
				UNION 
				SELECT DISTINCT project FROM core_directives
			`);
			const projects = Array.from(
				new Set(["lallamaollama", ...rows.map((r: { project: string }) => normalizeProject(r.project))])
			);
			res.json(projects);
		} catch (e: unknown) {
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.delete("/api/projects/:name", async (req, res) => {
		const projectName = normalizeProject(req.params.name);
		if (projectName === "lallamaollama") {
			return res.status(403).json({ error: "No se puede eliminar el proyecto principal." });
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
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Ensure project exists (create if not)
	app.post("/api/projects/ensure", async (req, res) => {
		const rawName = (req.body.name as string) || "";
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
				[projectName, projectName]
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
					]
				);
			});
			return res.status(201).json({ created: true, project: projectName });
		} catch (e: unknown) {
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Merge projects
	app.post("/api/projects/merge", async (req, res) => {
	try {
		const source = normalizeProject(req.body.source as string);
		const target = normalizeProject(req.body.target as string);
		if (!source || !target) {
			return res.status(400).json({ error: "source and target are required" });
		}
		if (source === target) {
			return res.status(400).json({ error: "source and target must be different projects" });
		}
		const result = await mergeProjects(dbService, source, target);
		res.json(result);
	} catch (e: unknown) {
		res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
	}
});

		// Directives
	app.get("/api/directives", async (req, res) => {
		const project = normalizeProject((req.query.project as string) || "lallamaollama");
		try {
			const content = await settings.getCoreDirectives(dbService, project);
			res.json({ project, content });
		} catch (e: unknown) {
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.post("/api/directives", async (req, res) => {
		let { project = "lallamaollama", content } = req.body;
			project = normalizeProject(project);
		try {
			await settings.updateCoreDirectives(dbService, project, content || "");
			res.json({ success: true });
		} catch (e: unknown) {
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Settings
	app.get("/api/settings/:key", async (req, res) => {
		try {
			const value = await settings.getGlobalSetting(dbService, req.params.key);
			res.json({ key: req.params.key, value });
		} catch (e: unknown) {
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.post("/api/settings", async (req, res) => {
		const { key, value } = req.body;
		try {
			await settings.updateGlobalSetting(dbService, key, value);
			res.json({ success: true });
		} catch (e: unknown) {
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Consolidation
	app.post("/api/memory/consolidate", async (req, res) => {
		const project = normalizeProject((req.body.project as string) || "lallamaollama");
		try {
			const result = await analysis.consolidateMemories(dbService, project);
			res.json(result);
		} catch (e: unknown) {
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
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
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.get("/api/templates/:id", async (req, res) => {
		try {
			const tpl = await templates.getTemplate(dbService, req.params.id);
			if (!tpl) return res.status(404).json({ error: "Template not found" });
			res.json(tpl);
		} catch (e: unknown) {
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.post("/api/templates", async (req, res) => {
		const { tool, type, name, description, content, variables, output_path } = req.body;
		if (!tool || !type || !name || !content) {
			return res.status(400).json({ error: "tool, type, name y content son obligatorios" });
		}
		try {
			const tpl = await templates.saveTemplate(dbService, {
				tool, type, name, description, content, variables, output_path,
			});
			res.status(201).json(tpl);
		} catch (e: unknown) {
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.put("/api/templates/:id", async (req, res) => {
		try {
			const tpl = await templates.updateTemplate(dbService, req.params.id, req.body);
			if (!tpl) return res.status(404).json({ error: "Template not found" });
			res.json(tpl);
		} catch (e: unknown) {
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.delete("/api/templates/:id", async (req, res) => {
		try {
			const result = await templates.deleteTemplate(dbService, req.params.id);
			if (result.protected) return res.status(403).json({ error: "Los templates del sistema no pueden eliminarse." });
			if (!result.deleted) return res.status(404).json({ error: "Template not found" });
			res.json({ success: true });
		} catch (e: unknown) {
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	app.post("/api/templates/:id/render", async (req, res) => {
		try {
			const tpl = await templates.getTemplate(dbService, req.params.id);
			if (!tpl) return res.status(404).json({ error: "Template not found" });
			const result = templates.renderTemplate(tpl, req.body.variables || {});
			res.json(result);
		} catch (e: unknown) {
			res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
		}
	});

	// Endpoint para acceso remoto vía HTTP/SSE
	app.get("/mcp", (_req, res) => {
		res.json({ status: "ok", message: "LaLlamaOllama Brain MCP Server", timestamp: new Date().toISOString() });
	});

	// --- MCP SSE Transport ---

	const sseServer = createMcpServer(dbService, directives);
	const sseTransports = new Map<string, SSEServerTransport>();

	app.get("/sse", async (req, res) => {
		const transport = new SSEServerTransport("/messages", res);
		sseTransports.set(transport.sessionId, transport);
		res.on("close", () => sseTransports.delete(transport.sessionId));
		await sseServer.connect(transport);
	});

	app.post("/messages", async (req, res) => {
		const sessionId = req.query.sessionId as string;
		const transport = sessionId ? sseTransports.get(sessionId) : null;
		if (transport) {
			await transport.handlePostMessage(req, res, req.body);
		} else {
			res.status(400).send("No active SSE session");
		}
	});

	const serverInstance = app.listen(PORT, () => {
		console.error(`[Brain UI API] Dashboard API listening on port ${PORT}`);
		console.error(`[Brain MCP] Accessible remotely at: http://localhost:${PORT}/mcp`);
		console.error(`[Brain MCP SSE] SSE endpoint: http://localhost:${PORT}/sse`);
	});

	serverInstance.on("error", (err: NodeJS.ErrnoException) => {
		if (err.code === "EADDRINUSE") {
			console.error(`[Brain UI API] Warning: Port ${PORT} already in use. Running in Stdio-only mode.`);
		} else {
			console.error(`[Brain UI API] Server error:`, err);
		}
	});
}
