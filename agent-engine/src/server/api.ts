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

export function startApiServer(config: AppConfig) {
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

	const httpServer = createServer(app);

	httpServer.listen(config.enginePort, () => {
		logger.info(`[API] REST server listening on port ${config.enginePort}`);
		logger.info(`[API] Health: http://localhost:${config.enginePort}/health`);
	});

	return httpServer;
}
