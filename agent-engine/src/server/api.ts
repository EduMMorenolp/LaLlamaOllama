import { createServer } from "node:http";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import type { BrainClient } from "../services/brain/client.js";
import type { AppConfig } from "../services/config.js";
import { getDb } from "../services/db/connection.js";
import { getGeneralConfig, listExperts } from "../services/db/experts.js";
import { listModels } from "../services/db/models.js";
import { getRun, getRunEvents, listRunsByFilters, cancelRun } from "../services/db/runs.js";
import {
	listScheduledTasks,
	getScheduledTask,
	createScheduledTask,
	updateScheduledTask,
	deleteScheduledTask,
	toggleScheduledTask,
} from "../services/db/scheduled-tasks.js";
import { listAllUsers } from "../services/db/users.js";
import {
	chunkAndIndexFile,
	deleteKnowledgeFile,
	listKnowledgeFiles,
	saveKnowledgeFile,
} from "../services/knowledge/index.js";
import { toolRegistry } from "../services/tools/registry.js";
import { logger } from "../utils/logger.js";

const apiLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 100,
	standardHeaders: true,
	legacyHeaders: false,
});

export function startApiServer(config: AppConfig, brain?: BrainClient) {
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
		if (req.path === "/health" || req.path.startsWith("/memory/")) return next();
		const apiKey = req.headers["x-api-key"] as string;
		if (!apiKey || apiKey !== config.apiKey) {
			res.status(401).json({ error: "Unauthorized: invalid or missing API key" });
			return;
		}
		next();
	}
	app.use("/api", authMiddleware);

	// -- Brain Proxy -----------------------------------------------------
	app.get("/api/memory/search", async (req: Request, res: Response) => {
		if (!brain) {
			res.status(503).json({ error: "Brain not available" });
			return;
		}
		try {
			const q = req.query.q as string;
			const mode = (req.query.mode as string) || "semantic";
			const limit = parseInt(req.query.limit as string, 10) || 10;
			const project = (req.query.project as string) || "lallamaollama";
			const axiosResp = await (await import("axios")).default.get(`${config.brainUrl}/api/memory/search`, {
				params: { q, project, mode, limit },
				timeout: 10000,
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
			const axiosResp = await (await import("axios")).default.get(`${config.brainUrl}/api/memory/stats`, {
				params: { project: "lallamaollama" },
				timeout: 10000,
			});
			res.json(axiosResp.data);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error(`[Brain Proxy] Stats failed: ${msg}`);
			res.status(502).json({ error: "Brain stats failed", detail: msg });
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
		const id = parseInt(req.params.id, 10);
		if (isNaN(id)) {
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
		const id = parseInt(req.params.id, 10);
		if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
		const task = getScheduledTask(id);
		if (!task) { res.status(404).json({ error: "Not found" }); return; }
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
		const id = parseInt(req.params.id, 10);
		if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
		updateScheduledTask(id, req.body);
		res.json({ task: getScheduledTask(id) });
	});

	app.delete("/api/scheduled-tasks/:id", (req: Request, res: Response) => {
		const id = parseInt(req.params.id, 10);
		if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
		deleteScheduledTask(id);
		res.json({ success: true });
	});

	app.post("/api/scheduled-tasks/:id/toggle", (req: Request, res: Response) => {
		const id = parseInt(req.params.id, 10);
		if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
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

	app.delete("/api/knowledge/:name", (req: Request, res: Response) => {
		const name = req.params.name;
		const deleted = deleteKnowledgeFile(config.workspaceDir, name);
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
