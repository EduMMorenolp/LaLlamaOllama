import type { Database } from "sqlite";
import type sqlite3 from "sqlite3";

export async function createSessionsTable(
	db: Database<sqlite3.Database, sqlite3.Statement>,
) {
	await db.exec(`
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			project TEXT NOT NULL,
			name TEXT NOT NULL,
			summary TEXT,
			createdAt INTEGER NOT NULL,
			endedAt INTEGER
		);
	`);
}
