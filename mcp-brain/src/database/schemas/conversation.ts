import type { Database } from "sqlite";
import type sqlite3 from "sqlite3";

export async function createConversationTable(db: Database<sqlite3.Database, sqlite3.Statement>) {
	await db.exec(`
		CREATE TABLE IF NOT EXISTS conversation_history (
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL,
			role TEXT NOT NULL CHECK(role IN ('system','user','assistant','tool')),
			content TEXT,
			tool_calls TEXT,
			tool_call_id TEXT,
			name TEXT,
			token_count INTEGER DEFAULT 0,
			created_at INTEGER NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_conversation_session_id ON conversation_history(session_id, created_at);
	`);
}
