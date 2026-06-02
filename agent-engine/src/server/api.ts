import cors from "cors";
import express, { type Request, type Response } from "express";
import { createServer } from "node:http";
import type { AppConfig } from "../services/config.js";
import { toolRegistry } from "../services/tools/registry.js";
import { logger } from "../utils/logger.js";

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
		});
	});

	// Tools list
	app.get("/api/tools", (_req: Request, res: Response) => {
		res.json({
			tools: toolRegistry.getSpecs(),
			names: toolRegistry.getToolNames(),
		});
	});

	const httpServer = createServer(app);

	httpServer.listen(config.enginePort, () => {
		logger.info(`[API] REST server listening on port ${config.enginePort}`);
		logger.info(`[API] Health: http://localhost:${config.enginePort}/health`);
	});

	return httpServer;
}
