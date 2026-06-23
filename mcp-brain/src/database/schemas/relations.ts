import type { Database } from "sqlite";
import type sqlite3 from "sqlite3";

export async function createRelationsTable(
	db: Database<sqlite3.Database, sqlite3.Statement>,
) {
	await db.exec(`
		CREATE TABLE IF NOT EXISTS relations (
			id TEXT PRIMARY KEY,
			sourceId TEXT NOT NULL,
			targetId TEXT NOT NULL,
			relation TEXT NOT NULL,
			reason TEXT,
			createdAt INTEGER NOT NULL,
			FOREIGN KEY (sourceId) REFERENCES memories (id),
			FOREIGN KEY (targetId) REFERENCES memories (id)
		);
	`);
}
