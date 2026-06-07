import TelegramBot from "node-telegram-bot-api";
import type { AppConfig } from "../config.js";
import type { BrainClient } from "../brain/client.js";
import { runAgent } from "../agent/runAgent.js";
import { listAllUsers } from "../db/users.js";
import { listExperts, getGeneralConfig } from "../db/experts.js";
import { getOrCreateChannelChat } from "../db/chats.js";
import { saveMessage } from "../db/messages.js";
import { logger } from "../../utils/logger.js";
import { handleTelegramCommand } from "./commands.js";
import { handleCallbackQuery } from "./callbacks.js";

let bot: TelegramBot | null = null;
let activeToken: string | null = null;
let lastErrorTime = 0;
let errorCount = 0;
let _config: AppConfig | null = null;
let _brain: BrainClient | null = null;

export function getBot(): TelegramBot | null {
	return bot;
}

export function initTelegramDeps(config: AppConfig, brain: BrainClient): void {
	_config = config;
	_brain = brain;
}

export async function stopTelegram(): Promise<void> {
	if (bot) {
		logger.info("📱 Stopping Telegram bot...");
		try {
			await bot.stopPolling();
		} catch (err) {
			logger.error(`❌ Error stopping Telegram polling: ${err}`);
		}
		bot = null;
		activeToken = null;
	}
}

