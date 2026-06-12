import axios from "axios";
import type { WebSocket } from "ws";
import { createMessage } from "../gateway/protocol.js";
import { runAgent } from "../services/agent/runAgent.js";
import { pushSessionMessages, resetSession } from "../services/agent/runAgentCore.js";
import { generateSuggestions } from "../services/agent/suggestions.js";
import type { BrainClient } from "../services/brain/client.js";
import { loadConfig } from "../services/config.js";
import {
	createChat,
	deleteChat as deleteDbChat,
	getChat,
	getChatWithStats,
	listChannelChats,
	listChats,
	renameChat,
	togglePin,
} from "../services/db/chats.js";
import {
	deleteExpert,
	getExpert,
	getGeneralConfig,
	listExperts,
	type SubAgent,
	upsertExpert,
} from "../services/db/experts.js";
import { getMessages } from "../services/db/messages.js";
import { deleteModel, listModels, type ModelEntry, upsertModel } from "../services/db/models.js";
import { createRun, listRunsByFilters } from "../services/db/runs.js";
import {
	isMessageSaved,
	listSavedMessages,
	saveMessageToFavorites,
	unsaveMessage,
} from "../services/db/savedMessages.js";
import { deleteUser, listAllUsers, type UserProfile, upsertUser } from "../services/db/users.js";
import { getDockerInfo } from "../services/runtime.js";
import { getBot, getTelegramConfig, initTelegramDeps, setTelegramConfig, startTelegram, stopTelegram } from "../services/telegram/bot.js";
import {
	deleteMode as deleteAgentMode,
	getActiveMode,
	getMode,
	incrementModeUsage,
	listModes,
	setActiveMode,
	upsertMode,
} from "../services/db/modes.js";
import { setSetting } from "../services/db/settings.js";
import { toolRegistry } from "../services/tools/registry.js";
import { logger } from "../utils/logger.js";
import type { WsServer } from "./ws.js";
import { submitAgentRun } from "../services/orchestrator/index.js";
import { cancelRun } from "../services/db/runs.js";
import {
	listScheduledTasks,
	getScheduledTask,
	createScheduledTask,
	updateScheduledTask,
	deleteScheduledTask,
	toggleScheduledTask,
} from "../services/db/scheduled-tasks.js";

