import type { AuthService } from "../../auth/auth.service.js";

export class GetAuthSettingsUseCase {
  constructor(private readonly authService: AuthService) {}

  execute() {
    return this.authService.getSettings();
  }
}
