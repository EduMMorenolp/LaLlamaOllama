import type { RequestHandler } from "express";
import { Router } from "express";
import type { SearchModelsUseCase } from "../use-cases/search/search-models.js";
import logger from "../utils/logger.js";

const log = logger.child({ component: "search-routes" });

export function createSearchRouter(
	searchModels: SearchModelsUseCase,
	authMiddleware: RequestHandler,
) {
	const router = Router();

	router.get("/api/search-models", authMiddleware, async (req, res) => {
		const q = (req.query.q as string) || "";
		const sort = (req.query.sort as string) || "";
		log.info({ query: q, sort }, "GET /api/search-models");
		try {
			const result = await searchModels.execute(q, sort);
			res.json(result);
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			log.error({ query: q, message }, "Search failed");
			res.status(500).json({
				error: {
					message: `Error scraping ollama.com: ${message}`,
					type: "server_error",
				},
				models: [],
			});
		}
	});

	return router;
}