export function registerWsHandlers(brain: BrainClient, wsServer: WsServer) {
	const config = loadConfig();
	const userMap = new Map<string, string>();

	// Initialize telegram deps
	initTelegramDeps(config, brain, wsServer);

	return {
		onDisconnect(clientId: string) {
			const userId = userMap.get(clientId);
			if (userId) {
				userMap.delete(clientId);
			}
		},
		async handleMessage(clientId: string, ws: WebSocket, msg: unknown) {
			const parsed = msg as { type: string; payload?: Record<string, unknown> };
			const { type, payload } = parsed;

			switch (type) {
				case "user_message": {
					const rawChatId = (payload?.chatId as string) || clientId;
					const text = (payload?.text as string) || "";
					const attachments = payload?.attachments as
						| Array<{ name: string; type: string; data: string }>
						| undefined;
					const quotedMessage = payload?.quotedMessage as
						| { content: string; role: string; timestamp?: string }
						| undefined;
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

					this.handleUserMessage(chatId, text, clientId, attachments, quotedMessage);
					break;
				}
				case "cancel": {
					const chatId = (payload?.chatId as string) || clientId;
					logger.agent("[" + chatId + "] Cancel requested");
					wsServer.sendToAll("assistant_done", {
						chatId,
						text: "Conversación cancelada.",
						model: "system",
						latencyMs: 0,
					});
					break;
				}

				// Status / Tools
				case "get_status": {
					const gc = getGeneralConfig();
					const effectiveModel = gc?.model || config.defaultModel;
					ws.send(
						createMessage("status", {
							status: "running",
							model: effectiveModel,
							tools: toolRegistry.getToolNames(),
							clients: wsServer.getClientCount(),
							telegramActive: getBot() !== null,
						})
					);
					break;
				}
			case "list_tools": {
					const tools = toolRegistry.getAllTools();
					ws.send(createMessage("tools_list", { tools }));
					break;
				}
				case "toggle_tool": {
					const name = payload?.name as string;
					const enabled = payload?.enabled as boolean;
					if (name) {
						const ok = toolRegistry.setEnabled(name, enabled);
						ws.send(
							createMessage("status", {
								message: "Tool \"" + name + "\" " + (enabled ? "enabled" : "disabled") + " (" + (ok ? "ok" : "not found") + ")",
							})
						);
					}
					break;
				}

				// Ollama models
				case "list_ollama_models": {
					const backendUrl = config.backendUrl;
					axios
						.get(backendUrl + "/api/models", {
							timeout: 3000,
							headers: { "X-API-Key": config.apiKey },
						})
						.then((response) => {
							const models = response.data?.models || [];
							ws.send(createMessage("ollama_models", { models }));
						})
						.catch((err) => {
							logger.warn(
								"Could not fetch Ollama models: " + (err instanceof Error ? err.message : String(err))
							);
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
						logger.info("WebChat identified: " + clientId + " -> " + userId);
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
					logger.info("User registered: " + userId);
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
					logger.info("User deleted: " + dId);
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
					logger.info(
						"Config update: model=" + cfg.model + ", temperature=" + cfg.temperature + ", history_limit=" + cfg.history_limit
					);
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

				// Mode Management
				case "list_modes": {
					const modes = listModes();
					const active = getActiveMode().name;
					ws.send(createMessage("list_modes", { modes, active }));
					break;
				}
				case "get_active_mode": {
					const mode = getActiveMode();
					ws.send(createMessage("get_active_mode", { mode }));
					break;
				}
				case "set_active_mode": {
					const name = payload?.name as string;
					if (!name) {
						ws.send(createMessage("error", { message: "Mode name is required" }));
						break;
					}
					const mode = getMode(name);
					if (!mode) {
						ws.send(createMessage("error", { message: "Mode '" + name + "' not found" }));
						break;
					}
					setActiveMode(name);
					incrementModeUsage(name);

					// Apply tool configuration for this mode
					await toolRegistry.applyModeTools(mode.tools);

					// Reset all LLM sessions to force re-init with new mode config
					const { resetAllSessions } = await import("../services/agent/runAgentCore.js");
					resetAllSessions();

					// Broadcast mode change to ALL connected clients
					wsServer.sendToAll("mode_changed", {
						mode: mode.name,
						label: mode.label,
						system_prompt: mode.system_prompt,
						tools: mode.tools,
						model: mode.model,
						temperature: mode.temperature,
						resetSession: true,
					});

					// Also update __general__ config to keep system prompt in sync
					upsertExpert({
						name: "__general__",
						model: mode.model || config.defaultModel,
						system_prompt: mode.system_prompt,
						tools: [],
						experts: [],
						temperature: mode.temperature,
						history_limit: mode.history_limit,
					});

					logger.info("[Modes] Active mode set to '" + name + "' via WS");
					ws.send(createMessage("set_active_mode", { success: true, mode: getActiveMode() }));
					break;
				}
				case "mode_update": {
					const action = payload?.action as string;
					const modePayload = payload?.mode as Record<string, unknown> | undefined;
					const deleteName = payload?.name as string | undefined;

					try {
						if (action === "upsert" && modePayload) {
							upsertMode(modePayload as any);
						} else if (action === "delete" && deleteName) {
							deleteAgentMode(deleteName);
						}
						// Broadcast updated list to all
						const modes = listModes();
						const active = getActiveMode().name;
						wsServer.sendToAll("list_modes", { modes, active });
					} catch (err) {
						const msg = err instanceof Error ? err.message : String(err);
						ws.send(createMessage("error", { message: msg }));
					}
					break;
				}

				// Telegram Settings
				case "telegram_update": {
					const token = payload?.botToken as string;
					const enabled = payload?.enabled as boolean;
					const allowedUsers = payload?.allowedUsers as string[] | undefined;

					// Persist to DB so it survives restarts
					if (token) {
						setSetting("telegram_bot_token", token);
					}
					if (allowedUsers) {
						setSetting("telegram_allowed_users", JSON.stringify(allowedUsers));
					}

					if (enabled && token) {
						// Update config in bot.ts before starting
						setTelegramConfig(token, allowedUsers || config.telegramAllowedUsers || []);
						// Also update local config so subsequent reads are correct
						config.telegramBotToken = token;
						if (allowedUsers) config.telegramAllowedUsers = allowedUsers;
						startTelegram().catch((err) => {
							logger.error("Failed to start Telegram: " + err);
						});
					} else if (!enabled) {
						stopTelegram().catch((err) => {
							logger.error("Failed to stop Telegram: " + err);
						});
					}
					// Broadcast status to ALL connected clients
					const tg = getTelegramConfig();
					wsServer.sendToAll("telegram_status", {
						active: tg.running,
						running: tg.running,
						allowedUsers: tg.allowedUsers,
						tokenPreview: tg.token
							? tg.token.slice(0, 6) + "..." + tg.token.slice(-4)
							: null,
					});
					ws.send(
						createMessage("status", {
							message: "Telegram " + (enabled ? "started" : "stopped"),
							telegramActive: tg.running,
						})
					);
					break;
				}

				// Telegram Status
				case "telegram_get_status": {
					const tg = getTelegramConfig();
					ws.send(
						createMessage("telegram_status", {
							active: tg.running,
							running: tg.running,
							allowedUsers: tg.allowedUsers,
							tokenPreview: tg.token
								? tg.token.slice(0, 6) + "..." + tg.token.slice(-4)
								: null,
						})
					);
					break;
				}

				// Docker/Container info
				case "get_docker_info": {
					try {
						const dockerInfo = getDockerInfo();
						ws.send(createMessage("docker_info", { dockerInfo }));
					} catch {
						ws.send(createMessage("docker_info", { dockerInfo: null }));
					}
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

				// New task
				case "new_task": {
					const userId = userMap.get(clientId) ?? clientId;
					const taskText = (payload?.text as string) || "Nueva tarea";
					const chatId = (payload?.chatId as string) || userId;
					const runId = createRun({ chatId, userText: taskText, origin: "web", status: "queued" });
					ws.send(createMessage("task_created", { runId, chatId, text: taskText, status: "queued", origin: "web" }));
					// Enqueue the task for processing in the background
					submitAgentRun({ chatId, userText: taskText, origin: "web", runId }).catch((err: unknown) => {
						logger.error("[Tasks] new_task failed: " + (err instanceof Error ? err.message : String(err)));
					});
					break;
				}

				// Task management
				case "cancel_task": {
					const runIdStr = payload?.runId as string;
					const runId = parseInt(runIdStr, 10);
					if (isNaN(runId)) {
						ws.send(createMessage("error", { message: "Invalid runId", code: "INVALID_RUN_ID" }));
						break;
					}
					const { getRun } = await import("../services/db/runs.js");
					const run = getRun(runId);
					if (!run) {
						ws.send(createMessage("error", { message: "Run not found", code: "RUN_NOT_FOUND" }));
						break;
					}
					if (run.status !== "queued" && run.status !== "running") {
						ws.send(createMessage("error", { message: "Cannot cancel task with status '" + run.status + "'", code: "INVALID_STATUS" }));
						break;
					}
					cancelRun(runId);
					wsServer.sendToAll("task_cancelled", { runId, chatId: run.chatId, text: run.userText });
					ws.send(createMessage("task_cancelled", { runId, status: "cancelled" }));
					break;
				}

				case "list_scheduled_tasks": {
					const tasks = listScheduledTasks();
					ws.send(createMessage("scheduled_tasks_list", { tasks }));
					break;
				}

				case "create_scheduled_task": {
					const name = payload?.name as string;
					const cron_expression = payload?.cron_expression as string;
					const task_text = payload?.task_text as string;
					const mode_id = payload?.mode_id as string;
					if (!name || !cron_expression || !task_text) {
						ws.send(createMessage("error", { message: "Missing required fields: name, cron_expression, task_text" }));
						break;
					}
					const id = createScheduledTask({ name, cron_expression, task_text, mode_id });
					ws.send(createMessage("scheduled_tasks_list", { tasks: listScheduledTasks() }));
					break;
				}

				case "update_scheduled_task": {
					const id = parseInt(payload?.id as string, 10);
					if (isNaN(id)) { ws.send(createMessage("error", { message: "Invalid id" })); break; }
					updateScheduledTask(id, payload as any);
					ws.send(createMessage("scheduled_tasks_list", { tasks: listScheduledTasks() }));
					break;
				}

				case "delete_scheduled_task": {
					const id = parseInt(payload?.id as string, 10);
					if (isNaN(id)) { ws.send(createMessage("error", { message: "Invalid id" })); break; }
					deleteScheduledTask(id);
					ws.send(createMessage("scheduled_tasks_list", { tasks: listScheduledTasks() }));
					break;
				}

				case "toggle_scheduled_task": {
					const id = parseInt(payload?.id as string, 10);
					if (isNaN(id)) { ws.send(createMessage("error", { message: "Invalid id" })); break; }
					toggleScheduledTask(id);
					ws.send(createMessage("scheduled_tasks_list", { tasks: listScheduledTasks() }));
					break;
				}

				// Favorites / Saved messages
				case "save_message": {
					const userId_sv = userMap.get(clientId) ?? clientId;
					const chatId_sv = payload?.chatId as string;
					const msgRole = payload?.messageRole as string;
					const msgContent = payload?.messageContent as string;
					const msgTimestamp = payload?.messageTimestamp as string;
					const ok_sv = saveMessageToFavorites(userId_sv, chatId_sv, msgRole, msgContent, msgTimestamp);
					ws.send(
						createMessage("message_saved", {
							ok: ok_sv,
							chatId: chatId_sv,
							messageContent: msgContent.substring(0, 100),
						})
					);
					break;
				}
				case "unsave_message": {
					const userId_us = userMap.get(clientId) ?? clientId;
					const chatId_us = payload?.chatId as string;
					const msgContent_us = payload?.messageContent as string;
					const ok_us = unsaveMessage(userId_us, chatId_us, msgContent_us);
					ws.send(createMessage("message_unsaved", { ok: ok_us }));
					break;
				}
				case "list_saved_messages": {
					const userId_ls = userMap.get(clientId) ?? clientId;
					const saved = listSavedMessages(userId_ls);
					ws.send(createMessage("saved_messages_list", { saved }));
					break;
				}
				case "is_message_saved": {
					const userId_ims = userMap.get(clientId) ?? clientId;
					const chatId_ims = payload?.chatId as string;
					const msgContent_ims = payload?.messageContent as string;
					const saved_ims = isMessageSaved(userId_ims, chatId_ims, msgContent_ims);
					ws.send(
						createMessage("message_saved_status", {
							saved: saved_ims,
							chatId: chatId_ims,
							messageContent: msgContent_ims.substring(0, 100),
						})
					);
					break;
				}

				// Session history
				case "list_sessions": {
					const userId_lses = userMap.get(clientId) ?? clientId;
					const sessions = listChats(userId_lses, undefined).map((chat) => {
						const info = getChatWithStats(chat.id);
						return {
							...chat,
							messageCount: info.messageCount,
						};
					});
					ws.send(createMessage("list_sessions", { sessions }));
					break;
				}

				default:
					ws.send(
						createMessage("error", {
							message: "Unknown message type: " + type,
							code: "UNKNOWN_TYPE",
						})
					);
			}
		},

		async handleUserMessage(
			chatId: string,
			text: string,
			clientId: string,
			attachments?: Array<{ name: string; type: string; data: string }>,
			quotedMessage?: { content: string; role: string; timestamp?: string }
		) {
			logger.agent("[" + chatId + "] Received: \"" + text.substring(0, 100) + "...\"");

			try {
				const result = await runAgent({
					chatId,
					userText: text,
					config,
					brain,
					attachments,
					quotedMessage,
					onChunk: (chunk: string) => wsServer.sendToAll("assistant_chunk", { chatId, text: chunk }),
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

				// Auto-suggestions: async, non-blocking
				generateSuggestions(chatId, text, result.text, config, brain, (suggestions) => {
					if (suggestions.length > 0) {
						wsServer.sendToAll("suggestions", { chatId, suggestions });
					}
				}).catch(() => {});

				// Send updated chat list to all clients so sidebar refreshes with lastMessage
				const userId = userMap.get(clientId) ?? clientId;
				wsServer.sendToAll("list_chats", {
					chats: listChats(userId, undefined),
					channelChats: listChannelChats(userId),
				});

				// Auto-save to brain if meaningful
				if (result.text.length > 50) {
					const title = "Agent chat: " + text.substring(0, 60) + "...";
					await brain.saveMemory(
						"decision",
						title,
						"**User**: " + text + "\n\n**Agent**: " + result.text.substring(0, 2000)
					);
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				logger.error("[" + chatId + "] Agent error: " + msg);
				wsServer.sendToAll("error", { chatId, message: "Error: " + msg });
			}
		},
	};
}
