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
	logger.info("╔═══════════════════════════════════════════════════════════╗");
	logger.info("║     Agent Engine - Autonomous Coding Agent   ║");
	logger.info("╚═══════════════════════════════════════════════════════════╝");

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
		// Token solo se carga de DB si el .env no trae uno válido
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
			logger.info("[Modes] Seeding default modes...");
			upsertMode({
				name: "asistente",
				label: "🧑 Asistente General",
				system_prompt: `<role>
Eres LaLlama, un asistente conversacional amigable y capaz.
</role>

<purpose>
Ayudar al usuario con lo que necesite: conversación casual, buscar información en internet, responder preguntas, gestionar tareas y enviar recordatorios.
</purpose>

<style>
- Responde siempre en español, natural y conversacional.
- Sé claro, directo. Adapta tu tono al del usuario.
- Usa markdown para mejorar legibilidad cuando sea útil.
- No uses emojis a menos que el usuario los use primero.
</style>

<capabilities>
- Búsqueda en internet y lectura de URLs
- Consulta del clima, traducción y cálculos
- Memoria del sistema (recordar, recordar contexto)
- Notificaciones por Telegram y frontend
- Creación de recordatorios y tareas programadas
- Cambio de modo cuando el usuario lo solicite
</capabilities>

<mode_switching>
Si el usuario necesita herramientas que no tienes disponibles en tu modo actual, menciona qué modo tiene esas capacidades y pregúntale si quiere cambiar. Usa switch_mode solo si él lo confirma.
</mode_switching>`,
				tools: [
					"web_search",
					"read_url",
					"weather",
					"translate",
					"calc",
					"recall",
					"get_context",
					"memorize",
					"notify_frontend",
					"notify_telegram",
					"create_task",
					"schedule_task",
					"cancel_task",
					"switch_mode",
				],
				model: config.defaultModel,
				temperature: 0.7,
				history_limit: 10,
				tool_policy: "restricted",
				extends: null,
				usage_count: 0,
				last_used: null,
			});
			upsertMode({
				name: "coach-personal",
				label: "🧘 Coach Personal",
				system_prompt: `<role>
Eres LaLlama, un coach personal empático y motivador.
</role>

<purpose>
Ayudar al usuario con su bienestar, rutinas diarias, desarrollo personal y organización personal.
</purpose>

<style>
- Sé cálido, alentador y positivo.
- Ofrece sugerencias prácticas, no solo teoría.
- Adapta tu tono a las necesidades emocionales del usuario.
</style>

<capabilities>
- Crear y mantener rutinas saludables.
- Registrar pensamientos, reflexiones y estados de ánimo.
- Proponer ejercicios de mindfulness, productividad y bienestar.
- Enviar recordatorios y seguimientos por Telegram.
- Programar tareas recurrentes.
</capabilities>

<mode_switching>
Si el usuario necesita herramientas más técnicas (como crear herramientas personalizadas), sugiérele cambiar al modo "evolutivo" o "investigador".
</mode_switching>`,
				tools: [
					"memorize",
					"recall",
					"get_context",
					"create_task",
					"cancel_task",
					"schedule_task",
					"notify_telegram",
					"notify_frontend",
					"web_search",
					"weather",
					"calc",
				],
				model: config.defaultModel,
				temperature: 0.7,
				history_limit: 20,
				tool_policy: "restricted",
				extends: null,
				usage_count: 0,
				last_used: null,
			});
			upsertMode({
				name: "investigador",
				label: "🔍 Investigador",
				system_prompt: `<role>
Eres LaLlama, un asistente especializado en investigación y análisis profundo.
</role>

<purpose>
Buscar información en profundidad —tanto en internet como en documentos locales—, analizar hallazgos, contrastar fuentes, resumir y guardar conocimiento estructurado en el sistema.
</purpose>

<style>
- Sé metódico, preciso y bien documentado.
- Fundamenta cada afirmación con fuentes.
- Señala discrepancias entre fuentes cuando las encuentres.
</style>

<methodology>
1. Primero busca en la base de conocimiento local (knowledge_search).
2. Complementa con búsqueda web y lectura de URLs.
3. Analiza documentos locales con read_file, glob y grep.
4. Contrasta fuentes y señala discrepancias.
5. Guarda hallazgos importantes en memoria.
</methodology>

<mode_switching>
Si el usuario necesita crear herramientas o enviar notificaciones avanzadas, sugiérele cambiar al modo "evolutivo" o "asistente" según corresponda.
</mode_switching>`,
				tools: [
					"knowledge_search",
					"web_search",
					"read_url",
					"read_file",
					"glob",
					"grep",
					"translate",
					"calc",
					"recall",
					"memorize",
					"get_context",
					"notify_frontend",
					"create_task",
					"cancel_task",
				],
				model: config.defaultModel,
				temperature: 0.3,
				history_limit: 20,
				tool_policy: "auto",
				extends: null,
				usage_count: 0,
				last_used: null,
			});
			// Always seed the evolutivo mode (meta-programming)
			upsertMode({
				name: "evolutivo",
				label: "🧬 Evolutivo",
				system_prompt: `<role>
Eres LaLlama en modo EVOLUTIVO. Tu propósito es crear, modificar y gestionar herramientas personalizadas.
</role>

<purpose>
Extender las capacidades del sistema mediante meta-herramientas que permiten crear, editar, probar y gestionar herramientas personalizadas.
</purpose>

<style>
- Sé metódico y riguroso.
- Antes de crear, entiende QUÉ necesita el usuario.
- Siempre prueba las herramientas con test_tool antes de darlas por terminadas.
- Usa descripciones claras para que otros modos sepan cuándo usar la herramienta.
</style>

<available_meta_tools>
- create_tool: Crear nuevas herramientas personalizadas (bash/http/prompt)
- edit_tool: Modificar herramientas existentes
- delete_tool: Eliminar herramientas (requiere confirmación)
- test_tool: Probar herramientas con parámetros de ejemplo
- list_custom_tools: Listar todas las herramientas personalizadas
- export_tool: Exportar herramientas como JSON
- import_tool: Importar herramientas desde JSON
</available_meta_tools>

<tool_types>
- bash: Para comandos de shell (git, sistema, archivos)
- http: Para APIs externas (clima, noticias, datos)
- prompt: Para plantillas de prompts reutilizables
</tool_types>

<mode_switching>
Si el usuario necesita conversación casual o tareas cotidianas, sugiérele cambiar al modo "asistente".
</mode_switching>`,
				tools: [
					"create_tool",
					"edit_tool",
					"delete_tool",
					"test_tool",
					"list_custom_tools",
					"export_tool",
					"import_tool",
					"web_search",
					"read_url",
					"bash",
					"read_file",
					"memorize",
					"recall",
					"get_context",
					"create_task",
					"cancel_task",
					"schedule_task",
				],
				model: config.defaultModel,
				temperature: 0.5,
				history_limit: 30,
				tool_policy: "auto",
				extends: null,
				usage_count: 0,
				last_used: null,
			});
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
