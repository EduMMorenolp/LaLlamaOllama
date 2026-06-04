import type { OllamaService } from "../../ollama/ollama.service.js";

export class UnloadModelsUseCase {
  constructor(private readonly ollamaService: OllamaService) {}

  async execute() {
    await this.ollamaService.unloadModels();
    return { message: "VRAM freed successfully" };
  }
}
