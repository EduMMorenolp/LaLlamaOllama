import { Router } from "express";
import type { RequestHandler } from "express";
import type { ListModelsUseCase } from "../use-cases/models/list-models.js";
import type { ListModelsOpenAiUseCase } from "../use-cases/models/list-models-openai.js";
import type { PullModelUseCase } from "../use-cases/models/pull-model.js";
import type { UnloadModelsUseCase } from "../use-cases/models/unload-models.js";
import type { CleanWorkspaceUseCase } from "../use-cases/models/clean-workspace.js";
import type { DeleteModelUseCase } from "../use-cases/models/delete-model.js";
import type { ShowModelUseCase } from "../use-cases/models/show-model.js";
import logger from "../utils/logger.js";

const log = logger.child({ component: "models-routes" });

export function createModelsRouter(
  listModels: ListModelsUseCase,
  listModelsOpenAi: ListModelsOpenAiUseCase,
  pullModel: PullModelUseCase,
  unloadModels: UnloadModelsUseCase,
  cleanWorkspace: CleanWorkspaceUseCase,
  deleteModel: DeleteModelUseCase,
  showModel: ShowModelUseCase,
  authMiddleware: RequestHandler
) {
  const router = Router();

  router.get("/v1/models", authMiddleware, async (_req, res) => {
    try {
      const result = await listModelsOpenAi.execute();
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error({ message }, "GET /v1/models failed");
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.get("/api/models", authMiddleware, async (_req, res) => {
    try {
      const result = await listModels.execute();
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error({ message }, "GET /api/models failed");
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.post("/api/pull", authMiddleware, async (req, res) => {
    const { model } = req.body;
    if (!model) {
      return res.status(400).json({
        error: { message: "Model is required", type: "invalid_request_error" },
      });
    }
    log.info({ model }, "POST /api/pull");
    try {
      const result = await pullModel.execute(model);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ model, message }, "Model pull failed");
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.post("/api/unload", authMiddleware, async (_req, res) => {
    log.info("POST /api/unload");
    try {
      res.json(await unloadModels.execute());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error({ message }, "Model unload failed");
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.post("/api/clean", authMiddleware, async (_req, res) => {
    log.info("POST /api/clean");
    try {
      res.json(await cleanWorkspace.execute());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error({ message }, "Clean workspace failed");
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.get("/api/models/:name/show", authMiddleware, async (req, res) => {
    const { name } = req.params;
    log.info({ model: name }, "GET /api/models/:name/show");
    try {
      const result = await showModel.execute(name);
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error({ model: name, message }, "Model show failed");
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.delete("/api/models/:name", authMiddleware, async (req, res) => {
    const { name } = req.params;
    log.info({ model: name }, "DELETE /api/models/:name");
    try {
      res.json(await deleteModel.execute(name));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error({ model: name, message }, "Model delete failed");
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  return router;
}
