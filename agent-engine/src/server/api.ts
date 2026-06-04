import cors from "cors";
import express, { type Request, type Response } from "express";
import { createServer } from "node:http";
import type { AppConfig } from "../services/config.js";
import { toolRegistry } from "../services/tools/registry.js";
import { logger } from "../utils/logger.js";
import { listExperts, getGeneralConfig } from "../services/db/experts.js";
import { listAllUsers } from "../services/db/users.js";
import { listModels } from "../services/db/models.js";
import { getDb } from "../services/db/connection.js";
import {
	listRunsByFilters,
	getRun,
	getRunEvents,
} from "../services/db/runs.js";
import {
	listKnowledgeFiles,
	saveKnowledgeFile,
	deleteKnowledgeFile,
	chunkAndIndexFile,
} from "../services/knowledge/index.js";
import type { BrainClient } from "../services/brain/client.js";

export function startApiServer(config: AppConfig, brain?: BrainClient) {
	const app = express();
	app.use(cors());
	app.use(express.json({ limit: "10mb" }));

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

	// ── Runs (Task History) ──────────────────────────────────────────────
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

	// ── Knowledge (RAG) ─────────────────────────────────────────────────
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

	const httpServer = createServer(app);

	httpServer.listen(config.enginePort, () => {
		logger.info(`[API] REST server listening on port ${config.enginePort}`);
		logger.info(`[API] Health: http://localhost:${config.enginePort}/health`);
	});

	return httpServer;
}
