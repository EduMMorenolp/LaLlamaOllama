import type { RequestHandler } from "express";
import { Router } from "express";
import type { GetNgrokConfigUseCase } from "../use-cases/ngrok/get-config.js";
import type { GetNgrokStatusUseCase } from "../use-cases/ngrok/get-status.js";
import type { SetNgrokAuthtokenUseCase } from "../use-cases/ngrok/set-authtoken.js";
import type { StartNgrokUseCase } from "../use-cases/ngrok/start-ngrok.js";
import type { StopNgrokUseCase } from "../use-cases/ngrok/stop-ngrok.js";
import logger from "../utils/logger.js";

const log = logger.child({ component: "ngrok-routes" });

export function createNgrokRouter(
	getNgrokStatus: GetNgrokStatusUseCase,
	getNgrokConfig: GetNgrokConfigUseCase,
	setNgrokAuthtoken: SetNgrokAuthtokenUseCase,
	startNgrok: StartNgrokUseCase,
	stopNgrok: StopNgrokUseCase,
	authMiddleware: RequestHandler,
) {
	const router = Router();

	router.get("/api/ngrok/status", authMiddleware, async (_req, res) => {
		try {
			const status = await getNgrokStatus.execute();
			res.json(status);
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			log.warn({ message }, "Ngrok status check failed");
			res.json({ running: false, url: null, error: message });
		}
	});

	router.get("/api/ngrok/config", authMiddleware, async (_req, res) => {
		res.json(getNgrokConfig.execute());
	});

	router.post("/api/ngrok/authtoken", authMiddleware, async (req, res) => {
		const { authtoken } = req.body;
		if (typeof authtoken !== "string" || authtoken.trim().length < 10) {
			return res.status(400).json({
				error: { message: "authtoken invalido", type: "invalid_request_error" },
			});
		}
		try {
			const result = await setNgrokAuthtoken.execute(authtoken.trim());
			res.json(result);
		} catch (e: unknown) {
			const message =
				e instanceof Error
					? e.message
					: "Error actualizando authtoken de ngrok";
			res.status(500).json({ error: { message, type: "server_error" } });
		}
	});

	router.post("/api/ngrok/start", authMiddleware, async (_req, res) => {
		try {
			const result = await startNgrok.execute();
			if (!result.success) {
				return res
					.status(404)
					.json({ error: { message: result.message, type: "not_found" } });
			}
			log.info("ngrok: Tunel iniciado manualmente desde el Dashboard");
			res.json({ message: "Ngrok iniciado", running: true });
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			res.status(500).json({ error: { message, type: "server_error" } });
		}
	});

	router.post("/api/ngrok/stop", authMiddleware, async (_req, res) => {
		try {
			const result = await stopNgrok.execute();
			if (!result.success) {
				return res
					.status(404)
					.json({ error: { message: result.message, type: "not_found" } });
			}
			log.info("ngrok: Tunel detenido manualmente desde el Dashboard");
			res.json({ message: "Ngrok detenido", running: false });
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			res.status(500).json({ error: { message, type: "server_error" } });
		}
	});

	return router;
}
