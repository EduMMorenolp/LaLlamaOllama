import { type WebSocket } from "ws";
import { runAgent } from "../services/agent/runAgent.js";
import type { BrainClient } from "../services/brain/client.js";
import { loadConfig } from "../services/config.js";
import { toolRegistry } from "../services/tools/registry.js";
import { logger } from "../utils/logger.js";
import { createMessage } from "../gateway/protocol.js";
import type { WsServer } from "./ws.js";

export function registerWsHandlers(brain: BrainClient, wsServer: WsServer) {
	const config = loadConfig();

	return {
		handleMessage(clientId: string, ws: WebSocket, msg: unknown) {
			const { type, payload } = msg as { type: string; payload?: Record<string, unknown> };

			switch (type) {
				case "user_message": {
					const chatId = (payload?.chatId as string) || clientId;
					const text = (payload?.text as string) || "";
					if (!text.trim()) {
						ws.send(createMessage("error", { message: "Empty message", code: "EMPTY" }));
						return;
					}
					this.handleUserMessage(chatId, text);
					break;
				}
				case "cancel": {
					const chatId = (payload?.chatId as string) || clientId;
					logger.agent(`[${chatId}] Cancel requested`);
					wsServer.sendToAll("assistant_done", {
						chatId,
						text: "⏹️ Conversación cancelada.",
						model: "system",
						latencyMs: 0,
					});
					break;
				}
				case "get_status": {
					ws.send(createMessage("status", {
						status: "running",
						model: config.defaultModel,
						tools: toolRegistry.getToolNames(),
						clients: wsServer.getClientCount(),
					}));
					break;
				}
				case "list_tools": {
					const specs = toolRegistry.getSpecs();
					ws.send(createMessage("tools_list", { tools: specs }));
					break;
				}
				case "toggle_tool": {
					const name = payload?.name as string;
					const enabled = payload?.enabled as boolean;
					if (name) {
						const ok = toolRegistry.setEnabled(name, enabled);
						ws.send(createMessage("status", {
							message: `Tool "${name}" ${enabled ? "enabled" : "disabled"} (${ok ? "ok" : "not found"})`,
						}));
					}
					break;
				}
				default:
					ws.send(createMessage("error", {
						message: `Unknown message type: ${type}`,
						code: "UNKNOWN_TYPE",
					}));
			}
		},

		async handleUserMessage(chatId: string, text: string) {
			logger.agent(`[${chatId}] Received: "${text.substring(0, 100)}..."`);

			try {
				const result = await runAgent({
					chatId,
					userText: text,
					config,
					brain,
					onChunk: (chunk: string) =>
						wsServer.sendToAll("assistant_chunk", { chatId, text: chunk }),
					onToolCall: (toolName: string, args: Record<string, unknown>) =>
						wsServer.sendToAll("tool_call", { chatId, toolName, args }),
					onToolResult: (toolName: string, result: string) =>
						wsServer.sendToAll("tool_result", { chatId, toolName, result }),
				});

				wsServer.sendToAll("assistant_done", {
					chatId,
					text: result.text,
					model: result.model,
					usage: result.usage,
					latencyMs: result.latencyMs,
				});

				// Auto-save to brain if meaningful
				if (result.text.length > 50) {
					const title = `Agent chat: ${text.substring(0, 60)}...`;
					await brain.saveMemory(
						"decision",
						title,
						`**User**: ${text}\n\n**Agent**: ${result.text.substring(0, 2000)}`
					);
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				logger.error(`[${chatId}] Agent error: ${msg}`);
				wsServer.sendToAll("error", { chatId, message: `Error: ${msg}` });
			}
		},
	};
}
