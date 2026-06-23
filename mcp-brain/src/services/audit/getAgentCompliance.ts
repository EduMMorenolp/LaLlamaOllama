import type { DatabaseService } from "../../database/connection.js";

export interface AgentCompliance {
	agentIdentity: string;
	lastSaveTimestamp: number | null;
	lastSaveSummary: string;
	totalSaves: number;
	totalCalls: number;
	complianceScore: number; // 0â€“100
	complianceScore: number; // 0â€“100
	needsReminder: boolean;
	hoursSinceLastSave: number | null;
}

/**
 * Obtiene el estado de compliance de un agente: cuÃ¡nto ha llamado a mem_save
 * en relaciÃ³n con el total de llamadas que ha hecho.
 * Obtiene el estado de compliance de un agente: cuÃ¡nto ha llamado a mem_save
 * en relaciÃ³n con el total de llamadas que ha hecho.
 *
 * Se usa para:
 *   - Compliance Reminder (Capa 3): mostrar advertencia en tools de solo lectura
 *   - mem_my_compliance (Capa 5): el agente se auto-audita
 */
export async function getAgentCompliance(
	dbService: DatabaseService,
	agentIdentity: string,
	lookbackHours: number = 24,
): Promise<AgentCompliance> {
	const db = dbService.getDb();
	const now = Date.now();
	const lookbackMs = lookbackHours * 60 * 60 * 1000;
	const cutoff = now - lookbackMs;

	// Total de llamadas del agente en el perÃ­odo
	// Total de llamadas del agente en el perÃ­odo
	const totalCallsResult = await db.get(
		`SELECT COUNT(*) as count FROM mcp_audit_log WHERE agent_identity = ? AND timestamp > ?`,
		[agentIdentity, cutoff],
	);
	const totalCalls = totalCallsResult?.count || 0;

	// Total de saves (mem_save) del agente en el perÃ­odo
	// Total de saves (mem_save) del agente en el perÃ­odo
	const totalSavesResult = await db.get(
		`SELECT COUNT(*) as count FROM mcp_audit_log WHERE agent_identity = ? AND tool_name = 'mem_save' AND timestamp > ?`,
		[agentIdentity, cutoff],
	);
	const totalSaves = totalSavesResult?.count || 0;

	// Ãšltimo save
	// Ãšltimo save
	const lastSaveResult = await db.get(
		`SELECT timestamp, result_preview FROM mcp_audit_log WHERE agent_identity = ? AND tool_name = 'mem_save' ORDER BY timestamp DESC LIMIT 1`,
		[agentIdentity],
	);
	const lastSaveTimestamp = lastSaveResult?.timestamp || null;
	const lastSaveSummary = lastSaveResult?.result_preview || "";

	// Score = quÃ© porcentaje de las llamadas fueron mem_save
	// Score = quÃ© porcentaje de las llamadas fueron mem_save
	const complianceScore =
		totalCalls > 0
			? Math.min(100, Math.round((totalSaves / totalCalls) * 100))
			: 0;

	const hoursSinceLastSave =
		lastSaveTimestamp !== null
			? Math.round(((now - lastSaveTimestamp) / (60 * 60 * 1000)) * 10) / 10
			: null;

	// Necesita recordatorio si nunca ha hecho save o si pasÃ³ mÃ¡s de lookbackHours
	const needsReminder =
		lastSaveTimestamp === null || (hoursSinceLastSave ?? 0) > lookbackHours;

	return {
		agentIdentity,
		lastSaveTimestamp,
		lastSaveSummary,
		totalSaves,
		totalCalls,
		complianceScore,
		needsReminder,
		hoursSinceLastSave,
	};
}


