import type { DatabaseService } from "../../database/connection.js";

export async function startSession(
	dbService: DatabaseService,
	project: string,
	name: string,
): Promise<string> {
	const db = dbService.getDb();
	const id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	const now = Date.now();
	await dbService.enqueueWrite(async () => {
		await db.run(
			`INSERT INTO sessions (id, project, name, createdAt) VALUES (?, ?, ?, ?)`,
			[id, project, name, now],
		);
	});
	return id;
}
