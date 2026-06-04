import type { OllamaService } from "../../ollama/ollama.service.js";

export class ListModelsOpenAiUseCase {
  constructor(private readonly ollamaService: OllamaService) {}

  async execute() {
    const models = await this.ollamaService.listModels();
    return {
      object: "list",
      data: models.map((m) => ({
        id: m.name,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: "ollama",
      })),
    };
  }
}
