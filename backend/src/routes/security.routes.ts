import type { RequestHandler } from "express";
import { Router } from "express";
import type { BanIpUseCase } from "../use-cases/security/ban-ip.js";
import type { UnbanIpUseCase } from "../use-cases/security/unban-ip.js";
import logger from "../utils/logger.js";

const log = logger.child({ component: "security-routes" });

export function createSecurityRouter(
	banIp: BanIpUseCase,
	unbanIp: UnbanIpUseCase,
	authMiddleware: RequestHandler,
) {
	const router = Router();

	router.post("/api/ban", authMiddleware, (req, res) => {
		const { ip } = req.body;
		if (!ip) {
			return res.status(400).json({
				error: { message: "IP is required", type: "invalid_request_error" },
			});
		}
		log.warn({ ip }, "POST /api/ban");
		res.json(banIp.execute(ip));
	});

	router.post("/api/unban", authMiddleware, (req, res) => {
		const { ip } = req.body;
		if (!ip) {
			return res.status(400).json({
				error: { message: "IP is required", type: "invalid_request_error" },
			});
		}
		log.info({ ip }, "POST /api/unban");
		res.json(unbanIp.execute(ip));
	});

	return router;
}
