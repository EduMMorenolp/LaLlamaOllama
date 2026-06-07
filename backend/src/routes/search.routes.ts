import { Router } from "express";
import type { RequestHandler } from "express";
import type { SearchModelsUseCase } from "../use-cases/search/search-models.js";

export function createSearchRouter(
  searchModels: SearchModelsUseCase,
  authMiddleware: RequestHandler
) {
  const router = Router();

  router.get("/api/search-models", authMiddleware, async (req, res) => {
    const q = (req.query.q as string) || "";
    const sort = (req.query.sort as string) || "";
    try {
      const result = await searchModels.execute(q, sort);
      res.json(result);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({
        error: { message: `Error scraping ollama.com: ${message}`, type: "server_error" },
        models: [],
      });
    }
  });

  return router;
}
