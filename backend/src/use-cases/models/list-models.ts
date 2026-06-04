import type { OllamaService } from "../../ollama/ollama.service.js";

export class ListModelsUseCase {
  constructor(private readonly ollamaService: OllamaService) {}

  async execute() {
    const models = await this.ollamaService.listModels();
    return { models };
  }
}
