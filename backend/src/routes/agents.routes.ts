import { Router } from "express";
import type { RequestHandler } from "express";
import type { AnalyzeProjectUseCase } from "../use-cases/agents/analyze-project.js";

export function createAgentsRouter(
  analyzeProject: AnalyzeProjectUseCase,
  authMiddleware: RequestHandler
) {
  const router = Router();

  router.post("/api/agents/analyze-project", authMiddleware, async (req, res) => {
    try {
      const { model, projectName, structure, configFiles } = req.body;
      if (!model || !projectName || !structure) {
        return res.status(400).json({
          error: { message: "model, projectName y structure son obligatorios", type: "invalid_request_error" },
        });
      }
      const result = await analyzeProject.execute(model, projectName, structure, configFiles || {});
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  return router;
}
