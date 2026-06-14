import type { OllamaService } from "../../ollama/ollama.service.js";

export class ShowModelUseCase {
  constructor(private readonly ollamaService: OllamaService) {}

  async execute(name: string) {
    const details = await this.ollamaService.showModel(name);
    return details;
  }
}
