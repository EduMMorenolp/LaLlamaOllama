import "dotenv/config";
import { validateEnv } from "./env.js";
import { loadConfig } from "./services/config.js";
import { BrainClient } from "./services/brain/client.js";
import { registerAllTools } from "./services/tools/index.js";
import { toolRegistry } from "./services/tools/registry.js";
import { startApiServer } from "./server/api.js";
import { WsServer } from "./server/ws.js";
import { startCronJobs } from "./server/cron.js";
import { getDb } from "./services/db/connection.js";
import { initTelegramDeps, startTelegram } from "./services/telegram/bot.js";
import { logger } from "./utils/logger.js";

async function bootstrap() {
	logger.info("╔══════════════════════════════════════════════╗");
	logger.info("║     Agent Engine - Autonomous Coding Agent   ║");
	logger.info("╚══════════════════════════════════════════════╝");

	// 1. Validate environment
	validateEnv();

	// 2. Load configuration
	const config = loadConfig();
	logger.info(`[Config] Port: ${config.enginePort}`);
	logger.info(`[Config] Backend: ${config.backendUrl}`);
	logger.info(`[Config] Brain: ${config.brainUrl}`);
	logger.info(`[Config] Model: ${config.defaultModel}`);

	// 3. Initialize local SQLite
	try {
		getDb(config.dbPath);
		logger.info(`[DB] SQLite ready at: ${config.dbPath}`);
	} catch (err) {
		logger.warn(`[DB] SQLite init failed: ${err}`);
	}

	// 4. Create BrainClient (core dependency)
	const brain = new BrainClient(config);
	try {
		const stats = await brain.getStats();
		logger.info(`[Brain] Connected. Stats: ${JSON.stringify(stats)}`);
	} catch (err) {
		logger.warn(`[Brain] Initial connection failed: ${err}`);
		logger.warn("[Brain] Will retry on each memory operation");
	}

	// 5. Register all tools (injected with brain dependency)
	registerAllTools(brain);
	logger.info(`[Tools] ${toolRegistry.getToolNames().length} tools registered:`);
	for (const name of toolRegistry.getToolNames()) {
		logger.info(`  - ${name} (${toolRegistry.isEnabled(name) ? "enabled" : "disabled"})`);
	}

	// 6. Initialize Telegram dependencies
	initTelegramDeps(config, brain);

	// 7. Start Telegram bot if token configured
	if (config.telegramBotToken) {
		await startTelegram();
	} else {
		logger.info("[Telegram] No token configured. Skipping.");
	}

	// 8. Start servers
	startApiServer(config);
	const wsServer = new WsServer(config, brain);

	// 9. Background jobs
	startCronJobs(brain);

	// Handle shutdown
	process.on("SIGINT", async () => {
		logger.info("Shutting down...");
		const { stopTelegram } = await import("./services/telegram/bot.js");
		await stopTelegram();
		wsServer.close();
		process.exit(0);
	});

	process.on("SIGTERM", async () => {
		logger.info("Shutting down...");
		const { stopTelegram } = await import("./services/telegram/bot.js");
		await stopTelegram();
		wsServer.close();
		process.exit(0);
	});
}

bootstrap().catch((err) => {
	logger.error(`[Fatal] ${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
});
