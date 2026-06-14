import { Router } from "express";
import type { RequestHandler } from "express";
import type { AuthService } from "../auth/auth.service.js";
import type { GetFastStatusUseCase } from "../use-cases/status/get-fast-status.js";
import type { GetFullStatusUseCase } from "../use-cases/status/get-full-status.js";
import logger from "../utils/logger.js";

const log = logger.child({ component: "status-routes" });

export function createStatusRouter(
  getFastStatus: GetFastStatusUseCase,
  getFullStatus: GetFullStatusUseCase,
  authService: AuthService,
  authMiddleware: RequestHandler
) {
  const router = Router();

  router.get("/api/status/fast", authMiddleware, async (_req, res) => {
    try {
      const status = await getFastStatus.execute();
      res.json({ ...status, auth: authService.getSettings() });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error({ message }, "GET /api/status/fast failed");
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.get("/api/status/full", authMiddleware, async (_req, res) => {
    try {
      const status = await getFullStatus.execute();
      res.json({ ...status, auth: authService.getSettings() });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error({ message }, "GET /api/status/full failed");
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  router.get("/api/status", authMiddleware, async (_req, res) => {
    try {
      const status = await getFullStatus.execute();
      res.json({ ...status, auth: authService.getSettings() });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error({ message }, "GET /api/status failed");
      res.status(500).json({ error: { message, type: "server_error" } });
    }
  });

  return router;
}
