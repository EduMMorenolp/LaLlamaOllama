import type { DatabaseService } from "../../database/connection.js";
import type { Memory } from "../types.js";

export async function getTimeline(
	dbService: DatabaseService,
	project: string,
	limit: number = 20,
	type?: string
): Promise<Memory[]> {
	const db = dbService.getDb();
	let query: string;
	let params: unknown[];
	if (type) {
		query = `SELECT id, project, type, title, content, tags, phase, agent, createdAt, updatedAt 
                 FROM memories WHERE project = ? AND type = ? ORDER BY createdAt ASC LIMIT ?`;
		params = [project, type, limit];
	} else {
		query = `SELECT id, project, type, title, content, tags, phase, agent, createdAt, updatedAt 
                 FROM memories WHERE project = ? ORDER BY createdAt ASC LIMIT ?`;
		params = [project, limit];
	}
	const rows = await db.all(query, params);
	return rows as Memory[];
}
