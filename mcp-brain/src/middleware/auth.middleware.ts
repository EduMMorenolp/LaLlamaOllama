import type { NextFunction, Request, Response } from "express";
import logger from "../utils/logger.js";

const BRAIN_API_KEY = process.env.API_KEY || "";

export function brainAuthMiddleware(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	if (!BRAIN_API_KEY) {
		logger.error("BRAIN_API_KEY not set — authentication disabled!");
		const envKey = process.env.API_KEY;
		if (envKey) {
			logger.warn("API_KEY env var found but BRAIN_API_KEY is empty — likely auth misconfiguration");
		}
		return next();
	}

	if (req.path === "/health") {
		return next();
	}

	const apiKey = (
		(req.headers["x-api-key"] as string) ||
		(req.headers.authorization as string) ||
		""
	)
		.replace(/^Bearer\s+/i, "")
		.trim();

	if (apiKey === BRAIN_API_KEY) {
		return next();
	}

	logger.warn({ ip: req.ip, path: req.originalUrl }, "Brain auth rejected");
	res.status(401).json({ error: "Unauthorized: Invalid or missing API Key" });
}
