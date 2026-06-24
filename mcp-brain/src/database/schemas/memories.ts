import type { Database } from "sqlite";
import type sqlite3 from "sqlite3";

export async function createMemoriesTable(
	db: Database<sqlite3.Database, sqlite3.Statement>,
) {
	await db.exec(`
		CREATE TABLE IF NOT EXISTS memories (
			id TEXT PRIMARY KEY,
			project TEXT NOT NULL,
			type TEXT NOT NULL,
			title TEXT NOT NULL,
			content TEXT NOT NULL,
			tags TEXT,
			sessionId TEXT,
			vector TEXT,
			phase TEXT,
			agent TEXT,
			createdAt INTEGER NOT NULL,
			updatedAt INTEGER NOT NULL,
			FOREIGN KEY (sessionId) REFERENCES sessions (id)
		);

		-- FTS5 table for lexical search
		CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
			id UNINDEXED,
			title,
			content,
			tags,
			phase,
			agent
		);

		-- Triggers to keep FTS in sync
		CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
			INSERT INTO memories_fts(rowid, id, title, content, tags, phase, agent) 
			VALUES (new.rowid, new.id, new.title, new.content, new.tags, new.phase, new.agent);
		END;

		CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
			UPDATE memories_fts SET 
				title = new.title, 
				content = new.content, 
				tags = new.tags,
				phase = new.phase,
				agent = new.agent
			WHERE rowid = new.rowid;
		END;

		CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
			DELETE FROM memories_fts WHERE rowid = old.rowid;
		END;
	`);

	// Safely add topic_key to existing database
	const columns = await db.all("PRAGMA table_info(memories)");
	const hasTopicKey = columns.some(
		(col: { name: string }) => col.name === "topic_key",
	);
	if (!hasTopicKey) {
		await db.exec("ALTER TABLE memories ADD COLUMN topic_key TEXT;");
	}

	// Safely add phase to existing database
	const hasPhase = columns.some(
		(col: { name: string }) => col.name === "phase",
	);
	if (!hasPhase) {
		await db.exec("ALTER TABLE memories ADD COLUMN phase TEXT;");
	}

	// Safely add agent to existing database
	const hasAgent = columns.some(
		(col: { name: string }) => col.name === "agent",
	);
	if (!hasAgent) {
		await db.exec("ALTER TABLE memories ADD COLUMN agent TEXT;");
	}

	// Indexes for performance (bounded candidate queries + type filtering)
	await db.exec(`
		CREATE INDEX IF NOT EXISTS idx_memories_project_created ON memories(project, createdAt);
		CREATE INDEX IF NOT EXISTS idx_memories_project_type ON memories(project, type);
		CREATE INDEX IF NOT EXISTS idx_memories_sessionId ON memories(sessionId);
		CREATE INDEX IF NOT EXISTS idx_memories_topic_key ON memories(topic_key);
	`);
}
