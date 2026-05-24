import type { DatabaseService } from "../../database/connection.js";

/** Keys que contienen datos sensibles y deben ser redactados en el log */
const SENSITIVE_KEYS = ["apikey", "api_key", "key", "secret", "token", "password", "auth", "credential"];

/**
 * Sanitiza argumentos para el log: redacta valores sensibles y trunca strings largos.
 * Limita a 10 campos para evitar sobrecarga en el log.
 */
function sanitizeArgs(args: Record<string, unknown> | undefined): Record<string, string> {
	if (!args) return {};
	const sanitized: Record<string, string> = {};
	for (const [k, v] of Object.entries(args)) {
		const isSensitive = SENSITIVE_KEYS.some((sk) => k.toLowerCase().includes(sk));
		if (isSensitive) {
			sanitized[k] = "[REDACTED]";
		} else if (typeof v === "string" && v.length > 200) {
			sanitized[k] = v.substring(0, 200) + "...";
		} else {
			sanitized[k] = typeof v === "string" ? v : JSON.stringify(v);
		}
	}
	// Limitar a las primeras 10 entradas
	return Object.fromEntries(Object.entries(sanitized).slice(0, 10));
}

export interface LogToolCallParams {
	toolName: string;
	agentIdentity: string;
	args: Record<string, unknown> | undefined;
	resultStatus: "success" | "error";
	resultPreview: string;
	durationMs: number;
	project: string;
}

/**
 * Registra una llamada a herramienta MCP en el log de auditoría persistente (SQLite).
 * Esta función es el núcleo de la Capa 1 (Auditoría Transparente).
 * Se llama automáticamente desde el wrapper en mcp.ts — el agente NO puede evitarlo.
 */
export async function logToolCall(dbService: DatabaseService, params: LogToolCallParams): Promise<void> {
	const db = dbService.getDb();
	const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	const now = Date.now();
	const sanitizedArgs = sanitizeArgs(params.args);

	await dbService.enqueueWrite(async () => {
		await db.run(
			`INSERT INTO mcp_audit_log (id, timestamp, tool_name, agent_identity, arguments_snapshot, result_status, result_preview, duration_ms, project)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				now,
				params.toolName,
				params.agentIdentity,
				JSON.stringify(sanitizedArgs).substring(0, 500),
				params.resultStatus,
				params.resultPreview.substring(0, 200),
				params.durationMs,
				params.project || "unknown",
			]
		);
	});
}
