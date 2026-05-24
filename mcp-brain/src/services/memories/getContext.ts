import type { DatabaseService } from "../../database/connection.js";
import type { Memory } from "../types.js";

export async function getContext(
	dbService: DatabaseService,
	project: string,
	limit: number = 10,
	includeContent: boolean = false
): Promise<Partial<Memory>[]> {
	const db = dbService.getDb();
	const fields = includeContent
		? "id, project, type, title, content, tags, phase, agent, createdAt, updatedAt"
		: "id, project, type, title, tags, phase, agent, createdAt, updatedAt";
	return await db.all(
		`SELECT ${fields} FROM memories WHERE project = ? ORDER BY createdAt DESC LIMIT ?`,
		[project, limit]
	);
}
