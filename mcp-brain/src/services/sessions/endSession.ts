import type { DatabaseService } from "../../database/connection.js";

export async function endSession(dbService: DatabaseService, sessionId: string, summary: string): Promise<boolean> {
    return dbService.enqueueWrite(async () => {
        const db = dbService.getDb();
        const now = Date.now();
        const res = await db.run(`UPDATE sessions SET summary = ?, endedAt = ? WHERE id = ?`, [
            summary,
            now,
            sessionId,
        ]);
        return (res.changes || 0) > 0;
    });
}
