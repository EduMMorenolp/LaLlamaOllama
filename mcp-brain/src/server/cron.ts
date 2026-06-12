import type { DatabaseService } from "../database/connection.js";
import { consolidateMemories } from "../services/analysis/consolidation.js";

let _cronTimer: NodeJS.Timeout | null = null;

export async function startCronJobs(dbService: DatabaseService) {
	// Simple polling interval to check if consolidation should run.
	// For simplicity without external cron libraries, we check every hour.
	const checkInterval = 60 * 60 * 1000; // 1 hour

	_cronTimer = setInterval(async () => {
		try {
			// In a real multi-project setup, we'd iterate active projects.
			// Here we run for the default project.
			console.error("[Cron] Running scheduled memory consolidation...");
			const res = await consolidateMemories(dbService, "lallamaollama");
			if (res.consolidatedGroups > 0) {
				console.error(`[Cron] Consolidated ${res.consolidatedGroups} topic groups.`);
			}
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			console.error("[Cron] Error running consolidation:", message);
		}
	}, checkInterval);
}
