import { Router } from "express";
import type { RequestHandler } from "express";
import type { BanIpUseCase } from "../use-cases/security/ban-ip.js";
import type { UnbanIpUseCase } from "../use-cases/security/unban-ip.js";

export function createSecurityRouter(
  banIp: BanIpUseCase,
  unbanIp: UnbanIpUseCase,
  authMiddleware: RequestHandler
) {
  const router = Router();

  router.post("/api/ban", authMiddleware, (req, res) => {
    const { ip } = req.body;
    if (!ip) {
      return res.status(400).json({
        error: { message: "IP is required", type: "invalid_request_error" },
      });
    }
    res.json(banIp.execute(ip));
  });

  router.post("/api/unban", authMiddleware, (req, res) => {
    const { ip } = req.body;
    if (!ip) {
      return res.status(400).json({
        error: { message: "IP is required", type: "invalid_request_error" },
      });
    }
    res.json(unbanIp.execute(ip));
  });

  return router;
}