export async function startTelegram(): Promise<void> {
	if (!_config || !_brain) {
		logger.warn("[Telegram] Config or Brain not initialized. Call initTelegramDeps() first.");
		return;
	}

	const tgToken = _config.telegramBotToken;
	if (!tgToken || tgToken === "123456:ABCDEF" || tgToken === "") {
		if (bot) {
			logger.warn("ℹ️ Telegram disabled (token removed or invalid).");
			await stopTelegram();
		}
		return;
	}

	if (bot && activeToken === tgToken) {
		logger.info("ℹ️ Telegram already active with current token.");
		return;
	}

	if (bot) {
		logger.info("📱 Restarting Telegram bot with new token...");
		await stopTelegram();
		await new Promise((r) => setTimeout(r as () => void, 1000));
	}

	const tokenLog = tgToken.slice(0, 6) + "..." + tgToken.slice(-4);
	logger.info(`📱 Connecting to Telegram with token: ${tokenLog}`);

	bot = new TelegramBot(tgToken, { polling: true });
	activeToken = tgToken;
	logger.info("✅ Telegram bot started and listening...");

	// ─── Message handler ───────────────────────────────────────────────────
	bot.on("message", async (msg: TelegramBot.Message) => {
		const chatId = msg.chat.id;
		const text = msg.text ?? "";
		const username = msg.from?.username ?? "";
		const firstName = msg.from?.first_name ?? "";

		// Find user in DB
		const allUsersList = listAllUsers();
		const cleanUsername = username.replace(/^@/, "").toLowerCase();

		const dbUser = allUsersList.find((u) => {
			if (u.telegram_id === chatId) return true;
			const dbTgUser = (u.telegram_user || "").replace(/^@/, "").toLowerCase();
			return dbTgUser === cleanUsername && cleanUsername !== "";
		});

		const effectiveUserId = dbUser ? dbUser.userId : `telegram-${chatId}`;

		const isAuthorized =
			_config!.telegramAllowedUsers.includes(username) ||
			_config!.telegramAllowedUsers.includes(cleanUsername) ||
			!!dbUser;

		if (!isAuthorized) {
			logger.warn(`⚠️ Telegram: message rejected from @${username || firstName} (ID: ${chatId})`);
			await bot!.sendMessage(
				chatId,
				"Lo siento, no estás autorizado para usar este asistente. Contacta al administrador."
			);
			return;
		}

		if (dbUser) {
			logger.info(`👤 Telegram identified: @${username} -> ${effectiveUserId}`);
		}

		logger.info(`📱 Telegram [@${username}]: ${text.slice(0, 60)}`);

		// Commands
		if (text.startsWith("/")) {
			await handleTelegramCommand(chatId, text, effectiveUserId, bot!);
			return;
		}

		// Typing indicator
		await bot!.sendChatAction(chatId, "typing");

		try {
			const channelChat = getOrCreateChannelChat(effectiveUserId, "telegram");

			// Persist user message
			saveMessage({
				userId: effectiveUserId,
				chatId: channelChat.id,
				role: "user",
				content: text,
				origin: "telegram",
			});

			// Expert tagging (@AgentName)
			let finalUserText = text;
			const experts = listExperts();
			const tagMatch = text.match(/^@([a-zA-Z0-9_]+)\b/i);

			if (tagMatch) {
				const tagName = tagMatch[1].toLowerCase();
				const expert = experts.find(
					(e) => e.name.toLowerCase().replace(/[^a-z0-9]/g, "") === tagName
				);
				if (expert) {
					logger.info(`🎯 Tag detected for expert: ${expert.name}`);
					const cleanMessage = text.replace(tagMatch[0], "").trim();
					finalUserText = `(OBLIGATORIO: ACTÚA COMO EL EXPERTO "${expert.name}". EL USUARIO TE HA INVOCADO DIRECTAMENTE.) Consulta: ${cleanMessage}`;
				}
			} else {
				// Orchestrator mode
				const orquestador = experts.find((e) =>
					e.name.toLowerCase().includes("orquestador")
				);
				if (orquestador) {
					finalUserText = `(OBLIGATORIO: ACTÚA COMO ORQUESTADOR. REGLAS: ${orquestador.system_prompt})\nConsulta: ${text}`;
				}
			}

			const result = await runAgent({
				chatId: channelChat.id,
				userText: finalUserText,
				config: _config!,
				brain: _brain!,
				origin: "telegram",
				telegramChatId: chatId,
				skipPersistUserMsg: true,
				onStatus: (statusText: string) => {
					bot!.sendMessage(chatId, `⏳ <i>${statusText}</i>`, {
						parse_mode: "HTML",
					}).catch(() => {});
				},
				onTyping: (isTyping: boolean) => {
					if (isTyping) {
						bot!.sendChatAction(chatId, "typing").catch(() => {});
					}
				},
			});

			if (!result.text || result.text.trim() === "") {
				logger.warn("⚠️ Telegram: agent returned empty message.");
				return;
			}

			// Send response
			await bot!
				.sendMessage(chatId, result.text, { parse_mode: "Markdown" })
				.catch(async () => {
					try {
						await bot!.sendMessage(chatId, result.text, { parse_mode: "HTML" });
					} catch {
						await bot!.sendMessage(chatId, result.text);
					}
				});
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			logger.error(`❌ Telegram error: ${errMsg}`);
			await bot!.sendMessage(chatId, `❌ Error: ${errMsg}`);
		}
	});

	// ─── Polling error handler ─────────────────────────────────────────────
	bot.on("polling_error", (err: Error & { code?: string }) => {
		const now = Date.now();
		errorCount++;
		const isNetworkError = err.code === "ENOTFOUND" || err.code === "ETIMEDOUT";

		if (now - lastErrorTime > 30000 || !isNetworkError) {
			const countMsg = errorCount > 1 ? ` (occurred ${errorCount} times)` : "";
			logger.error(`❌ Telegram polling error [${err.code || "UNKNOWN"}]: ${err.message}${countMsg}`);
			lastErrorTime = now;
			errorCount = 0;
		}
	});

	// ─── Callback queries (inline buttons) ─────────────────────────────────
	bot.on("callback_query", async (query: TelegramBot.CallbackQuery) => {
		await handleCallbackQuery(query, resolveUserId, bot!);
	});

	logger.info("📱 Telegram bot active");
}

function resolveUserId(chatId: number, username: string): string {
	const allUsersList = listAllUsers();
	const cleanUsername = username.replace(/^@/, "").toLowerCase();
	const dbUser = allUsersList.find((u) => {
		if (u.telegram_id === chatId) return true;
		const dbTgUser = (u.telegram_user || "").replace(/^@/, "").toLowerCase();
		return dbTgUser === cleanUsername && cleanUsername !== "";
	});
	return dbUser ? dbUser.userId : `telegram-${chatId}`;
}
