import { getBot } from "../telegram/bot.js";
import { getDb } from "../db/connection.js";
import { toolRegistry } from "./registry.js";

export function registerNotifyTelegramTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "notify_telegram",
				description: "Envía una notificación al usuario por Telegram. Útil para alertas, confirmaciones o información importante cuando el usuario no está en el dashboard.",
				parameters: {
					type: "object",
					properties: {
						message: {
							type: "string",
							description: "Mensaje a enviar por Telegram",
						},
						parse_mode: {
							type: "string",
							description: "Formato del mensaje: 'HTML' (default), 'Markdown', o 'text'",
							enum: ["HTML", "Markdown", "text"],
						},
						chat_id: {
							type: "string",
							description: "Chat ID específico de Telegram (opcional, si no se provee se envía a todos los chats Telegram conocidos)",
						},
					},
					required: ["message"],
				},
			},
		},
		handler: async (args: Record<string, unknown>) => {
			const message = (args.message as string || "").trim();
			const parseMode = (args.parse_mode as string) || "HTML";
			const specificChatId = (args.chat_id as string || "").trim();

			if (!message) {
				return "Error: No hay mensaje para enviar.";
			}

			const bot = getBot();
			if (!bot) {
				return "Error: El bot de Telegram no está activo. Configúralo primero en Conexión → Telegram.";
			}

			const options: Record<string, unknown> = {};
			if (parseMode !== "text") {
				options.parse_mode = parseMode;
			}

			try {
				if (specificChatId) {
					// Enviar a un chat específico
					await bot.sendMessage(specificChatId, message, options);
					return `✅ Notificación enviada al chat ${specificChatId}.`;
				}

				// Enviar a todos los chats Telegram conocidos (desde DB)
				const db = getDb();
				const telegramChats = db.prepare(
					"SELECT DISTINCT userId FROM chats WHERE origin = 'telegram'"
				).all() as { userId: string }[];

				if (telegramChats.length === 0) {
					return "No hay chats de Telegram en la base de datos. El usuario debe enviar un mensaje al bot primero.";
				}

				let sentCount = 0;
				for (const chat of telegramChats) {
					try {
						await bot.sendMessage(chat.userId, message, options);
						sentCount++;
					} catch {
						// Si un chat falla, continuar con los demás
					}
				}

				return sentCount > 0
					? `✅ Notificación enviada a ${sentCount} chat(s) de Telegram.`
					: "No se pudo enviar la notificación a ningún chat de Telegram.";
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al enviar notificación por Telegram: ${msg}`;
			}
		},
		enabled: true,
	});
}
