import type { Database } from "sqlite";
import type sqlite3 from "sqlite3";

export async function createAuditTable(
	db: Database<sqlite3.Database, sqlite3.Statement>,
) {
	await db.exec(`
		CREATE TABLE IF NOT EXISTS mcp_audit_log (
			id TEXT PRIMARY KEY,
			timestamp INTEGER NOT NULL,
			tool_name TEXT NOT NULL,
			agent_identity TEXT DEFAULT '',
			arguments_snapshot TEXT DEFAULT '{}',
			result_status TEXT DEFAULT 'success',
			result_preview TEXT DEFAULT '',
			duration_ms INTEGER DEFAULT 0,
			project TEXT DEFAULT ''
		);

		CREATE INDEX IF NOT EXISTS idx_audit_agent ON mcp_audit_log(agent_identity);
		CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON mcp_audit_log(timestamp);
		CREATE INDEX IF NOT EXISTS idx_audit_tool ON mcp_audit_log(tool_name);
		CREATE INDEX IF NOT EXISTS idx_audit_project ON mcp_audit_log(project);
	`);
}
