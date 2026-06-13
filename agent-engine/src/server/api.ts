import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { join, basename } from "node:path";
import axios from "axios";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import type { BrainClient } from "../services/brain/client.js";
import type { AppConfig } from "../services/config.js";
import { getDb } from "../services/db/connection.js";
import { getGeneralConfig, listExperts } from "../services/db/experts.js";
import { listModels } from "../services/db/models.js";
import { getRun, getRunEvents, listRunsByFilters } from "../services/db/runs.js";
import {
	createScheduledTask,
	deleteScheduledTask,
	getScheduledTask,
	listScheduledTasks,
	toggleScheduledTask,
	updateScheduledTask,
} from "../services/db/scheduled-tasks.js";
import { listAllUsers } from "../services/db/users.js";
import {
	chunkAndIndexFile,
	deleteBrainChunksByFile,
	deleteKnowledgeFile,
	listAllKnowledgeFiles,
	listKnowledgeFiles,
	readKnowledgeFile,
	saveKnowledgeFile,
} from "../services/knowledge/index.js";
import { toolRegistry } from "../services/tools/registry.js";
import type { WsServer } from "./ws.js";
import { logger } from "../utils/logger.js";

const apiLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 500,
	standardHeaders: true,
	legacyHeaders: false,
});

export function startApiServer(config: AppConfig, brain?: BrainClient, wsServer?: WsServer) {
	const app = express();
	app.use(
		cors({
			origin: (config as any).allowedOrigins?.length ? (config as any).allowedOrigins : ["http://localhost:8081"],
			methods: ["GET", "POST", "PUT", "DELETE"],
			allowedHeaders: ["Content-Type", "X-API-Key"],
		})
	);
	app.use(express.json({ limit: "10mb" }));

	app.use("/api", apiLimiter);

	function authMiddleware(req: Request, res: Response, next: NextFunction) {
		if (req.path === "/health" || req.path === "/memory" || req.path.startsWith("/memory/") || req.path === "/knowledge" || req.path.startsWith("/knowledge/"))
			return next();
		const apiKey = req.headers["x-api-key"] as string;
		if (!apiKey || apiKey !== config.apiKey) {
			res.status(401).json({ error: "Unauthorized: invalid or missing API key" });
			return;
		}
		next();
	}
	app.use("/api", authMiddleware);

	// -- Brain Proxy -----------------------------------------------------
	const brainHeaders = config.apiKey ? { "X-API-Key": config.apiKey } : undefined;

	app.get("/api/memory/search", async (req: Request, res: Response) => {
		if (!brain) {
			res.status(503).json({ error: "Brain not available" });
			return;
		}
		try {
			const q = req.query.q as string;
			const mode = (req.query.mode as string) || "semantic";
			const limit = parseInt(req.query.limit as string, 10) || 10;
			const offset = parseInt(req.query.offset as string, 10) || 0;
			const project = (req.query.project as string) || "lallamaollama";
			const axiosResp = await axios.get(`${config.brainUrl}/api/memory/search`, {
				params: { q, project, mode, limit, offset },
				timeout: 10000,
				headers: brainHeaders,
			});
			res.json(axiosResp.data);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error(`[Brain Proxy] Search failed: ${msg}`);
			res.status(502).json({ error: "Brain search failed", detail: msg });
		}
	});

	app.get("/api/memory/stats", async (_req: Request, res: Response) => {
		if (!brain) {
			res.status(503).json({ error: "Brain not available" });
			return;
		}
		try {
		const axiosResp = await axios.get(`${config.brainUrl}/api/memory/stats`, {
			params: { project: "lallamaollama" },
			timeout: 10000,
			headers: brainHeaders,
		});
			res.json(axiosResp.data);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error(`[Brain Proxy] Stats failed: ${msg}`);
			res.status(502).json({ error: "Brain stats failed", detail: msg });
		}
	});
	// -- Brain Proxy: Memory CRUD ------------------------------------------
	app.post("/api/memory", async (req: Request, res: Response) => {
		if (!brain) { res.status(503).json({ error: "Brain not available" }); return; }
		try {
			const axiosResp = await axios.post(
				`${config.brainUrl}/api/memory`, req.body, { timeout: 10000, headers: brainHeaders }
			);
			wsServer?.sendToAll("memory_changed", { action: "created" });
			res.status(201).json(axiosResp.data);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error(`[Brain Proxy] Save memory failed: ${msg}`);
			res.status(502).json({ error: "Brain save memory failed", detail: msg });
		}
	});

	app.get("/api/memory/timeline", async (req: Request, res: Response) => {
		if (!brain) { res.status(503).json({ error: "Brain not available" }); return; }
		try {
			const type = req.query.type as string | undefined;
			const limit = parseInt(req.query.limit as string, 10) || 100;
			const offset = parseInt(req.query.offset as string, 10) || 0;
			const axiosResp = await axios.get(`${config.brainUrl}/api/memory/timeline`, {
				params: { project: "lallamaollama", limit, offset, ...(type ? { type } : {}) },
				timeout: 10000,
				headers: brainHeaders,
			});
			res.json(axiosResp.data);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error(`[Brain Proxy] Timeline failed: ${msg}`);
			res.status(502).json({ error: "Brain timeline failed", detail: msg });
		}
	});

	app.get("/api/memory/:id", async (req: Request, res: Response) => {
		if (!brain) { res.status(503).json({ error: "Brain not available" }); return; }
		const id = req.params.id as string;
		try {
			const axiosResp = await axios.get(
				`${config.brainUrl}/api/memory/${encodeURIComponent(id)}`, { timeout: 10000, headers: brainHeaders }
			);
			res.json(axiosResp.data);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error(`[Brain Proxy] Get memory failed: ${msg}`);
			res.status(502).json({ error: "Brain get memory failed", detail: msg });
		}
	});

	app.put("/api/memory/:id", async (req: Request, res: Response) => {
		if (!brain) { res.status(503).json({ error: "Brain not available" }); return; }
		const id = req.params.id as string;
		try {
			const axiosResp = await axios.put(
				`${config.brainUrl}/api/memory/${encodeURIComponent(id)}`, req.body, { timeout: 10000, headers: brainHeaders }
			);
			wsServer?.sendToAll("memory_changed", { action: "updated", id });
			res.json(axiosResp.data);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error(`[Brain Proxy] Update memory failed: ${msg}`);
			res.status(502).json({ error: "Brain update memory failed", detail: msg });
		}
	});

	app.delete("/api/memory/:id", async (req: Request, res: Response) => {
		if (!brain) { res.status(503).json({ error: "Brain not available" }); return; }
		const id = req.params.id as string;
		try {
			const axiosResp = await axios.delete(
				`${config.brainUrl}/api/memory/${encodeURIComponent(id)}`, { timeout: 10000, headers: brainHeaders }
			);
			wsServer?.sendToAll("memory_changed", { action: "deleted", id });
			res.json(axiosResp.data);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error(`[Brain Proxy] Delete memory failed: ${msg}`);
			res.status(502).json({ error: "Brain delete memory failed", detail: msg });
		}
	});

	app.post("/api/memory/consolidate", async (req: Request, res: Response) => {
		if (!brain) { res.status(503).json({ error: "Brain not available" }); return; }
		try {
			const axiosResp = await axios.post(
				`${config.brainUrl}/api/memory/consolidate`, req.body, { timeout: 60000, headers: brainHeaders }
			);
			wsServer?.sendToAll("memory_changed", { action: "consolidated" });
			res.json(axiosResp.data);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error(`[Brain Proxy] Consolidate failed: ${msg}`);
			res.status(502).json({ error: "Brain consolidate failed", detail: msg });
		}
	});

	// Health endpoint
	app.get("/health", (_req: Request, res: Response) => {
		res.json({
			status: "ok",
			service: "agent-engine",
			port: config.enginePort,
			model: config.defaultModel,
			tools: toolRegistry.getToolNames().length,
			telegramConfigured: !!config.telegramBotToken,
		});
	});

	// Tools list
	app.get("/api/tools", (_req: Request, res: Response) => {
		res.json({
			tools: toolRegistry.getSpecs(),
			names: toolRegistry.getToolNames(),
		});
	});

	// Experts list (REST)
	app.get("/api/experts", (_req: Request, res: Response) => {
		res.json({ experts: listExperts(), general: getGeneralConfig() });
	});

	// Users list (REST)
	app.get("/api/users", (_req: Request, res: Response) => {
		res.json({ users: listAllUsers() });
	});

	// Models list (REST)
	app.get("/api/models", (_req: Request, res: Response) => {
		res.json({ models: listModels() });
	});

	// DB stats
	app.get("/api/stats", (_req: Request, res: Response) => {
		const db = getDb();
		const stats = {
			experts: (db.prepare("SELECT COUNT(*) as count FROM sub_agents").get() as { count: number }).count,
			users: (db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number }).count,
			messages: (db.prepare("SELECT COUNT(*) as count FROM messages").get() as { count: number }).count,
			chats: (db.prepare("SELECT COUNT(*) as count FROM chats").get() as { count: number }).count,
			models: (db.prepare("SELECT COUNT(*) as count FROM models").get() as { count: number }).count,
		};
		res.json({ stats });
	});

	// Runs (Task History)
	app.get("/api/runs", (req: Request, res: Response) => {
		const status = req.query.status as string | undefined;
		const limit = parseInt(req.query.limit as string, 10) || 50;
		const offset = parseInt(req.query.offset as string, 10) || 0;
		const runs = listRunsByFilters({ status, limit, offset });
		res.json({ runs });
	});

	app.get("/api/runs/:id", (req: Request, res: Response) => {
		const id = parseInt(req.params.id as string, 10);
		if (Number.isNaN(id)) {
			res.status(400).json({ error: "Invalid run ID" });
			return;
		}
		const run = getRun(id);
		if (!run) {
			res.status(404).json({ error: "Run not found" });
			return;
		}
		const events = getRunEvents(id);
		res.json({ run, events });
	});

	// Scheduled tasks (auto-executable)
	app.get("/api/scheduled-tasks", (_req: Request, res: Response) => {
		const tasks = listScheduledTasks();
		res.json({ tasks });
	});

	app.get("/api/scheduled-tasks/:id", (req: Request, res: Response) => {
		const id = parseInt(req.params.id as string, 10);
		if (Number.isNaN(id)) {
			res.status(400).json({ error: "Invalid id" });
			return;
		}
		const task = getScheduledTask(id);
		if (!task) {
			res.status(404).json({ error: "Not found" });
			return;
		}
		res.json({ task });
	});

	app.post("/api/scheduled-tasks", (req: Request, res: Response) => {
		const { name, cron_expression, task_text, mode_id } = req.body;
		if (!name || !cron_expression || !task_text) {
			res.status(400).json({ error: "Missing required fields" });
			return;
		}
		const id = createScheduledTask({ name, cron_expression, task_text, mode_id });
		const task = getScheduledTask(id);
		res.json({ task });
	});

	app.put("/api/scheduled-tasks/:id", (req: Request, res: Response) => {
		const id = parseInt(req.params.id as string, 10);
		if (Number.isNaN(id)) {
			res.status(400).json({ error: "Invalid id" });
			return;
		}
		updateScheduledTask(id, req.body);
		res.json({ task: getScheduledTask(id) });
	});

	app.delete("/api/scheduled-tasks/:id", (req: Request, res: Response) => {
		const id = parseInt(req.params.id as string, 10);
		if (Number.isNaN(id)) {
			res.status(400).json({ error: "Invalid id" });
			return;
		}
		deleteScheduledTask(id);
		res.json({ success: true });
	});

	app.post("/api/scheduled-tasks/:id/toggle", (req: Request, res: Response) => {
		const id = parseInt(req.params.id as string, 10);
		if (Number.isNaN(id)) {
			res.status(400).json({ error: "Invalid id" });
			return;
		}
		toggleScheduledTask(id);
		res.json({ task: getScheduledTask(id) });
	});

	// Knowledge (RAG)
	app.get("/api/knowledge", (_req: Request, res: Response) => {
		const files = listKnowledgeFiles(config.workspaceDir);
		res.json({ files });
	});

	app.post("/api/knowledge/upload", async (req: Request, res: Response) => {
		const { name, content } = req.body as { name: string; content: string };
		if (!name || !content) {
			res.status(400).json({ error: "Missing 'name' or 'content'" });
			return;
		}
		const filePath = saveKnowledgeFile(config.workspaceDir, name, content);
		logger.info(`[Knowledge] File saved: ${name}`);

		// Chunk + index to MCP Brain
		let chunks = 0;
		if (brain) {
			try {
				chunks = await chunkAndIndexFile(filePath, name, brain);
				logger.info(`[Knowledge] Indexed ${chunks} chunks for: ${name}`);
			} catch (err) {
				logger.error(`[Knowledge] Indexing failed for ${name}: ${err}`);
			}
		}

		res.json({ success: true, path: filePath, chunks });
	});

	app.delete("/api/knowledge/:name", async (req: Request, res: Response) => {
		const name = req.params.name as string;
		if (brain) {
			try {
				await deleteBrainChunksByFile(brain, name);
			} catch (err) {
				logger.warn(`[Knowledge] Brain cleanup failed for ${name}: ${err}`);
			}
		}
		const deleted = deleteKnowledgeFile(config.workspaceDir, name);
		if (!deleted) {
			res.status(404).json({ error: "File not found" });
			return;
		}
		res.json({ success: true });
	});

	// Documents (knowledge con subdirectorios)
	app.get("/api/knowledge/all", (_req: Request, res: Response) => {
		const files = listAllKnowledgeFiles(config.workspaceDir);
		res.json({ files });
	});

	app.get("/api/knowledge/read", (req: Request, res: Response) => {
		const filePath = req.query.path as string;
		if (!filePath) {
			res.status(400).json({ error: "Missing 'path' query parameter" });
			return;
		}
		const content = readKnowledgeFile(config.workspaceDir, filePath);
		if (content === null) {
			res.status(404).json({ error: "File not found" });
			return;
		}
		res.json({ content });
	});

	app.put("/api/knowledge/update", async (req: Request, res: Response) => {
		const { path: filePath, content } = req.body as { path: string; content: string };
		if (!filePath || content === undefined) {
			res.status(400).json({ error: "Missing 'path' or 'content'" });
			return;
		}
		saveKnowledgeFile(config.workspaceDir, filePath, content);
		logger.info(`[Knowledge] File updated: ${filePath}`);

		let chunks = 0;
		if (brain) {
			try {
				const fileName = basename(filePath);
				await deleteBrainChunksByFile(brain, fileName);
				const fullPath = join(config.workspaceDir, "knowledge", filePath);
				if (existsSync(fullPath)) {
					chunks = await chunkAndIndexFile(fullPath, fileName, brain);
				}
				logger.info(`[Knowledge] Re-indexed ${chunks} chunks for: ${filePath}`);
			} catch (err) {
				logger.error(`[Knowledge] Re-indexing failed for ${filePath}: ${err}`);
			}
		}

		res.json({ success: true, chunks });
	});

	app.delete("/api/knowledge/delete", async (req: Request, res: Response) => {
		const filePath = req.query.path as string;
		if (!filePath) {
			res.status(400).json({ error: "Missing 'path' query parameter" });
			return;
		}
		if (brain) {
			try {
				const fileName = basename(filePath);
				await deleteBrainChunksByFile(brain, fileName);
			} catch (err) {
				logger.warn(`[Knowledge] Brain cleanup failed for ${filePath}: ${err}`);
			}
		}
		const deleted = deleteKnowledgeFile(config.workspaceDir, filePath);
		if (!deleted) {
			res.status(404).json({ error: "File not found" });
			return;
		}
		res.json({ success: true });
	});

	// Global error handler
	app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
		console.error(`[API] Unhandled error: ${err.message}`);
		res.status(500).json({ error: "Internal server error" });
	});

	const httpServer = createServer(app);

	httpServer.listen(config.enginePort, () => {
		logger.info(`[API] REST server listening on port ${config.enginePort}`);
		logger.info(`[API] Health: http://localhost:${config.enginePort}/health`);
	});

	return httpServer;
}
