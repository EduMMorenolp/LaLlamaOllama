import type { AuthService } from "../../auth/auth.service.js";

export class ListMcpToolsUseCase {
	constructor(
		private readonly authService: AuthService,
		private readonly toolNames: readonly {
			name: string;
			description: string;
		}[],
	) {}

	execute() {
		const permissions = this.authService.getMcpToolPermissions();
		const byName = new Map(
			permissions.map((item) => [item.name, item.enabled]),
		);
		return [...this.toolNames].map((tool) => ({
			name: tool.name,
			description: tool.description,
			enabled: byName.get(tool.name) ?? true,
		}));
	}
}
