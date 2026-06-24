import type { DatabaseService } from "../../database/connection.js";

export async function deleteMemory(
	dbService: DatabaseService,
	id: string,
): Promise<boolean> {
	return dbService.enqueueWrite(async () => {
		const db = dbService.getDb();
		const res = await db.run(`DELETE FROM memories WHERE id = ?`, [id]);
		return (res.changes || 0) > 0;
	});
}
