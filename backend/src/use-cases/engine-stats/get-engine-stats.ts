import type { OllamaService } from "../../ollama/ollama.service.js";

export class GetEngineStatsUseCase {
  constructor(private readonly ollamaService: OllamaService) {}

  execute() {
    const stats = this.ollamaService.getStats();
    const gpu = this.ollamaService.getGpuMetrics();
    return { stats, gpu };
  }
}
