import type { DatabaseService } from "../../database/connection.js";

export async function deleteSession(
	dbService: DatabaseService,
	sessionId: string
): Promise<boolean> {
	const db = dbService.getDb();
	const result = await db.run(
		`DELETE FROM conversation_history WHERE session_id = ?`,
		[sessionId]
	);
	return (result.changes ?? 0) > 0;
}
