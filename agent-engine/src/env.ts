import "dotenv/config";

export function validateEnv(): void {
	const requiredVariables = ["API_KEY"];
	const missing = requiredVariables.filter((key) => !process.env[key] || process.env[key]!.trim() === "");

	if (missing.length > 0) {
		console.error(`\n\x1b[31m❌ [FATAL] Faltan variables de entorno requeridas en Agent Engine:\x1b[0m`);
		for (const key of missing) {
			console.error(`   \x1b[33m- ${key}\x1b[0m`);
		}
		console.error(
			`\n\x1b[36mPor favor, define estas variables en tu archivo .env o en el docker-compose.yml\x1b[0m\n`
		);
		process.exit(1);
	}
}
