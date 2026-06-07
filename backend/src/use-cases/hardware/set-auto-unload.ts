import type { OllamaService } from "../../ollama/ollama.service.js";

export class SetAutoUnloadUseCase {
  constructor(private readonly ollamaService: OllamaService) {}

  execute(minutes: number) {
    this.ollamaService.setAutoUnload(minutes);
    return {
      message: `Auto-unload: ${minutes === 0 ? "desactivado" : `${minutes} min`}`,
      autoUnloadMinutes: minutes,
    };
  }
}
