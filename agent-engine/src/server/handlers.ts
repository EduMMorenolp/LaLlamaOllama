import { type WebSocket } from "ws";
import { runAgent } from "../services/agent/runAgent.js";
import type { BrainClient } from "../services/brain/client.js";
import { loadConfig } from "../services/config.js";
import { toolRegistry } from "../services/tools/registry.js";
import { logger } from "../utils/logger.js";
import { createMessage } from "../gateway/protocol.js";
import type { WsServer } from "./ws.js";
import {
	listExperts,
	getExpert,
	upsertExpert,
	deleteExpert,
	getGeneralConfig,
	type SubAgent,
} from "../services/db/experts.js";
import { listAllUsers, upsertUser, deleteUser, type UserProfile } from "../services/db/users.js";
import {
	createChat,
	listChats,
	listChannelChats,
	getChat,
	renameChat,
	deleteChat as deleteDbChat,
	togglePin,
} from "../services/db/chats.js";
import { getMessages } from "../services/db/messages.js";
import { listModels, upsertModel, deleteModel, type ModelEntry } from "../services/db/models.js";
import { listRunsByFilters } from "../services/db/runs.js";
import { resetSession, pushSessionMessages } from "../services/agent/runAgentCore.js";
import { startTelegram, stopTelegram, initTelegramDeps } from "../services/telegram/bot.js";
import axios from "axios";

