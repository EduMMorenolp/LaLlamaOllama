import { DockerContainerRepository } from "../../repositories/docker-container.repository.js";

export class StopNgrokUseCase {
  constructor(
    private readonly dockerRepo: DockerContainerRepository,
    private readonly containerName: string
  ) {}

  async execute() {
    const container = await this.dockerRepo.getContainer(this.containerName);
    if (!container) {
      return { success: false as const, message: "Contenedor ngrok no encontrado" };
    }
    if (!(await this.dockerRepo.isRunning(this.containerName))) {
      return { success: true as const, message: "Ngrok ya está detenido", running: false };
    }
    await this.dockerRepo.stopContainer(this.containerName);
    return { success: true as const, message: "Ngrok detenido", running: false };
  }
}
