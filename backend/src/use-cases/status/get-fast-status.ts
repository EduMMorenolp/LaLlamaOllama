import type { OllamaService } from "../../ollama/ollama.service.js";
import type { DockerContainerRepository } from "../../repositories/docker-container.repository.js";

export class GetFastStatusUseCase {
	constructor(
		private readonly ollamaService: OllamaService,
		private readonly dockerRepo: DockerContainerRepository,
		private readonly brainContainer: string,
	) {}

	async execute() {
		const status = await this.ollamaService.getFastStatus();
		const brainRunning = await this.dockerRepo.isRunning(this.brainContainer);
		return { ...status, brainRunning };
	}
}
