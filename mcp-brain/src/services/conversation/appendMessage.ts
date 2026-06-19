import type { DatabaseService } from "../../database/connection.js";

export interface AppendMessageInput {
	sessionId: string;
	role: "system" | "user" | "assistant" | "tool";
	content: string | null;
	toolCalls?: Array<Record<string, unknown>>;
	toolCallId?: string;
	name?: string;
	tokenCount?: number;
}

export async function appendMessage(
	dbService: DatabaseService,
	input: AppendMessageInput
): Promise<{ id: string }> {
	const id = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	const now = Date.now();

	await dbService.enqueueWrite(async () => {
		const db = dbService.getDb();
		await db.run(
			`INSERT INTO conversation_history (id, session_id, role, content, tool_calls, tool_call_id, name, token_count, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				input.sessionId,
				input.role,
				input.content,
				input.toolCalls ? JSON.stringify(input.toolCalls) : null,
				input.toolCallId || null,
				input.name || null,
				input.tokenCount || 0,
				now,
			]
		);
	});

	return { id };
}
