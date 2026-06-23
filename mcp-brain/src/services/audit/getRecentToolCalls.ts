import type { DatabaseService } from "../../database/connection.js";

export interface AuditEntry {
	id: string;
	timestamp: number;
	toolName: string;
	agentIdentity: string;
	argumentsSnapshot: string;
	resultStatus: string;
	resultPreview: string;
	durationMs: number;
	project: string;
}

/**
 * Recupera las últimas N llamadas registradas en el log de auditoría.
 * Si se pasa agentIdentity, filtra solo por ese agente.
 */
export async function getRecentToolCalls(
	dbService: DatabaseService,
	agentIdentity?: string,
	limit: number = 20,
): Promise<AuditEntry[]> {
	const db = dbService.getDb();

	let rows: unknown[];
	if (agentIdentity) {
		rows = await db.all(
			`SELECT * FROM mcp_audit_log WHERE agent_identity = ? ORDER BY timestamp DESC LIMIT ?`,
			[agentIdentity, limit],
		);
	} else {
		rows = await db.all(
			`SELECT * FROM mcp_audit_log ORDER BY timestamp DESC LIMIT ?`,
			[limit],
		);
	}

	return (rows as Array<Record<string, unknown>>).map((r) => ({
		id: r.id as string,
		timestamp: r.timestamp as number,
		toolName: r.tool_name as string,
		agentIdentity: r.agent_identity as string,
		argumentsSnapshot: r.arguments_snapshot as string,
		resultStatus: r.result_status as string,
		resultPreview: r.result_preview as string,
		durationMs: r.duration_ms as number,
		project: r.project as string,
	}));
}
