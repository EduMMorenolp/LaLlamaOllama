import type { OllamaService } from "../../ollama/ollama.service.js";
import { DockerContainerRepository } from "../../repositories/docker-container.repository.js";

export class GetFullStatusUseCase {
  constructor(
    private readonly ollamaService: OllamaService,
    private readonly dockerRepo: DockerContainerRepository,
    private readonly brainContainer: string
  ) {}

  async execute() {
    const status = await this.ollamaService.getServerStatus();
    const brainRunning = await this.dockerRepo.isRunning(this.brainContainer);
    return { ...status, brainRunning };
  }
}
