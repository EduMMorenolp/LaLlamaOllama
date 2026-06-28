import type OpenAI from "openai";
import { logger } from "../../utils/logger.js";
import type { AppConfig } from "../config.js";
import { callOllamaChatSimple } from "./createOllamaClient.js";

/**
 * Generate a concise summary of a list of conversation messages.
 * Falls back to a simple statistical summary if the LLM call fails.
 */
export async function summarizeMessages(
	client: OpenAI,
	model: string,
	messages: Array<{ role: string; content: string }>,
	maxTokens = 300,
	config?: AppConfig,
): Promise<string> {
	if (messages.length === 0) return "";

	try {
		const summaryPrompt = `Resume la siguiente conversación de forma concisa (máximo ${maxTokens} tokens). 
Incluye SOLO estos puntos si aplican:
- Tema principal de la conversación
- Decisiones importantes tomadas
- Archivos/modificaciones discutidos
- Preferencias del usuario expresadas
- Tareas pendientes

Conversación:
${messages.map((m) => `[${m.role.toUpperCase()}]: ${typeof m.content === "string" ? m.content.substring(0, 2000) : "(contenido multimedia)"}`).join("\n\n")}

Resumen:`;

		const summaryMessages = [
			{
				role: "system" as const,
				content: "Eres un extractor de resúmenes preciso y conciso. Generas resúmenes en español con bullets points. Máximo 300 tokens.",
			},
			{ role: "user" as const, content: summaryPrompt },
		];

		// Use native ollama API if config is provided (ollama provider)
		if (config) {
			const result = await callOllamaChatSimple(config, model, summaryMessages, [], { temperature: 0.3 });
			return result.content.trim() || fallbackSummary(messages);
		}

		const res = await client.chat.completions.create({
			model,
			messages: summaryMessages,
			max_tokens: maxTokens,
			temperature: 0.3,
		});

		return res.choices[0]?.message?.content?.trim() || fallbackSummary(messages);
	} catch (err) {
		logger.warn(`[Summary] LLM summarization failed: ${err}`);
		return fallbackSummary(messages);
	}
}

function fallbackSummary(messages: Array<{ role: string; content: string }>): string {
	const userCount = messages.filter((m) => m.role === "user").length;
	const assistantCount = messages.filter((m) => m.role === "assistant").length;
	const toolCount = messages.filter((m) => m.role === "tool").length;
	const totalChars = messages.reduce((s, m) => s + (typeof m.content === "string" ? m.content.length : 0), 0);
	return [
		`${userCount} mensajes de usuario, ${assistantCount} respuestas, ${toolCount} ejecuciones de herramientas.`,
		`Aproximadamente ${Math.round(totalChars / 1000)}K caracteres de conversación.`,
	].join(" ");
}
