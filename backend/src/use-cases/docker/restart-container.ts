import { DockerContainerRepository } from "../../repositories/docker-container.repository.js";

export class RestartContainerUseCase {
  constructor(private readonly dockerRepo: DockerContainerRepository) {}

  async execute(containerName: string) {
    const container = await this.dockerRepo.getContainer(containerName);
    if (!container) {
      return { success: false as const, message: `Container ${containerName} not found` };
    }
    await this.dockerRepo.restartContainer(containerName);
    return { success: true as const, message: `${containerName} restarted` };
  }
}
