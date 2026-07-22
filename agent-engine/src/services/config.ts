import type { DockerInfo } from "./docker-info.js";

export interface AppConfig {
	enginePort: number;
	backendUrl: string;
	brainUrl: string;
	redisUrl: string;
	ollamaUrl: string;
	apiKey: string;
	defaultModel: string;
	llmTimeout: number;
	workspaceDir: string;
	dbPath: string;
	brainProject: string;
	telegramBotToken: string;
	telegramAllowedUsers: string[];
	allowedOrigins?: string[];
	/** Google OAuth config */
	googleClientId: string;
	googleClientSecret: string;
	googleRedirectUri: string;
	googleEncryptionKey: string;
	/** Docker environment info (detected at startup) */
	dockerInfo?: DockerInfo;
}

export function loadConfig(): AppConfig {
	return {
		enginePort: parseInt(process.env.ENGINE_PORT || "3020", 10),
		backendUrl: process.env.BACKEND_URL || "http://localhost:3016",
		brainUrl: process.env.BRAIN_URL || "http://localhost:3015",
		redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
		ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
		apiKey: process.env.API_KEY!,
		defaultModel: process.env.DEFAULT_MODEL || "llama3.2:3b",
		llmTimeout: parseInt(process.env.LLM_TIMEOUT || "600000", 10),
		workspaceDir: process.env.WORKSPACE_DIR || "/workspace",
		dbPath: process.env.DB_PATH || "./agent-engine.db",
		brainProject: process.env.BRAIN_PROJECT || "AgenteLaLlamaOllama",
		telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
		telegramAllowedUsers: (process.env.TELEGRAM_ALLOWED_USERS || "").split(",").filter(Boolean),
		allowedOrigins: (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean),
		googleClientId: process.env.GOOGLE_CLIENT_ID || "",
		googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
		googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:3020/api/google/callback",
		googleEncryptionKey: process.env.GOOGLE_ENCRYPTION_KEY || "",
	};
}
