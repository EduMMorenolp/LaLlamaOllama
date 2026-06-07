import "dotenv/config";
import { validateEnv } from "./env.js";
import { startApiServer } from "./server/api.js";
import { startCronJobs } from "./server/cron.js";
import { WsServer } from "./server/ws.js";
import { BrainClient } from "./services/brain/client.js";
import { loadConfig } from "./services/config.js";
import { getDb } from "./services/db/connection.js";
import { setSetting } from "./services/db/settings.js";
import { detectDockerInfo } from "./services/docker-info.js";
import { initOrchestrator } from "./services/orchestrator/index.js";
import { setRuntimeContext } from "./services/runtime.js";
import { initTelegramDeps, startTelegram } from "./services/telegram/bot.js";
import { registerAllTools } from "./services/tools/index.js";
import { toolRegistry } from "./services/tools/registry.js";
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

	// 4. Detect Docker environment
	const dockerInfo = await detectDockerInfo(config.workspaceDir);
	logger.info(`[Docker] ${dockerInfo.inDocker ? "Inside container" : "Host machine"}`);
	logger.info(
		`[Docker] CPUs: ${dockerInfo.cpuCores}, RAM: ${(dockerInfo.memoryTotalBytes / 1024 / 1024 / 1024).toFixed(1)} GB${dockerInfo.gpuAvailable ? `, GPU: ${dockerInfo.gpuInfo}` : ""}`
	);
	// Persist Docker info to settings DB
	try {
		setSetting("docker_info", JSON.stringify(dockerInfo));
	} catch {
		// DB might not be available yet
	}
	config.dockerInfo = dockerInfo;

	// 5. Create BrainClient (core dependency)
	const brain = new BrainClient(config);
	setRuntimeContext(config, brain, dockerInfo);
	try {
		const stats = await brain.getStats();
		logger.info(`[Brain] Connected. Stats: ${JSON.stringify(stats)}`);
	} catch (err) {
		logger.warn(`[Brain] Initial connection failed: ${err}`);
		logger.warn("[Brain] Will retry on each memory operation");
	}

	// 6. Initialize orchestrator/queue
	initOrchestrator();

	// 7. Register all tools (injected with brain dependency)
	registerAllTools(brain);
	logger.info(`[Tools] ${toolRegistry.getToolNames().length} tools registered:`);
	for (const name of toolRegistry.getToolNames()) {
		logger.info(`  - ${name} (${toolRegistry.isEnabled(name) ? "enabled" : "disabled"})`);
	}

	// 8. Initialize Telegram dependencies
	initTelegramDeps(config, brain);

	// 9. Start Telegram bot if token configured
	if (config.telegramBotToken) {
		await startTelegram();
	} else {
		logger.info("[Telegram] No token configured. Skipping.");
	}

	// 10. Start servers
	startApiServer(config, brain);
	const wsServer = new WsServer(config, brain);

	// 11. Background jobs
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
