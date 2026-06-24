import type { DatabaseService } from "../database/connection.js";
import { consolidateMemories } from "../services/analysis/consolidation.js";
import logger from "../utils/logger.js";

const log = logger.child({ component: "cron" });

let _cronTimer: NodeJS.Timeout | null = null;

export async function startCronJobs(dbService: DatabaseService) {
	// Simple polling interval to check if consolidation should run.
	// For simplicity without external cron libraries, we check every hour.
	const checkInterval = 60 * 60 * 1000; // 1 hour

	_cronTimer = setInterval(async () => {
		try {
			// In a real multi-project setup, we'd iterate active projects.
			// Here we run for the default project.
			log.agent("Running scheduled memory consolidation...");
			const res = await consolidateMemories(dbService, "lallamaollama");
			if (res.consolidatedGroups > 0) {
				log.agent(
					{ consolidated: res.consolidatedGroups },
					"Consolidation complete",
				);
			}
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			log.error({ message }, "Consolidation error");
		}
	}, checkInterval);
}
