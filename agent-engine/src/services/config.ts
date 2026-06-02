export interface AppConfig {
	enginePort: number;
	backendUrl: string;
	brainUrl: string;
	apiKey: string;
	defaultModel: string;
	workspaceDir: string;
}

export function loadConfig(): AppConfig {
	return {
		enginePort: parseInt(process.env.ENGINE_PORT || "3020", 10),
		backendUrl: process.env.BACKEND_URL || "http://localhost:3016",
		brainUrl: process.env.BRAIN_URL || "http://localhost:3015",
		apiKey: process.env.API_KEY!,
		defaultModel: process.env.DEFAULT_MODEL || "llama3.2:3b",
		workspaceDir: process.env.WORKSPACE_DIR || "/workspace",
	};
}
