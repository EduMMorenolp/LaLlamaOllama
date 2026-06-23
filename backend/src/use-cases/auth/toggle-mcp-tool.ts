import type { AuthService } from "../../auth/auth.service.js";

export class ToggleMcpToolUseCase {
	constructor(
		private readonly authService: AuthService,
		private readonly toolNames: readonly { name: string }[],
	) {}

	execute(name: string, enabled: boolean) {
		const knownTool = [...this.toolNames].some((tool) => tool.name === name);
		if (!knownTool) {
			return { found: false as const };
		}
		const updated = this.authService.setMcpToolEnabled(name, enabled);
		if (!updated) {
			return { found: false as const };
		}
		return {
			found: true as const,
			mcpTools: this.authService.getMcpToolPermissions(),
		};
	}
}
