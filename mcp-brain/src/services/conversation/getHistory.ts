import type { DatabaseService } from "../../database/connection.js";

export interface ConversationMessage {
	id: string;
	sessionId: string;
	role: string;
	content: string | null;
	toolCalls: Array<Record<string, unknown>> | null;
	toolCallId: string | null;
	name: string | null;
	tokenCount: number;
	createdAt: number;
}

export async function getHistory(
	dbService: DatabaseService,
	sessionId: string,
	limit: number = 50,
	offset: number = 0
): Promise<{ messages: ConversationMessage[]; total: number }> {
	const db = dbService.getDb();

	const totalRow = await db.get<{ count: number }>(
		`SELECT COUNT(*) as count FROM conversation_history WHERE session_id = ?`,
		[sessionId]
	);
	const total = totalRow?.count || 0;

	const rows = await db.all<Array<Record<string, unknown>>>(
		`SELECT id, session_id as sessionId, role, content, tool_calls as toolCalls,
		        tool_call_id as toolCallId, name, token_count as tokenCount, created_at as createdAt
		 FROM conversation_history
		 WHERE session_id = ?
		 ORDER BY created_at ASC
		 LIMIT ? OFFSET ?`,
		[sessionId, limit, offset]
	);

	const messages: ConversationMessage[] = rows.map((r) => ({
		id: r.id as string,
		sessionId: r.sessionId as string,
		role: r.role as string,
		content: r.content as string | null,
		toolCalls: r.toolCalls ? (JSON.parse(r.toolCalls as string) as Array<Record<string, unknown>>) : null,
		toolCallId: (r.toolCallId as string) || null,
		name: (r.name as string) || null,
		tokenCount: (r.tokenCount as number) || 0,
		createdAt: r.createdAt as number,
	}));

	return { messages, total };
}
