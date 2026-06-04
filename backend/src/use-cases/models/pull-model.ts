import type { OllamaService } from "../../ollama/ollama.service.js";
import logger from "../../utils/logger.js";

export class PullModelUseCase {
  private readonly log = logger.child({ component: "pull-model" });

  constructor(private readonly ollamaService: OllamaService) {}

  execute(model: string) {
    this.ollamaService.pullModel(model).catch((err: unknown) => {
      this.log.error({ err, model }, "Error pulling model");
    });
    return { message: `Pulling model ${model} started` };
  }
}
