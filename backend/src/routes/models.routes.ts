import { Router } from "express";
import type { RequestHandler } from "express";
import type { ListModelsUseCase } from "../use-cases/models/list-models.js";
import type { ListModelsOpenAiUseCase } from "../use-cases/models/list-models-openai.js";
import type { PullModelUseCase } from "../use-cases/models/pull-model.js";
import type { UnloadModelsUseCase } from "../use-cases/models/unload-models.js";
import type { CleanWorkspaceUseCase } from "../use-cases/models/clean-workspace.js";
import type { DeleteModelUseCase } from "../use-cases/models/delete-model.js";

export function createModelsRouter(
  listModels: ListModelsUseCase,
  listModelsOpenAi: ListModelsOpenAiUseCase,
  pullModel: PullModelUseCase,
  unloadModels: UnloadModelsUseCase,
  cleanWorkspace: CleanWorkspaceUseCase,
  deleteModel: DeleteModelUseCase,
  authMiddleware: RequestHandler
) {
  const router = Router();

  router.get("/v1/models", authMiddleware, async (_req, res) => {
    try {
      const result = await listModelsOpenAi.execute();
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.get("/api/models", authMiddleware, async (_req, res) => {
    try {
      const result = await listModels.execute();
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.post("/api/pull", authMiddleware, (req, res) => {
    const { model } = req.body;
    if (!model) {
      return res.status(400).json({
        error: { message: "Model is required", type: "invalid_request_error" },
      });
    }
    try {
      res.json(pullModel.execute(model));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.post("/api/unload", authMiddleware, async (_req, res) => {
    try {
      res.json(await unloadModels.execute());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.post("/api/clean", authMiddleware, async (_req, res) => {
    try {
      res.json(await cleanWorkspace.execute());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.delete("/api/models/:name", authMiddleware, async (req, res) => {
    try {
      res.json(await deleteModel.execute(req.params.name));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  return router;
}
