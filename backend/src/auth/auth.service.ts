export class AuthService {
	private readonly apiKey: string;
	private ollamaAuthEnabled = true;
	private mcpAuthEnabled = true;
	private readonly mcpToolPermissions: Map<string, boolean> = new Map();

	constructor() {
		const key = process.env.API_KEY;
		if (!key || key.trim() === "") {
			console.error(
				"\n[FATAL] API_KEY environment variable is required and cannot be empty.",
			);
			console.error(
				"Set API_KEY in your .env file or docker-compose.yml environment section.\n",
			);
			process.exit(1);
		}
		this.apiKey = key;
	}

	validate(key: string | undefined): boolean {
		if (!key) return false;
		return key === this.apiKey;
	}

	isOllamaAuthEnabled(): boolean {
		return this.ollamaAuthEnabled;
	}

	isMcpAuthEnabled(): boolean {
		return this.mcpAuthEnabled;
	}

	setOllamaAuthEnabled(enabled: boolean): void {
		this.ollamaAuthEnabled = enabled;
	}

	setMcpAuthEnabled(enabled: boolean): void {
		this.mcpAuthEnabled = enabled;
	}

	setKnownMcpTools(toolNames: string[]): void {
		for (const toolName of toolNames) {
			if (!this.mcpToolPermissions.has(toolName)) {
				this.mcpToolPermissions.set(toolName, true);
			}
		}

		for (const existingTool of Array.from(this.mcpToolPermissions.keys())) {
			if (!toolNames.includes(existingTool)) {
				this.mcpToolPermissions.delete(existingTool);
			}
		}
	}

	isMcpToolEnabled(toolName: string): boolean {
		return this.mcpToolPermissions.get(toolName) ?? false;
	}

	setMcpToolEnabled(toolName: string, enabled: boolean): boolean {
		if (!this.mcpToolPermissions.has(toolName)) return false;
		this.mcpToolPermissions.set(toolName, enabled);
		return true;
	}

	getMcpToolPermissions(): Array<{ name: string; enabled: boolean }> {
		return Array.from(this.mcpToolPermissions.entries()).map(
			([name, enabled]) => ({ name, enabled }),
		);
	}

	getSettings() {
		return {
			ollamaAuthEnabled: this.ollamaAuthEnabled,
			mcpAuthEnabled: this.mcpAuthEnabled,
			mcpTools: this.getMcpToolPermissions(),
		};
	}

	getApiKey(): string {
		return this.apiKey;
	}
}
