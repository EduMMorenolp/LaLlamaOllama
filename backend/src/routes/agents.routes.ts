import { Router } from "express";
import type { RequestHandler } from "express";
import type { AnalyzeProjectUseCase } from "../use-cases/agents/analyze-project.js";
import logger from "../utils/logger.js";

const log = logger.child({ component: "agents-routes" });

export function createAgentsRouter(
  analyzeProject: AnalyzeProjectUseCase,
  authMiddleware: RequestHandler
) {
  const router = Router();

  router.post("/api/agents/analyze-project", authMiddleware, async (req, res) => {
    const { model, projectName } = req.body;
    log.info({ model, projectName }, "POST /api/agents/analyze-project");
    try {
      const { model, projectName, structure, configFiles } = req.body;
      if (!model || !projectName || !structure) {
        return res.status(400).json({
          error: { message: "model, projectName y structure son obligatorios", type: "invalid_request_error" },
        });
      }
      const result = await analyzeProject.execute(model, projectName, structure, configFiles || {});
      log.info({ projectName, agentCount: result.agents.length }, "Project analysis complete");
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error({ model, projectName, message }, "Project analysis failed");
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  return router;
}
