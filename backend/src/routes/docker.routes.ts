import { Router } from "express";
import type { RequestHandler } from "express";
import type { StartContainerUseCase } from "../use-cases/docker/start-container.js";
import type { StopContainerUseCase } from "../use-cases/docker/stop-container.js";
import type { RestartContainerUseCase } from "../use-cases/docker/restart-container.js";
import logger from "../utils/logger.js";

const log = logger.child({ component: "docker-routes" });

export function createDockerRouter(
  startContainer: StartContainerUseCase,
  stopContainer: StopContainerUseCase,
  restartContainer: RestartContainerUseCase,
  authMiddleware: RequestHandler,
  ollamaContainer: string,
  brainContainer: string
) {
  const router = Router();

  router.post("/api/ollama/start", authMiddleware, async (_req, res) => {
    try {
      const result = await startContainer.execute(ollamaContainer);
      if (!result.success) {
        return res.status(404).json({ error: { message: result.message, type: "not_found" } });
      }
      res.json({ message: "Motor Ollama iniciado" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.post("/api/ollama/stop", authMiddleware, async (_req, res) => {
    try {
      const result = await stopContainer.execute(ollamaContainer);
      if (!result.success) {
        return res.status(404).json({ error: { message: result.message, type: "not_found" } });
      }
      res.json({ message: "Motor Ollama detenido" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.post("/api/ollama/restart", authMiddleware, async (_req, res) => {
    try {
      const result = await restartContainer.execute(ollamaContainer);
      if (!result.success) {
        return res.status(404).json({ error: { message: result.message, type: "not_found" } });
      }
      res.json({ message: "Motor Ollama reiniciado" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.post("/api/brain/start", authMiddleware, async (_req, res) => {
    try {
      const result = await startContainer.execute(brainContainer);
      if (!result.success) {
        return res.status(404).json({ error: { message: result.message, type: "not_found" } });
      }
      res.json({ message: "Cerebro MCP iniciado", running: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.post("/api/brain/stop", authMiddleware, async (_req, res) => {
    try {
      const result = await stopContainer.execute(brainContainer);
      if (!result.success) {
        return res.status(404).json({ error: { message: result.message, type: "not_found" } });
      }
      res.json({ message: "Cerebro MCP detenido", running: false });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  return router;
}
