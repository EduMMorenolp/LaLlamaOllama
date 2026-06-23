import type { AuthService } from "../../auth/auth.service.js";
import type { ToggleAuthRequest } from "../../types/auth.js";

export class ToggleOllamaAuthUseCase {
	constructor(private readonly authService: AuthService) {}

	execute(input: ToggleAuthRequest) {
		this.authService.setOllamaAuthEnabled(input.enabled);
		return this.authService.getSettings();
	}
}
