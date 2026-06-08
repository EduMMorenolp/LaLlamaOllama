import type TelegramBot from "node-telegram-bot-api";
import { logger } from "../../utils/logger.js";
import { resetSession } from "../agent/runAgent.js";
import { loadConfig } from "../config.js";
import { getOrCreateChannelChat } from "../db/chats.js";
import { deleteExpert, getExpert, listExperts, upsertExpert } from "../db/experts.js";
import { getMessages } from "../db/messages.js";
import { getUser } from "../db/users.js";
import { toolRegistry } from "../tools/registry.js";

export async function handleTelegramCommand(
	chatId: number,
	cmd: string,
	sessionId: string,
	bot: TelegramBot
): Promise<void> {
	const config = loadConfig();
	const parts = cmd.split(" ");
	const command = parts[0]?.toLowerCase() ?? "";
	const arg = parts.slice(1).join(" ");

	switch (command) {
		case "/start":
		case "/ayuda":
		case "/help":
			await bot.sendMessage(
				chatId,
				`🤖 <b>LaLlamaOllama Agent — Ayuda</b>\n\n` +
					`🔹 <b>Sistema:</b>\n` +
					`• /reset — Limpiar historial\n` +
					`• /model — Ver modelo actual\n` +
					`• /status — Estado actual\n` +
					`• /tools — Herramientas disponibles\n` +
					`• /ayuda — Mostrar este menú\n\n` +
					`🔹 <b>Agentes Expertos:</b>\n` +
					`• /agentes — Listar agentes\n` +
					`• /crear_agente nombre|modelo|prompt — Crear agente\n` +
					`• /borrar_agente &lt;nombre&gt; — Eliminar agente\n\n` +
					`💡 Usá @NombreAgente para invocar un agente directamente.`,
				{ parse_mode: "HTML" }
			);
			break;

		case "/agentes": {
			const experts = listExperts();
			if (experts.length === 0) {
				await bot.sendMessage(chatId, "No hay agentes expertos configurados aún.");
			} else {
				const list = experts
					.map(
						(e) =>
							`• <b>${e.name}</b> (<code>${e.model}</code>)\n  <i>${e.system_prompt.slice(0, 50).replace(/</g, "&lt;").replace(/>/g, "&gt;")}...</i>`
					)
					.join("\n\n");
				await bot.sendMessage(chatId, `🤖 <b>Agentes Expertos:</b>\n\n${list}`, {
					parse_mode: "HTML",
				});
			}
			break;
		}

		case "/crear_agente": {
			const subParts = arg.split("|");
			if (subParts.length < 3) {
				await bot.sendMessage(chatId, "❌ Formato inválido. Usá:\n`/crear_agente nombre|modelo|prompt`", {
					parse_mode: "Markdown",
				});
				return;
			}
			const [name, model, ...promptParts] = subParts;
			const systemPrompt = promptParts.join("|").trim();
			try {
				upsertExpert({
					name: name.trim(),
					model: model.trim(),
					system_prompt: systemPrompt,
					tools: [],
					experts: [],
					temperature: 0.7,
				});
				await bot.sendMessage(chatId, `✅ Agente experto "*${name.trim()}*" creado/actualizado.`, {
					parse_mode: "Markdown",
				});
			} catch (err) {
				await bot.sendMessage(chatId, `❌ Error: ${err instanceof Error ? err.message : String(err)}`);
			}
			break;
		}

		case "/borrar_agente": {
			if (!arg) {
				await bot.sendMessage(chatId, "❌ Especificá el nombre del agente a borrar.");
				return;
			}
			const name = arg.trim();
			if (!getExpert(name)) {
				await bot.sendMessage(chatId, `❌ El agente "${name}" no existe.`);
				return;
			}
			deleteExpert(name);
			await bot.sendMessage(chatId, `✅ Agente "${name}" eliminado.`);
			break;
		}

		case "/reset": {
			const channelChat = getOrCreateChannelChat(sessionId, "telegram");
			resetSession(channelChat.id);
			await bot.sendMessage(chatId, "✅ Sesión reiniciada.");
			break;
		}

		case "/model":
			await bot.sendMessage(
				chatId,
				`Modelo actual: <code>${config.defaultModel}</code>\nPara cambiarlo, usá la configuración vía Web Dashboard.`,
				{ parse_mode: "HTML" }
			);
			break;

		case "/status": {
			const channelChat = getOrCreateChannelChat(sessionId, "telegram");
			const history = getMessages(channelChat.id, 5);
			await bot.sendMessage(
				chatId,
				`📊 <b>Estado:</b>\nModelo: <code>${config.defaultModel}</code>\nMensajes: ${history.length}\nHerramientas: ${toolRegistry.getToolNames().length}`,
				{ parse_mode: "HTML" }
			);
			break;
		}

		case "/tools": {
			const tools = toolRegistry.getToolNames();
			if (tools.length === 0) {
				await bot.sendMessage(chatId, "No hay herramientas habilitadas.");
			} else {
				const list = tools.map((t) => `• <b>${t}</b>`).join("\n");
				await bot.sendMessage(chatId, `🔧 <b>Herramientas:</b>\n${list}`, {
					parse_mode: "HTML",
				});
			}
			break;
		}

		case "/profile": {
			const user = getUser(sessionId);
			if (!user) {
				await bot.sendMessage(chatId, "❌ No tenés perfil configurado. Enviá un mensaje para empezar.");
			} else {
				await bot.sendMessage(
					chatId,
					`👤 <b>Perfil:</b>\n• ID: <code>${user.userId}</code>\n• Nombre: ${user.name || "Sin nombre"}\n• Zona horaria: <code>${user.timezone}</code>`,
					{ parse_mode: "HTML" }
				);
			}
			break;
		}

		default:
			await bot.sendMessage(chatId, `Comando desconocido. Usá /help para ver los disponibles.`);
	}
}
