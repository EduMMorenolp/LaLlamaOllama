import "dotenv/config";

export interface EnvConfig {
	enginePort: number;
	backendUrl: string;
	brainUrl: string;
	apiKey: string;
	defaultModel: string;
	workspaceDir: string;
	webSearchApiKey?: string;
	webSearchEngine?: string;
}

export function loadEnv(): EnvConfig {
	const requiredVars = ["API_KEY"];
	const missing = requiredVars.filter((key) => !process.env[key] || process.env[key]!.trim() === "");

	if (missing.length > 0) {
		console.error(`❌ [FATAL] Missing required env vars: ${missing.join(", ")}`);
		process.exit(1);
	}

	return {
		enginePort: parseInt(process.env.ENGINE_PORT || "3020", 10),
		backendUrl: process.env.BACKEND_URL || "http://localhost:3016",
		brainUrl: process.env.BRAIN_URL || "http://localhost:3015",
		apiKey: process.env.API_KEY!,
		defaultModel: process.env.DEFAULT_MODEL || "llama3.2:3b",
		workspaceDir: process.env.WORKSPACE_DIR || "/workspace",
		webSearchApiKey: process.env.WEB_SEARCH_API_KEY,
		webSearchEngine: process.env.WEB_SEARCH_ENGINE || "google",
	};
}
