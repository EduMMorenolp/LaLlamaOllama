import "dotenv/config";
import { validateEnv } from "./env.js";
import { startApiServer } from "./server/api.js";
import { startCronJobs } from "./server/cron.js";
import { WsServer } from "./server/ws.js";
import { BrainClient } from "./services/brain/client.js";
import { loadConfig } from "./services/config.js";
import { getDb } from "./services/db/connection.js";
import { getSetting, setSetting } from "./services/db/settings.js";
import { detectDockerInfo } from "./services/docker-info.js";
import { initOrchestrator } from "./services/orchestrator/index.js";
import { setRuntimeContext } from "./services/runtime.js";
import { initTelegramDeps, startTelegram } from "./services/telegram/bot.js";
import { registerAllTools, setWsServer } from "./services/tools/index.js";
import { toolRegistry } from "./services/tools/registry.js";
import { logger } from "./utils/logger.js";

async function bootstrap() {
	logger.info("+-----------------------------------------------------------+");
	logger.info("     Agent Engine - Autonomous Coding Agent   ");
	logger.info("+-----------------------------------------------------------+");

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

	// 8. Load Telegram config from DB (persists frontend settings across restarts)
	try {
		// Token solo se carga de DB si el .env no trae uno valido
		if (!config.telegramBotToken || config.telegramBotToken === "123456:ABCDEF") {
			const savedToken = getSetting("telegram_bot_token");
			if (savedToken) {
				config.telegramBotToken = savedToken;
				logger.info("[Telegram] Token loaded from DB (overrides .env)");
			}
		}
		// AllowedUsers SIEMPRE se carga de DB para persistir cambios del frontend
		const savedUsers = getSetting("telegram_allowed_users");
		if (savedUsers) {
			try {
				config.telegramAllowedUsers = JSON.parse(savedUsers);
			} catch {
				config.telegramAllowedUsers = savedUsers.split(",").filter(Boolean);
			}
			logger.info(`[Telegram] AllowedUsers loaded from DB: [${config.telegramAllowedUsers.join(", ")}]`);
		}
	} catch {
		logger.warn("[Telegram] Could not load config from DB");
	}

	// 9. Start servers
	const wsServer = new WsServer(config, brain);
	startApiServer(config, brain, wsServer);

	// Set wsServer reference for tools that need it (e.g., notify_frontend)
	setWsServer(wsServer);

	// 10. Initialize Telegram dependencies
	initTelegramDeps(config, brain, wsServer);

	// 11. Start Telegram bot if token configured
	if (config.telegramBotToken) {
		await startTelegram();
	} else {
		logger.info("[Telegram] No token configured. Skipping.");
	}

	// 12. Seed default modes and apply active mode
	try {
		const { listModes, upsertMode, getActiveMode, setActiveMode } = await import("./services/db/modes.js");
		const existing = listModes();
		if (existing.length === 0) {
			logger.info("[Modes] Seeding default modes from prompt modules...");
			const { getModeSeedData } = await import("./services/prompts/index.js");
			const modeNames = [
				"asistente",
				"coach-personal",
				"investigador",
				"evolutivo",
				"planificador",
				"tutor-educador",
				"escritor-creativo",
				"aprendizaje",
			];
			const labels: Record<string, string> = {
				asistente: "?? Asistente General",
				"coach-personal": "?? Coach Personal",
				investigador: "?? Investigador",
				evolutivo: "?? Evolutivo",
				planificador: "?? Planificador",
				"tutor-educador": "?? Tutor / Educador",
				"escritor-creativo": "?? Escritor / Creativo",
				aprendizaje: "?? Aprendizaje",
			};
			for (const name of modeNames) {
				const data = getModeSeedData(name);
				if (data) {
					upsertMode({
						name,
						label: labels[name],
						...data,
						model: data.model || config.defaultModel,
						usage_count: 0,
						last_used: null,
					});
					logger.info(`[Modes] Seeded mode: ${name}`);
				}
			}
		}

		// Load custom tools from DB into the runtime registry
		try {
			const { listCustomTools } = await import("./services/db/custom-tools.js");
			const { executeCustomTool } = await import("./services/tools/custom-tool-handler.js");
			const customTools = listCustomTools();
			for (const ct of customTools) {
				const handlerConfig = JSON.parse(ct.handler_config || "{}");
				const params = JSON.parse(ct.parameters || "{}");
				toolRegistry.registerCustomTool(ct.name, {
					spec: {
						type: "function",
						function: {
							name: ct.name,
							description: ct.description,
							parameters: params,
						},
					},
					handler: async (args, ctx) => {
						return executeCustomTool(ct.handler_type, handlerConfig, args, ctx);
					},
					enabled: true,
				});
			}
			if (customTools.length > 0) {
				logger.info(`[CustomTools] Loaded ${customTools.length} custom tool(s) from DB`);
			}
		} catch (err) {
			logger.warn(`[CustomTools] Could not load from DB: ${err}`);
		}

		// Apply active mode's tools
		const activeMode = getActiveMode();
		logger.info(`[Modes] Active mode: "${activeMode.name}" (${activeMode.tools.length} tools)`);
		await toolRegistry.applyModeTools(activeMode.tools);
	} catch (err) {
		logger.warn(`[Modes] Could not initialize: ${err instanceof Error ? err.message : String(err)}`);
	}
	// 14. Warm-up: preload model to avoid cold start latency on first user request
	try {
		const { default: OpenAI } = await import("openai");
		const { getActiveMode } = await import("./services/db/modes.js");
		const warmupClient = new OpenAI({ baseURL: `${config.backendUrl}/v1`, apiKey: config.apiKey });
		const mode = getActiveMode();
		const warmModel = mode?.model || config.defaultModel;
		logger.info(`[Warmup] Pre-loading model '${warmModel}'...`);
		await warmupClient.chat.completions.create({
			model: warmModel,
			messages: [{ role: "user", content: "Responde con una palabra: lista" }],
			max_tokens: 10,
			temperature: 0.1,
		});
		logger.info(`[Warmup] Model '${warmModel}' loaded successfully`);
	} catch (err) {
		logger.warn(`[Warmup] Could not pre-load model: ${err instanceof Error ? err.message : String(err)}`);
	}


	// 13. Background jobs
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
