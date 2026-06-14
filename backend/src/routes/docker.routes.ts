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
    log.info("POST /api/ollama/start");
    try {
      const result = await startContainer.execute(ollamaContainer);
      if (!result.success) {
        log.warn({ container: ollamaContainer }, "Container start returned not-found");
        return res.status(404).json({ error: { message: result.message, type: "not_found" } });
      }
      log.info({ container: ollamaContainer }, "Container started");
      res.json({ message: "Motor Ollama iniciado" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      log.error({ container: ollamaContainer, message }, "Container start failed");
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.post("/api/ollama/stop", authMiddleware, async (_req, res) => {
    log.info("POST /api/ollama/stop");
    try {
      const result = await stopContainer.execute(ollamaContainer);
      if (!result.success) {
        log.warn({ container: ollamaContainer }, "Container stop returned not-found");
        return res.status(404).json({ error: { message: result.message, type: "not_found" } });
      }
      log.info({ container: ollamaContainer }, "Container stopped");
      res.json({ message: "Motor Ollama detenido" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      log.error({ container: ollamaContainer, message }, "Container stop failed");
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.post("/api/ollama/restart", authMiddleware, async (_req, res) => {
    log.info("POST /api/ollama/restart");
    try {
      const result = await restartContainer.execute(ollamaContainer);
      if (!result.success) {
        log.warn({ container: ollamaContainer }, "Container restart returned not-found");
        return res.status(404).json({ error: { message: result.message, type: "not_found" } });
      }
      log.info({ container: ollamaContainer }, "Container restarted");
      res.json({ message: "Motor Ollama reiniciado" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      log.error({ container: ollamaContainer, message }, "Container restart failed");
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.post("/api/brain/start", authMiddleware, async (_req, res) => {
    log.info("POST /api/brain/start");
    try {
      const result = await startContainer.execute(brainContainer);
      if (!result.success) {
        log.warn({ container: brainContainer }, "Brain start returned not-found");
        return res.status(404).json({ error: { message: result.message, type: "not_found" } });
      }
      log.info({ container: brainContainer }, "Brain started");
      res.json({ message: "Cerebro MCP iniciado", running: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      log.error({ container: brainContainer, message }, "Brain start failed");
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.post("/api/brain/stop", authMiddleware, async (_req, res) => {
    log.info("POST /api/brain/stop");
    try {
      const result = await stopContainer.execute(brainContainer);
      if (!result.success) {
        log.warn({ container: brainContainer }, "Brain stop returned not-found");
        return res.status(404).json({ error: { message: result.message, type: "not_found" } });
      }
      log.info({ container: brainContainer }, "Brain stopped");
      res.json({ message: "Cerebro MCP detenido", running: false });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      log.error({ container: brainContainer, message }, "Brain stop failed");
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  return router;
}
