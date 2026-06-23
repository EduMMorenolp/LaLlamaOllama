import type { RequestHandler } from "express";
import { Router } from "express";
import type { GetHardwareInfoUseCase } from "../use-cases/hardware/get-hardware-info.js";
import type { SetAutoUnloadUseCase } from "../use-cases/hardware/set-auto-unload.js";
import type { SetNumCtxUseCase } from "../use-cases/hardware/set-num-ctx.js";
import logger from "../utils/logger.js";

const log = logger.child({ component: "hardware-routes" });

export function createHardwareRouter(
	getHardwareInfo: GetHardwareInfoUseCase,
	setAutoUnload: SetAutoUnloadUseCase,
	setNumCtx: SetNumCtxUseCase,
	authMiddleware: RequestHandler,
) {
	const router = Router();

	router.get("/api/hardware", authMiddleware, (_req, res) => {
		res.json(getHardwareInfo.execute());
	});

	router.post("/api/hardware/auto-unload", authMiddleware, (req, res) => {
		const { minutes } = req.body;
		log.info({ minutes }, "POST /api/hardware/auto-unload");
		if (typeof minutes !== "number" || minutes < 0) {
			return res.status(400).json({
				error: {
					message: "minutes debe ser un numero >= 0 (0 = desactivado)",
					type: "invalid_request_error",
				},
			});
		}
		res.json(setAutoUnload.execute(minutes));
	});

	router.post("/api/hardware/num-ctx", authMiddleware, (req, res) => {
		const { numCtx } = req.body;
		log.info({ numCtx }, "POST /api/hardware/num-ctx");
		if (typeof numCtx !== "number" || numCtx < 512) {
			return res.status(400).json({
				error: {
					message: "numCtx debe ser >= 512",
					type: "invalid_request_error",
				},
			});
		}
		res.json(setNumCtx.execute(numCtx));
	});

	return router;
}
