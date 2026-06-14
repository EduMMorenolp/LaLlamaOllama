import type { IncomingMessage } from "node:http";
import { type WebSocket, WebSocketServer } from "ws";
import { createMessage } from "../gateway/protocol.js";
import type { BrainClient } from "../services/brain/client.js";
import type { AppConfig } from "../services/config.js";
import { logger } from "../utils/logger.js";
import { registerWsHandlers } from "./handlers.js";

export class WsServer {
	private wss: WebSocketServer;
	private clients = new Map<string, WebSocket>();

	constructor(config: AppConfig, brain: BrainClient) {
		this.wss = new WebSocketServer({ port: config.enginePort + 1 });
		this.setup(brain);
		logger.info(`[WS] WebSocket server listening on port ${config.enginePort + 1}`);
	}

		private setup(brain: BrainClient) {
		this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
			const clientId = `${req.socket.remoteAddress}:${Date.now()}`;
			this.clients.set(clientId, ws);
			logger.info(`[WS] Client connected: ${clientId}`);

			ws.send(createMessage("status", { status: "connected", clientId }));

			const handlers = registerWsHandlers(brain, this);

			ws.on("message", (raw: Buffer) => {
				try {
					const msg = JSON.parse(raw.toString());
					handlers.handleMessage(clientId, ws, msg);
				} catch (err) {
					ws.send(
						createMessage("error", {
							message: "Invalid message format",
							code: "PARSE_ERROR",
						})
					);
				}
			});

			const cleanup = () => {
				this.clients.delete(clientId);
				handlers.onDisconnect(clientId);
			};

			ws.on("close", () => {
				cleanup();
				logger.info(`[WS] Client disconnected: ${clientId}`);
			});

			ws.on("error", (err) => {
				cleanup();
				logger.error(`[WS] Error for ${clientId}: ${err.message}`);
			});
		});
	}

	sendToAll(type: string, payload: Record<string, unknown>) {
		const msg = createMessage(type as never, payload);
		for (const ws of this.clients.values()) {
			if (ws.readyState === ws.OPEN) {
				ws.send(msg);
			}
		}
	}

	sendToClient(clientId: string, type: string, payload: Record<string, unknown>) {
		const ws = this.clients.get(clientId);
		if (ws && ws.readyState === ws.OPEN) {
			ws.send(createMessage(type as never, payload));
		}
	}

	getClientCount(): number {
		return this.clients.size;
	}

	close() {
		this.wss.close();
	}
}
