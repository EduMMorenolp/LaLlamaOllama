import TelegramBot, { type CallbackQuery } from "node-telegram-bot-api";
import { logger } from "../../utils/logger.js";
import { runAgentCore } from "../agent/runAgent.js";
import { loadConfig } from "../config.js";
import { getOrCreateChannelChat } from "../db/chats.js";
import type { BrainClient } from "../brain/client.js";

export async function handleCallbackQuery(
	query: CallbackQuery,
	userIdResolver: (chatId: number, username: string) => string,
	bot: TelegramBot,
	brain: BrainClient | null
): Promise<void> {
	if (!query.message || !query.data) return;

	const chatId = query.message.chat.id;
	const telegramUsername = query.from?.username ?? query.from?.first_name ?? "Desconocido";
	const callbackData = query.data;

	logger.info(`🤖 Telegram Callback (@${telegramUsername}): ${callbackData}`);

	// Acknowledge the callback
	await bot.answerCallbackQuery(query.id);

	if (!brain) {
		logger.error("Brain not available for callback query");
		await bot.sendMessage(chatId, "❌ Error: Brain no disponible para procesar la consulta.");
		return;
	}

	const effectiveUserId = userIdResolver(chatId, telegramUsername);
	const config = loadConfig();

	await bot.sendChatAction(chatId, "typing");

	try {
		const channelChat = getOrCreateChannelChat(effectiveUserId, "telegram");
		const simulatedText = `(Botón presionado: ${callbackData})`;

		const result = await runAgentCore({
			chatId: channelChat.id,
			userText: simulatedText,
			config,
			brain,
			onStatus: (statusText) => {
				bot.sendMessage(chatId, `🧠 <i>${statusText}</i>`, {
					parse_mode: "HTML",
				}).catch(() => {});
			},
			onTyping: (isTyping) => {
				if (isTyping) {
					bot.sendChatAction(chatId, "typing").catch(() => {});
				}
			},
		});

		if (result.text && result.text.trim() !== "") {
			await bot.sendMessage(chatId, result.text).catch(async () => {
				await bot.sendMessage(chatId, result.text);
			});
		}
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		logger.error(`❌ Callback error: ${msg}`);
		await bot.sendMessage(chatId, `❌ Error: ${msg}`);
	}
}
