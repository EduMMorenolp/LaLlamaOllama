import type { DockerInfo } from "./docker-info.js";

export interface AppConfig {
	enginePort: number;
	backendUrl: string;
	brainUrl: string;
	redisUrl: string;
	apiKey: string;
	defaultModel: string;
	workspaceDir: string;
	dbPath: string;
	telegramBotToken: string;
	telegramAllowedUsers: string[];
	allowedOrigins?: string[];
	/** Docker environment info (detected at startup) */
	dockerInfo?: DockerInfo;
}

export function loadConfig(): AppConfig {
	return {
		enginePort: parseInt(process.env.ENGINE_PORT || "3020", 10),
		backendUrl: process.env.BACKEND_URL || "http://localhost:3016",
		brainUrl: process.env.VITE_BRAIN_URL || process.env.BRAIN_URL || "http://localhost:3015",
		redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
		apiKey: process.env.API_KEY!,
		defaultModel: process.env.DEFAULT_MODEL || "llama3.2:3b",
		workspaceDir: process.env.WORKSPACE_DIR || "/workspace",
		dbPath: process.env.DB_PATH || "./agent-engine.db",
		telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
		telegramAllowedUsers: (process.env.TELEGRAM_ALLOWED_USERS || "").split(",").filter(Boolean),
		allowedOrigins: (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean),
	};
}