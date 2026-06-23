import type { DatabaseService } from "../../database/connection.js";

interface MemoryStats {
	total: number;
	types: { type: string; count: number }[];
}

export async function getStats(
	dbService: DatabaseService,
	project: string,
): Promise<MemoryStats> {
	const db = dbService.getDb();
	const count = await db.get(
		`SELECT COUNT(*) as total FROM memories WHERE project = ?`,
		[project],
	);
	const types = await db.all(
		`SELECT type, COUNT(*) as count FROM memories WHERE project = ? GROUP BY type`,
		[project],
	);
	return {
		total: count?.total || 0,
		types,
	};
}
