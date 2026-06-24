export const validateEnv = () => {
	const cyan = "\x1b[36m";
	const yellow = "\x1b[33m";
	const red = "\x1b[31m";
	const reset = "\x1b[0m";

	const requiredVariables: string[] = [];
	const missing = requiredVariables.filter(
		(key) => !process.env[key] || process.env[key].trim() === "",
	);

	if (missing.length > 0) {
		console.error(
			`\n${red}❌ [FATAL] Faltan variables de entorno requeridas en el Cerebro:${reset}`,
		);
		missing.forEach((key) => {
			console.error(`   ${yellow}- ${key}${reset}`);
		});
		console.error(
			`\n${cyan}Por favor, define estas variables en tu archivo .env o en el docker-compose.yml${reset}\n`,
		);
		process.exit(1);
	}
};
