import type { BrainClient } from "../services/brain/client.js";
import { logger } from "../utils/logger.js";
import { resetAllSessions } from "../services/agent/runAgentCore.js";

export function startCronJobs(brain: BrainClient) {
	// Session cleanup every 30 minutes
	setInterval(async () => {
		logger.debug("[Cron] Running periodic cleanup...");
		try {
			resetAllSessions();
		} catch (err) {
			logger.warn(`[Cron] Session cleanup failed: ${err}`);
		}
	}, 30 * 60 * 1000);

	logger.info("[Cron] Background jobs started (30min interval)");
}