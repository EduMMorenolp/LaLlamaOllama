import type { AuthService } from "../../auth/auth.service.js";
import type { ToggleAuthRequest } from "../../types/auth.js";

export class ToggleMcpAuthUseCase {
	constructor(private readonly authService: AuthService) {}

	execute(input: ToggleAuthRequest) {
		this.authService.setMcpAuthEnabled(input.enabled);
		return this.authService.getSettings();
	}
}
