import type { DatabaseService } from "../../database/connection.js";
import { generate } from "../llm/generate.js";
import { getHistory } from "./getHistory.js";

export interface SummaryResult {
	summary: string;
	keptCount: number;
	totalCount: number;
}

export async function summarizeHistory(
	dbService: DatabaseService,
	sessionId: string,
	model: string = "qwen3.5:4b",
	maxMessages: number = 20,
	keepRecent: number = 5
): Promise<SummaryResult> {
	const { messages, total } = await getHistory(dbService, sessionId, 1000);

	if (total <= maxMessages) {
		return { summary: "", keptCount: total, totalCount: total };
	}

	const toSummarize = messages.slice(0, total - keepRecent);
	const recent = messages.slice(total - keepRecent);

	const conversationText = toSummarize
		.map((m) => `[${m.role.toUpperCase()}]: ${m.content || ""}`)
		.join("\n\n");

	const prompt = `Resume la siguiente conversación de forma concisa, extrayendo los puntos clave, decisiones tomadas, y el contexto relevante. Mantén la información útil para continuar la conversación.

CONVERSACIÓN A RESUMIR:
${conversationText}

RESUMEN (máximo 200 palabras):`;

	let summary: string;
	try {
		summary = await generate(model, prompt, { temperature: 0.3, num_ctx: 4096 });
		summary = summary.trim();
	} catch {
		summary = `[Historial comprimido: ${total - keepRecent} mensajes anteriores. Usa el contexto reciente para continuar.]`;
	}

	const db = dbService.getDb();
	await db.run(`DELETE FROM conversation_history WHERE session_id = ? AND id NOT IN (${recent.map(() => "?").join(",")})`, [
		sessionId,
		...recent.map((m) => m.id),
	]);

	// Insert the summary as a system message with timestamp before the kept messages
	const summaryId = `conv_sum_${Date.now()}`;
	await db.run(
		`INSERT INTO conversation_history (id, session_id, role, content, token_count, created_at)
		 VALUES (?, ?, 'system', ?, 0, ?)`,
		[summaryId, sessionId, summary, Math.min(...recent.map((m) => m.createdAt)) - 1]
	);

	return { summary, keptCount: keepRecent + 1, totalCount: total };
}
