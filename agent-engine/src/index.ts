import "dotenv/config";
import { validateEnv } from "./env.js";
import { loadConfig } from "./services/config.js";
import { BrainClient } from "./services/brain/client.js";
import { registerAllTools } from "./services/tools/index.js";
import { toolRegistry } from "./services/tools/registry.js";
import { startApiServer } from "./server/api.js";
import { WsServer } from "./server/ws.js";
import { startCronJobs } from "./server/cron.js";
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

	// 3. Create BrainClient (core dependency, like DatabaseService in mcp-brain)
	const brain = new BrainClient(config);
	try {
		const stats = await brain.getStats();
		logger.info(`[Brain] Connected. Stats: ${JSON.stringify(stats)}`);
	} catch (err) {
		logger.warn(`[Brain] Initial connection failed: ${err}`);
		logger.warn("[Brain] Will retry on each memory operation");
	}

	// 4. Register all tools (injected with brain dependency)
	registerAllTools(brain);
	logger.info(`[Tools] ${toolRegistry.getToolNames().length} tools registered:`);
	for (const name of toolRegistry.getToolNames()) {
		logger.info(`  - ${name} (${toolRegistry.isEnabled(name) ? "enabled" : "disabled"})`);
	}

	// 5. Start servers (injected with dependencies)

	// REST API (non-blocking)
	startApiServer(config);

	// WebSocket server (non-blocking)
	const wsServer = new WsServer(config, brain);

	// Background jobs
	startCronJobs(brain);

	// Handle shutdown
	process.on("SIGINT", () => {
		logger.info("Shutting down...");
		wsServer.close();
		process.exit(0);
	});

	process.on("SIGTERM", () => {
		logger.info("Shutting down...");
		wsServer.close();
		process.exit(0);
	});
}

bootstrap().catch((err) => {
	logger.error(`[Fatal] ${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
});
