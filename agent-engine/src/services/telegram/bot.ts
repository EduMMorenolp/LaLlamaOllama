import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import TelegramBot from "node-telegram-bot-api";
import { logger } from "../../utils/logger.js";
import { runAgent } from "../agent/runAgent.js";
import type { BrainClient } from "../brain/client.js";
import type { AppConfig } from "../config.js";
import { getOrCreateChannelChat } from "../db/chats.js";
import { getGeneralConfig, listExperts } from "../db/experts.js";
import { saveMessage } from "../db/messages.js";
import { listAllUsers } from "../db/users.js";
import { handleCallbackQuery } from "./callbacks.js";
import { handleTelegramCommand } from "./commands.js";
import type { WsServer } from "../../server/ws.js";

let bot: TelegramBot | null = null;
let activeToken: string | null = null;
let lastErrorTime = 0;
let errorCount = 0;
let _config: AppConfig | null = null;
let _brain: BrainClient | null = null;
let _wsServer: WsServer | null = null;

const TELEGRAM_ATTACHMENTS_DIR = "knowledge/telegram";

export function getBot(): TelegramBot | null {
	return bot;
}

/**
 * Returns the current Telegram config (token, allowed users, running status).
 * Used by WS handlers to report real-time config without stale env references.
 */
export function getTelegramConfig(): {
	token: string;
	allowedUsers: string[];
	running: boolean;
} {
	return {
		token: _config?.telegramBotToken || "",
		allowedUsers: _config?.telegramAllowedUsers || [],
		running: bot !== null,
	};
}

export function initTelegramDeps(config: AppConfig, brain: BrainClient, wsServer?: WsServer): void {
	_config = config;
	_brain = brain;
	_wsServer = wsServer ?? null;
}

/**
 * Update the in-memory Telegram config at runtime.
 * Called before startTelegram() to apply new token or allowed users without restarting the process.
 */
export function setTelegramConfig(token: string, allowedUsers: string[]): void {
	if (_config) {
		_config.telegramBotToken = token;
		_config.telegramAllowedUsers = allowedUsers;
	}
}

export async function stopTelegram(): Promise<void> {
	if (bot) {
		logger.info("🛑 Stopping Telegram bot...");
		try {
			await bot.stopPolling();
		} catch (err) {
			logger.error(`❌ Error stopping Telegram polling: ${err}`);
		}
		bot = null;
		activeToken = null;
	}
}

/**
 * Download a file from Telegram to the workspace knowledge directory.
 * Returns { name, path } or null on failure.
 */
