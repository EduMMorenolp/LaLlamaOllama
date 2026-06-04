import { DockerContainerRepository } from "../../repositories/docker-container.repository.js";

export class StartContainerUseCase {
  constructor(private readonly dockerRepo: DockerContainerRepository) {}

  async execute(containerName: string) {
    const container = await this.dockerRepo.getContainer(containerName);
    if (!container) {
      return { success: false as const, message: `Container ${containerName} not found` };
    }
    const running = await this.dockerRepo.isRunning(containerName);
    if (running) {
      return { success: true as const, message: `${containerName} already running` };
    }
    await this.dockerRepo.startContainer(containerName);
    return { success: true as const, message: `${containerName} started` };
  }
}
