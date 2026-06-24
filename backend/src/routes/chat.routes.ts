import type { RequestHandler } from "express";
import { Router } from "express";
import { ChatRequestSchema } from "../types/chat.js";
import type { CreateChatUseCase } from "../use-cases/chat/create-chat.js";
import type { CreateChatStreamUseCase } from "../use-cases/chat/create-chat-stream.js";
import logger from "../utils/logger.js";

const log = logger.child({ component: "chat-routes" });

export function createChatRouter(
	createChat: CreateChatUseCase,
	createChatStream: CreateChatStreamUseCase,
	authMiddleware: RequestHandler,
) {
	const router = Router();

	router.post("/v1/chat/completions", authMiddleware, async (req, res) => {
		const parsed = ChatRequestSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({
				error: {
					message: "model y messages son obligatorios",
					type: "invalid_request_error",
				},
			});
		}

		const input = parsed.data;
		log.agent(
			{
				model: input.model,
				stream: input.stream,
				msgCount: input.messages.length,
			},
			"Chat request",
		);

		try {
			if (input.stream === true) {
				await createChatStream.execute(input, res);
			} else {
				const result = await createChat.execute(input);
				log.agent({ model: input.model }, "Chat response complete");
				res.json(result);
			}
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			log.error(
				{ message, stack: error instanceof Error ? error.stack : undefined },
				"chat-error",
			);

			if (input.stream === true) {
				if (!res.headersSent) {
					res.status(500).json({ error: { message, type: "server_error" } });
				} else {
					res.write(
						`data: ${JSON.stringify({ error: { message, type: "server_error" } })}\n\n`,
					);
					res.end();
				}
			} else {
				res.status(500).json({ error: { message, type: "server_error" } });
			}
		}
	});

	return router;
}
