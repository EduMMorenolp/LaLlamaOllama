import { createServer, type IncomingMessage } from "node:http";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { type WebSocket, WebSocketServer } from "ws";
import type { EnvConfig } from "../env.js";
import { logger } from "../utils/logger.js";
import { createMessage } from "./protocol.js";

export class GatewayServer {
	private app: express.Express;
	private httpServer: ReturnType<typeof createServer>;
	private wss: WebSocketServer;
	private clients = new Map<string, WebSocket>();
	private config: EnvConfig;

	// Callbacks for the agent loop
	public onUserMessage?: (chatId: string, text: string, ws: WebSocket) => void;
	public onCancel?: (chatId: string) => void;
	public onGetStatus?: (ws: WebSocket) => void;
	public onListTools?: (ws: WebSocket) => void;
	public onToggleTool?: (name: string, enabled: boolean, ws: WebSocket) => void;

	constructor(config: EnvConfig) {
		this.config = config;
		this.app = express();
		this.app.use(cors());
		this.app.use(express.json({ limit: "10mb" }));

		// Health endpoint
		this.app.get("/health", (_req: Request, res: Response) => {
			res.json({ status: "ok", service: "agent-engine", clients: this.clients.size });
		});

		// REST endpoints
		this.app.get("/api/tools", (_req: Request, res: Response) => {
			res.json({ tools: this.getAvailableTools() });
		});

		this.httpServer = createServer(this.app);

		this.wss = new WebSocketServer({ server: this.httpServer });
		this.setupWebSocket();
	}

	private setupWebSocket() {
		this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
			const clientId = `${req.socket.remoteAddress}:${Date.now()}`;
			this.clients.set(clientId, ws);
			logger.info(`[WS] Client connected: ${clientId}`);

			// Send initial status
			ws.send(createMessage("status", { status: "connected", clientId }));

			ws.on("message", (raw: Buffer) => {
				try {
					const msg = JSON.parse(raw.toString());
					this.handleMessage(clientId, ws, msg);
				} catch (err) {
					ws.send(
						createMessage("error", {
							message: "Invalid message format",
							code: "PARSE_ERROR",
						})
					);
				}
			});

			ws.on("close", () => {
				this.clients.delete(clientId);
				logger.info(`[WS] Client disconnected: ${clientId}`);
			});

			ws.on("error", (err) => {
				logger.error(`[WS] Error for ${clientId}: ${err.message}`);
				this.clients.delete(clientId);
			});
		});
	}

	private handleMessage(clientId: string, ws: WebSocket, msg: unknown) {
		const { type, payload } = msg as { type: string; payload: Record<string, unknown> };

		switch (type) {
			case "user_message": {
				const chatId = (payload?.chatId as string) || clientId;
				const text = (payload?.text as string) || "";
				if (!text.trim()) {
					ws.send(createMessage("error", { message: "Empty message", code: "EMPTY" }));
					return;
				}
				this.onUserMessage?.(chatId, text, ws);
				break;
			}
			case "cancel":
				this.onCancel?.((payload?.chatId as string) || clientId);
				break;
			case "get_status":
				this.onGetStatus?.(ws);
				break;
			case "list_tools":
				this.onListTools?.(ws);
				break;
			case "toggle_tool": {
				const name = payload?.name as string;
				const enabled = payload?.enabled as boolean;
				if (name) this.onToggleTool?.(name, enabled, ws);
				break;
			}
			default:
				ws.send(
					createMessage("error", {
						message: `Unknown message type: ${type}`,
						code: "UNKNOWN_TYPE",
					})
				);
		}
	}

	private getAvailableTools(): string[] {
		// Will be populated by the tool registry
		return [];
	}

	/** Send a chunk to a specific client */
	sendChunk(chatId: string, text: string) {
		this.broadcast(chatId, "assistant_chunk", { chatId, text });
	}

	/** Send completion to a specific client */
	sendDone(chatId: string, text: string, model: string, usage?: object, latencyMs?: number) {
		this.broadcast(chatId, "assistant_done", { chatId, text, model, usage, latencyMs });
	}

	/** Send tool call notification */
	sendToolCall(chatId: string, toolName: string, args: Record<string, unknown>) {
		this.broadcast(chatId, "tool_call", { chatId, toolName, args });
	}

	/** Send tool result */
	sendToolResult(chatId: string, toolName: string, result: string) {
		this.broadcast(chatId, "tool_result", { chatId, toolName, result });
	}

	/** Send error */
	sendError(chatId: string, message: string, code?: string) {
		this.broadcast(chatId, "error", { chatId, message, code });
	}

	private broadcast(chatId: string, type: string, payload: Record<string, unknown>) {
		const msg = createMessage(type as never, payload);
		// Broadcast to all clients (simple approach)
		for (const ws of this.clients.values()) {
			if (ws.readyState === ws.OPEN) {
				ws.send(msg);
			}
		}
	}

	start() {
		this.httpServer.listen(this.config.enginePort, () => {
			logger.info(`[Gateway] Agent Engine listening on port ${this.config.enginePort}`);
			logger.info(`[Gateway] WebSocket server ready`);
			logger.info(`[Gateway] REST API at http://localhost:${this.config.enginePort}/health`);
		});
	}

	stop() {
		this.wss.close();
		this.httpServer.close();
	}
}
