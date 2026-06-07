import { DockerContainerRepository } from "../../repositories/docker-container.repository.js";

export class SetNgrokAuthtokenUseCase {
  constructor(
    private readonly dockerRepo: DockerContainerRepository,
    private readonly containerName: string
  ) {}

  async execute(authtoken: string): Promise<{ authtokenConfigured: boolean; message: string }> {
    let startedByThisRequest = false;
    const container = await this.dockerRepo.getContainer(this.containerName);
    if (!container) {
      throw new Error("Contenedor ngrok no encontrado");
    }

    const wasRunning = await this.dockerRepo.isRunning(this.containerName);

    if (!wasRunning) {
      await this.dockerRepo.startContainer(this.containerName);
      startedByThisRequest = true;
    }

    await this.dockerRepo.execCommand(this.containerName, ["ngrok", "config", "add-authtoken", authtoken.trim()]);

    if (wasRunning) {
      await this.dockerRepo.restartContainer(this.containerName);
    } else if (startedByThisRequest) {
      await this.dockerRepo.stopContainer(this.containerName);
    }

    return { message: "Authtoken de ngrok actualizado", authtokenConfigured: true };
  }
}
