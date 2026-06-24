import type { NextFunction, Request, Response } from "express";
import type { OllamaService } from "../ollama/ollama.service.js";

export function createSecurityMiddleware(ollamaService: OllamaService) {
	return (req: Request, res: Response, next: NextFunction) => {
		const ip =
			(req.headers["x-forwarded-for"] as string) ||
			req.socket.remoteAddress ||
			"unknown";

		if (ollamaService.isBlacklisted(ip)) {
			return res.status(403).json({
				error: {
					message: "Forbidden: Your IP is blacklisted",
					type: "permission_error",
				},
			});
		}
		next();
	};
}