export function registerWsHandlers(brain: BrainClient, wsServer: WsServer) {
	const config = loadConfig();
	const userMap = new Map<string, string>();

	// Initialize telegram deps
	initTelegramDeps(config, brain);

	return {
		handleMessage(clientId: string, ws: WebSocket, msg: unknown) {
			const parsed = msg as { type: string; payload?: Record<string, unknown> };
			const { type, payload } = parsed;

			switch (type) {
				case "user_message": {
					const rawChatId = (payload?.chatId as string) || clientId;
					const text = (payload?.text as string) || "";
					const attachments = payload?.attachments as Array<{ name: string; type: string; data: string }> | undefined;
					if (!text.trim()) {
						ws.send(createMessage("error", { message: "Empty message", code: "EMPTY" }));
						return;
					}

					let chatId = rawChatId;
					if (!getChat(rawChatId)) {
						const userId = userMap.get(clientId) ?? clientId;
						const newChat = createChat(userId, null, text.substring(0, 40));
						chatId = newChat.id;
						ws.send(
							createMessage("list_chats", {
								chats: listChats(userId, undefined),
								channelChats: listChannelChats(userId),
								activeChatId: chatId,
							})
						);
					}

					this.handleUserMessage(chatId, text, clientId, attachments);
					break;
				}
				case "cancel": {
					const chatId = (payload?.chatId as string) || clientId;
					logger.agent(`[${chatId}] Cancel requested`);
					wsServer.sendToAll("assistant_done", {
						chatId,
						text: "? Conversación cancelada.",
						model: "system",
						latencyMs: 0,
					});
					break;
				}

				// Status / Tools
				case "get_status": {
					ws.send(
						createMessage("status", {
							status: "running",
							model: config.defaultModel,
							tools: toolRegistry.getToolNames(),
							clients: wsServer.getClientCount(),
							telegramActive: !!process.env.TELEGRAM_BOT_TOKEN,
						})
					);
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
						ws.send(
							createMessage("status", {
								message: `Tool "${name}" ${enabled ? "enabled" : "disabled"} (${ok ? "ok" : "not found"})`,
							})
						);
					}
					break;
				}

				// Ollama models
				case "list_ollama_models": {
					const backendUrl = config.backendUrl;
					axios.get(`${backendUrl}/api/models`, {
						timeout: 3000,
						headers: { 'X-API-Key': config.apiKey }
					})
						.then((response) => {
							const models = response.data?.models || [];
							ws.send(createMessage("ollama_models", { models }));
						})
						.catch((err) => {
							logger.warn("Could not fetch Ollama models: " + (err instanceof Error ? err.message : String(err)));
							ws.send(createMessage("ollama_models", { models: [] }));
						});
					break;
				}
				// Expert Management
				case "list_experts": {
					const experts = listExperts();
					ws.send(createMessage("list_experts", { experts }));
					break;
				}
				case "expert_update": {
					const action = payload?.action as string;
					if (action === "upsert" && payload?.expert) {
						upsertExpert(payload.expert as SubAgent);
						ws.send(createMessage("list_experts", { experts: listExperts() }));
					} else if (action === "delete" && payload?.name) {
						deleteExpert(payload.name as string);
						ws.send(createMessage("list_experts", { experts: listExperts() }));
					}
					break;
				}

				// User Management
				case "list_users": {
					ws.send(createMessage("list_users", { users: listAllUsers() }));
					break;
				}
				case "identify": {
					const userId = payload?.userId as string;
					if (userId) {
						userMap.set(clientId, userId);
						logger.info(`?? WebChat identified: ${clientId} -> ${userId}`);
						const gc = getGeneralConfig();
						const effectiveModel = gc?.model || config.defaultModel;
						ws.send(
							createMessage("status", {
								status: "identified",
								userId,
								model: effectiveModel,
							})
						);
						// Send chats for this user
						ws.send(
							createMessage("list_chats", {
								chats: listChats(userId, undefined),
								channelChats: listChannelChats(userId),
							})
						);
						ws.send(createMessage("list_experts", { experts: listExperts() }));
					}
					break;
				}
				case "user_register": {
					const userId = payload?.userId as string;
					upsertUser(userId, {
						name: payload?.name as string | undefined,
						timezone: payload?.timezone as string | undefined,
						telegram_user: payload?.telegram_user as string | undefined,
						telegram_token: payload?.telegram_token as string | undefined,
					});
					logger.info(`?? User registered: ${userId}`);
					ws.send(createMessage("list_users", { users: listAllUsers() }));
					break;
				}
				case "user_update": {
					const uId = payload?.userId as string;
					const { userId: _u, ...userData } = payload as Record<string, unknown>;
					upsertUser(uId, userData as Partial<Omit<UserProfile, "userId" | "created_at">>);
					ws.send(createMessage("list_users", { users: listAllUsers() }));
					break;
				}
				case "user_delete": {
					const dId = payload?.userId as string;
					deleteUser(dId);
					logger.info(`??? User deleted: ${dId}`);
					ws.send(createMessage("list_users", { users: listAllUsers() }));
					break;
				}

				// Chat Management
				case "list_chats": {
					const userId = payload?.userId as string;
					if (userId) {
						ws.send(
							createMessage("list_chats", {
								chats: listChats(userId, undefined),
								channelChats: listChannelChats(userId),
							})
						);
					}
					break;
				}
				case "chat_update": {
					const chatAction = payload?.action as string;
					const chatUserId = userMap.get(clientId) ?? clientId;
					let newChatId: string | undefined;
					if (chatAction === "create") {
						const newChat = createChat(
							chatUserId,
							(payload?.expertName as string) || null,
							payload?.title as string
						);
						newChatId = newChat.id;
						resetSession(newChatId);
					} else if (chatAction === "rename" && payload?.chatId && payload?.title) {
						renameChat(payload.chatId as string, payload.title as string);
					} else if (chatAction === "delete" && payload?.chatId) {
						deleteDbChat(payload.chatId as string);
					} else if (chatAction === "pin" && payload?.chatId) {
						togglePin(payload.chatId as string);
					}
					ws.send(
						createMessage("list_chats", {
							chats: listChats(chatUserId, undefined),
							channelChats: listChannelChats(chatUserId),
							...(newChatId ? { activeChatId: newChatId } : {}),
						})
					);
					break;
				}
				case "switch_chat": {
					const swChatId = payload?.chatId as string;
					if (swChatId) {
						resetSession(swChatId);
						const storedMessages = getMessages(swChatId);
						const chat = getChat(swChatId);
						// Populate the fresh session with history from DB so it doesn't reload stale data
						pushSessionMessages(
							swChatId,
							storedMessages.map((m) => ({ role: m.role, content: m.content }))
						);
						ws.send(
							createMessage("assistant_done", {
								chatId: swChatId,
								history: storedMessages.map((m) => ({
									role: m.role,
									text: m.content,
									origin: m.origin,
								})),
								expertName: chat?.expertName || null,
								text: storedMessages.length === 0 ? "Este chat no tiene mensajes aún." : "",
								model: "Sistema",
							})
						);
					}
					break;
				}

				// Model Management
				case "list_models": {
					ws.send(createMessage("list_models", { models: listModels() }));
					break;
				}
				case "model_update": {
					const modelAction = payload?.action as string;
					if (modelAction === "upsert" && payload?.modelConfig) {
						upsertModel(payload.modelConfig as ModelEntry);
					} else if (modelAction === "delete" && payload?.name) {
						deleteModel(payload.name as string);
					}
					ws.send(createMessage("list_models", { models: listModels() }));
					break;
				}

				// General Config
				case "get_general_config": {
					const gc = getGeneralConfig() as Record<string, unknown> | null;
					ws.send(createMessage("general_config", gc || {}));
					break;
				}
				case "general_config_update": {
					const cfg = payload as Record<string, unknown>;
					logger.info(`[Config] Update: model="${cfg.model}", temperature=${cfg.temperature}, history_limit=${cfg.history_limit}`);
					// Preserve existing system_prompt if not provided in the update
					const existing_gc = getGeneralConfig() as Record<string, unknown> | null;
					const existingPrompt = existing_gc?.system_prompt as string | undefined;
					const systemPrompt = (cfg.system_prompt as string) || existingPrompt || "";
					upsertExpert({
						name: "__general__",
						model: (cfg.model as string) || "",
						system_prompt: systemPrompt,
						tools: [],
						experts: [],
						temperature: (cfg.temperature as number) ?? 0.7,
						history_limit: (cfg.history_limit as number) ?? 10,
					});
					const updated = getGeneralConfig() as Record<string, unknown> | null;
					ws.send(createMessage("general_config", updated || {}));
					// Broadcast model change to ALL connected clients (chat, config, etc.)
					wsServer.sendToAll("status", { status: "identified", model: cfg.model as string });
					break;
				}

				// Telegram Settings
				case "telegram_update": {
					const token = payload?.botToken as string;
					const enabled = payload?.enabled as boolean;
					if (enabled && token) {
						// TODO: usar variable de módulo en vez de process.env
						process.env.TELEGRAM_BOT_TOKEN = token;
						startTelegram().catch((err) => {
							logger.error(`Failed to start Telegram: ${err}`);
						});
					} else if (!enabled) {
						stopTelegram().catch((err) => {
							logger.error(`Failed to stop Telegram: ${err}`);
						});
					}
					ws.send(
						createMessage("status", {
							message: `Telegram ${enabled ? "started" : "stopped"}`,
							telegramActive: !!process.env.TELEGRAM_BOT_TOKEN,
						})
					);
					break;
				}

				// Task history
				case "list_tasks": {
					const taskStatus = payload?.status as string | undefined;
					const limit = parseInt(payload?.limit as string, 10) || 20;
					const offset = parseInt(payload?.offset as string, 10) || 0;
					const runs = listRunsByFilters({ status: taskStatus, limit, offset });
					ws.send(createMessage("list_tasks", { runs }));
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
		},

		async handleUserMessage(chatId: string, text: string, clientId: string, attachments?: Array<{ name: string; type: string; data: string }>) {
			logger.agent(`[${chatId}] Received: "${text.substring(0, 100)}..."`);

			try {
				const result = await runAgent({
					chatId,
					userText: text,
					config,
					brain,
					attachments,
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

				// Send updated chat list to all clients so sidebar refreshes with lastMessage
				const userId = userMap.get(clientId) ?? clientId;
				wsServer.sendToAll("list_chats", {
					chats: listChats(userId, undefined),
					channelChats: listChannelChats(userId),
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