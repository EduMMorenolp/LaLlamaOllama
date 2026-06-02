import type { BrainClient } from "../services/brain/client.js";
import { logger } from "../utils/logger.js";

export function startCronJobs(brain: BrainClient) {
	// Session cleanup every 30 minutes
	setInterval(async () => {
		logger.debug("[Cron] Running periodic cleanup...");
		try {
			await brain.getStats();
		} catch (err) {
			logger.warn(`[Cron] Brain health check failed: ${err}`);
		}
	}, 30 * 60 * 1000);

	logger.info("[Cron] Background jobs started (30min interval)");
}
