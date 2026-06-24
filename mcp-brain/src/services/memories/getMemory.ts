import type { DatabaseService } from "../../database/connection.js";
import type { Memory } from "../types.js";

export async function getMemory(
	dbService: DatabaseService,
	id: string,
): Promise<Memory | undefined> {
	const db = dbService.getDb();
	const row = await db.get(
		`SELECT id, project, type, title, content, tags, phase, agent, createdAt, updatedAt FROM memories WHERE id = ?`,
		[id],
	);
	return row as Memory | undefined;
}
