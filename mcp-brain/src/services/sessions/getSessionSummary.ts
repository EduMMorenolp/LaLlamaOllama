import type { DatabaseService } from "../../database/connection.js";

interface SessionSummaryResult {
	session?: unknown;
	memories_count?: number;
	memories?: unknown[];
	error?: string;
}

export async function getSessionSummary(
	dbService: DatabaseService,
	sessionId: string,
): Promise<SessionSummaryResult> {
	const db = dbService.getDb();
	const session = await db.get(`SELECT * FROM sessions WHERE id = ?`, [
		sessionId,
	]);
	if (!session) return { error: "Session not found" };
	const memories = await db.all(`SELECT * FROM memories WHERE sessionId = ?`, [
		sessionId,
	]);
	return { session, memories_count: memories.length, memories };
}
