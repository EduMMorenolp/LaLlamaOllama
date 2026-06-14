import "dotenv/config";
import { DatabaseService } from "./database/connection.js";
import { validateEnv } from "./env.js";
import { startApiServer } from "./server/api.js";
import { startCronJobs } from "./server/cron.js";
import { startMcpServer } from "./server/mcp.js";
import { settings } from "./services/index.js";
import logger from "./utils/logger.js";

const log = logger.child({ component: "bootstrap" });

async function bootstrap() {
	// 1. Validar Entorno
	validateEnv();

	// 2. Iniciar Base de Datos
	const dbService = new DatabaseService();
	await dbService.initialize();

	// 3. Cargar directivas centrales (se inyectan en SSE + Stdio)
	let directives: string | undefined;
	try {
		directives = await settings.getCoreDirectives(dbService, "lallamaollama");
	} catch (err) {
		log.warn({ err }, "Could not load core directives");
	}

	// 4. Iniciar Servidores
	await startMcpServer(dbService, directives);
	startApiServer(dbService, directives);
	startCronJobs(dbService);
}

bootstrap().catch((err) => {
	log.error({ err }, "Fatal bootstrap error");
	process.exit(1);
});