async function downloadTelegramFile(
	fileId: string,
	subDir: string,
	extension: string
): Promise<{ name: string; path: string } | null> {
	if (!bot || !_config) return null;

	try {
		const fileInfo = await bot.getFile(fileId);
		if (!fileInfo.file_path) {
			logger.warn(`[TG] getFile returned no file_path for ${fileId}`);
			return null;
		}

		const attachDir = path.join(_config.workspaceDir, TELEGRAM_ATTACHMENTS_DIR, subDir);
		fs.mkdirSync(attachDir, { recursive: true });

		const ext = extension.startsWith(".") ? extension : `.${extension}`;
		const uniqueName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
		const destPath = path.join(attachDir, uniqueName);

		const downloadedPath = await bot.downloadFile(fileId, attachDir);
		// downloadFile saves with the original filename; rename to our unique name
		if (downloadedPath !== destPath) {
			try {
				fs.renameSync(downloadedPath, destPath);
			} catch {
				// If rename fails (e.g. cross-device), copy and delete
				fs.copyFileSync(downloadedPath, destPath);
				fs.unlinkSync(downloadedPath);
			}
		}

		logger.info(`[TG] File saved: ${destPath} (${fileInfo.file_size ? `${(fileInfo.file_size / 1024).toFixed(1)} KB` : "unknown size"})`);
		return { name: uniqueName, path: destPath };
	} catch (err) {
		logger.warn(`[TG] Failed to download file ${fileId}: ${err instanceof Error ? err.message : String(err)}`);
		return null;
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
			logger.warn("🚫 Telegram disabled (token removed or invalid).");
			await stopTelegram();
		}
		return;
	}

	if (bot && activeToken === tgToken) {
		logger.info("🚫 Telegram already active with current token.");
		return;
	}

	if (bot) {
		logger.info("🔄 Restarting Telegram bot with new token...");
		await stopTelegram();
		await new Promise((r) => setTimeout(r as () => void, 1000));
	}

	const tokenLog = tgToken.slice(0, 6) + "..." + tgToken.slice(-4);
	logger.info(`🔄 Connecting to Telegram with token: ${tokenLog}`);

	bot = new TelegramBot(tgToken, { polling: true });
	activeToken = tgToken;
	logger.info("🤖 Telegram bot started and listening...");

	// ────────────────────────────────────────────────────────────────────────────────
	// 💬 Message handler
	// ────────────────────────────────────────────────────────────────────────────────
	bot.on("message", async (msg: TelegramBot.Message) => {
		const chatId = msg.chat.id;
		const text = msg.caption ?? msg.text ?? "";
		const username = msg.from?.username ?? "";
		const firstName = msg.from?.first_name ?? "";
		const hasAttachments = !!(msg.audio || msg.document || msg.voice || msg.video || (msg.photo && msg.photo.length > 0));

		// 🔍 DEBUG: log ALL incoming messages regardless of anything
		logger.info(`📥 [TG-DEBUG] Message received — chatId: ${chatId}, from: @${username || firstName}, text: "${text.slice(0, 100)}"${hasAttachments ? " [HAS ATTACHMENTS]" : ""}`);
		logger.info(`📥 [TG-DEBUG] AllowedUsers in config: [${_config!.telegramAllowedUsers.join(", ")}]`);
		logger.info(`📥 [TG-DEBUG] Checking username "${username}" against allowedUsers: ${_config!.telegramAllowedUsers.includes(username)}`);
		logger.info(`📥 [TG-DEBUG] Checking cleanUsername "${username.replace(/^@/, "").toLowerCase()}": ${_config!.telegramAllowedUsers.includes(username.replace(/^@/, "").toLowerCase())}`);

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
			logger.warn(`🚫 Telegram: message rejected from @${username || firstName} (ID: ${chatId})`);
			await bot!.sendMessage(
				chatId,
				"Lo siento, no estás autorizado para usar este asistente. Contacta al administrador."
			);
			return;
		}

		if (dbUser) {
			logger.info(`✅ Telegram identified: @${username} -> ${effectiveUserId}`);
		}

		logger.info(`💬 Telegram [@${username}]: ${text.slice(0, 60)}`);

		// Commands
		if (text.startsWith("/")) {
			await handleTelegramCommand(chatId, text, effectiveUserId, bot!);
			return;
		}

		const startTime = Date.now();
		try {
			// ── Download attachments ─────────────────────────────────────────────
			const attachments: Array<{ name: string; type: string; data: string }> = [];

			// Audio
			if (msg.audio) {
				const file = await downloadTelegramFile(msg.audio.file_id, "audio", "ogg");
				if (file) attachments.push({ name: file.name, type: "audio/ogg", data: file.path });
			}

			// Document (general file)
			if (msg.document) {
				const origName = msg.document.file_name || "file";
				const ext = path.extname(origName).slice(1) || "bin";
				const mime = msg.document.mime_type || "application/octet-stream";
				const file = await downloadTelegramFile(msg.document.file_id, "documents", ext);
				if (file) attachments.push({ name: file.name, type: mime, data: file.path });
			}

			// Voice message
			if (msg.voice) {
				const file = await downloadTelegramFile(msg.voice.file_id, "voice", "ogg");
				if (file) attachments.push({ name: file.name, type: "audio/ogg", data: file.path });
			}

			// Video
			if (msg.video) {
				const file = await downloadTelegramFile(msg.video.file_id, "videos", "mp4");
				if (file) attachments.push({ name: file.name, type: "video/mp4", data: file.path });
			}

			// Photo (use highest resolution)
			if (msg.photo && msg.photo.length > 0) {
				const best = msg.photo[msg.photo.length - 1];
				const file = await downloadTelegramFile(best.file_id, "images", "jpg");
				if (file) attachments.push({ name: file.name, type: "image/jpeg", data: file.path });
			}

			// ── Continue processing ─────────────────────────────────────────────

			// Typing indicator
			bot!.sendChatAction(chatId, "typing").catch(() => {});

			const channelChat = getOrCreateChannelChat(effectiveUserId, "telegram");

			// Build message content (text + attachment summary)
			let contentForDb = text;
			if (attachments.length > 0) {
				const fileList = attachments.map((a) => `[${a.type}] ${a.name}`).join(", ");
				contentForDb = text
					? `${text}\n\n📎 Archivos adjuntos: ${fileList}`
					: `📎 Archivos adjuntos: ${fileList}`;
			}

			// Persist user message
			saveMessage({
				userId: effectiveUserId,
				chatId: channelChat.id,
				role: "user",
				content: contentForDb,
				origin: "telegram",
			});

			// Broadcast user message to WebSocket clients
			if (_wsServer) {
				_wsServer.sendToAll("telegram_message", {
					chatId: channelChat.id,
					role: "user",
					content: contentForDb,
					timestamp: Date.now()
				});
			}

			// Expert tagging (@AgentName)
			let finalUserText = text || (attachments.length > 0 ? "Archivos adjuntos enviados." : "");
			const experts = listExperts();
			const tagMatch = text.match(/^@([a-zA-Z0-9_]+)\b/i);

			if (tagMatch) {
				const tagName = tagMatch[1].toLowerCase();
				const expert = experts.find((e) => e.name.toLowerCase().replace(/[^a-z0-9]/g, "") === tagName);
				if (expert) {
					logger.info(`🎯 Tag detected for expert: ${expert.name}`);
					const cleanMessage = text.replace(tagMatch[0], "").trim();
					finalUserText = `(OBLIGATORIO: ACTÚA COMO EL EXPERTO "${expert.name}". EL USUARIO TE HA INVOCADO DIRECTAMENTE.) Consulta: ${cleanMessage}`;
				}
			} else {
				// Orchestrator mode
				const orquestador = experts.find((e) => e.name.toLowerCase().includes("orquestador"));
				if (orquestador) {
					finalUserText = `(OBLIGATORIO: ACTÚA COMO ORQUESTADOR. REGLAS: ${orquestador.system_prompt})\nConsulta: ${text}`;
				}
			}

			logger.info(`[TG] Running agent for chatId=${channelChat.id} text="${text.slice(0, 60)}" attachments=${attachments.length}`);
			const result = await runAgent({
				chatId: channelChat.id,
				userText: finalUserText,
				attachments: attachments.length > 0 ? attachments : undefined,
				config: _config!,
				brain: _brain!,
				origin: "telegram",
				telegramChatId: chatId,
				skipPersistUserMsg: true,
				onStatus: (statusText: string) => {
					bot!
						.sendMessage(chatId, `🧠 <i>${statusText}</i>`, {
							parse_mode: "HTML",
						})
						.catch(() => {});
				},
				onTyping: (isTyping: boolean) => {
					if (isTyping) {
						bot!.sendChatAction(chatId, "typing").catch(() => {});
					}
				},
			});

			const elapsed = Date.now() - startTime;

			if (!result.text || result.text.trim() === "") {
				logger.warn(`⚠️ Telegram: agent returned empty message (${elapsed}ms).`);
				await bot!.sendMessage(chatId, "⚠️ El asistente no generó ninguna respuesta.");
				return;
			}

			logger.info(`[TG] Agent responded (${elapsed}ms, ${result.text.length} chars)`);

			// Send response con fallback de formato
			await sendTelegramMessage(chatId, result.text);

			// Broadcast assistant reply to WebSocket clients
			if (_wsServer) {
				_wsServer.sendToAll("telegram_message", {
					chatId: channelChat.id,
					role: "assistant",
					content: result.text,
					timestamp: Date.now()
				});
			}
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			logger.error(`❌ Telegram error (${Date.now() - startTime}ms): ${errMsg}`);
			try {
				await bot!.sendMessage(chatId, `❌ Error: ${errMsg}`);
			} catch {
				logger.error(`❌ Telegram: failed to send error message to chat ${chatId}`);
			}
		}
	});

	// ────────────────────────────────────────────────────────────────────────────────
	// ⚠️ Polling error handler (log ALL errors for debugging)
	// ────────────────────────────────────────────────────────────────────────────────
	bot.on("polling_error", (err: Error & { code?: string }) => {
		errorCount++;
		const isNetworkError = err.code === "ENOTFOUND" || err.code === "ETIMEDOUT";
		const now = Date.now();

		// Log siempre si han pasado 15s o no es error de red
		if (now - lastErrorTime > 15000 || !isNetworkError) {
			const countMsg = errorCount > 1 ? ` (×${errorCount})` : "";
			logger.error(`❌ Telegram polling_error [${err.code || "UNKNOWN"}]: ${err.message}${countMsg}`);
			lastErrorTime = now;
			errorCount = 0;
		}
	});

	// Catch ALL errors (webhook, HTTP, etc.) that node-telegram-bot-api might emit
	bot.on("error", (err: Error) => {
		logger.error(`❌ Telegram bot error: ${err.message}`);
	});

	// Catch webhook errors specifically (some lib versions emit this)
	bot.on("webhook_error", (err: Error) => {
		logger.error(`❌ Telegram webhook error: ${err.message}`);
	});

	// ────────────────────────────────────────────────────────────────────────────────
	// 🔘 Callback queries (inline buttons)
	// ────────────────────────────────────────────────────────────────────────────────
	bot.on("callback_query", async (query: TelegramBot.CallbackQuery) => {
		await handleCallbackQuery(query, resolveUserId, bot!, _brain);
	});

	logger.info("🟢 Telegram bot active");
}

/**
 * Envía un mensaje a Telegram con fallback automático de formato:
 * Markdown → HTML → texto plano.
 * Además sanitiza HTML para evitar errores de parse_mode.
 */
async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
	try {
		await bot!.sendMessage(chatId, text, { parse_mode: "Markdown" });
		return;
	} catch (markdownErr) {
		logger.warn(`[TG] Markdown failed, trying HTML: ${markdownErr instanceof Error ? markdownErr.message.slice(0, 100) : "unknown"}`);
	}

	try {
		// Sanitizar HTML básico antes de enviar
		const sanitized = text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
		await bot!.sendMessage(chatId, sanitized, { parse_mode: "HTML" });
		return;
	} catch (htmlErr) {
		logger.warn(`[TG] HTML also failed, sending as plain text: ${htmlErr instanceof Error ? htmlErr.message.slice(0, 100) : "unknown"}`);
	}

	// Último recurso: texto plano
	try {
		await bot!.sendMessage(chatId, text);
	} catch (err) {
		logger.error(`[TG] All send formats failed: ${err instanceof Error ? err.message : String(err)}`);
		throw err;
	}
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
