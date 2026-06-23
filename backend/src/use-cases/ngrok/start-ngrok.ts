import type { DockerContainerRepository } from "../../repositories/docker-container.repository.js";

export class StartNgrokUseCase {
	constructor(
		private readonly dockerRepo: DockerContainerRepository,
		private readonly containerName: string,
	) {}

	async execute() {
		const container = await this.dockerRepo.getContainer(this.containerName);
		if (!container) {
			return {
				success: false as const,
				message: "Contenedor ngrok no encontrado. Verifica docker-compose.",
			};
		}
		if (await this.dockerRepo.isRunning(this.containerName)) {
			return {
				success: true as const,
				message: "Ngrok ya está corriendo",
				running: true,
			};
		}
		await this.dockerRepo.startContainer(this.containerName);
		return { success: true as const, message: "Ngrok iniciado", running: true };
	}
}
