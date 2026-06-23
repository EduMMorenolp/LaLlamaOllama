import type { NextFunction, Request, Response } from "express";
import type { AuthService } from "../auth/auth.service.js";
import type { OllamaService } from "../ollama/ollama.service.js";

export function createAuthMiddleware(
	authService: AuthService,
	ollamaService: OllamaService,
) {
	return (req: Request, res: Response, next: NextFunction) => {
		if (!authService.isOllamaAuthEnabled()) {
			return next();
		}

		const ip =
			(req.headers["x-forwarded-for"] as string) ||
			req.socket.remoteAddress ||
			"unknown";
		const apiKey =
			req.headers["x-api-key"] ||
			req.headers.authorization?.toString().replace("Bearer ", "");

		const action = `${req.method} ${req.path}`;
		const isPolling =
			req.method === "GET" &&
			["/api/status", "/api/status/fast", "/api/hardware"].includes(req.path);

		if (authService.validate(apiKey as string)) {
			if (!isPolling) {
				ollamaService.logRequest(ip, action, "Success");
			}
			next();
		} else {
			ollamaService.logRequest(ip, action, "Unauthorized");
			ollamaService.reportFailedAuth(ip);
			res.status(401).json({
				error: {
					message: "Unauthorized: Invalid API Key",
					type: "authentication_error",
				},
			});
		}
	};
}

export function createMcpAuthMiddleware(authService: AuthService) {
	return (req: Request, res: Response, next: NextFunction) => {
		const apiKey =
			req.headers["x-api-key"] ||
			req.headers.authorization?.toString().replace("Bearer ", "");

		if (
			authService.isMcpAuthEnabled() &&
			!authService.validate(apiKey as string)
		) {
			return res.status(401).json({
				error: {
					message: "Unauthorized: Invalid API Key",
					type: "authentication_error",
				},
			});
		}

		next();
	};
}
