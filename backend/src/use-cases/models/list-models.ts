import type { ModelCapabilitiesService } from "../../ollama/model-capabilities.service.js";
import type { OllamaService } from "../../ollama/ollama.service.js";

export class ListModelsUseCase {
	constructor(
		private readonly ollamaService: OllamaService,
		private readonly capabilitiesService: ModelCapabilitiesService,
	) {}

	async execute() {
		const models = await this.ollamaService.listModels();
		const enriched = await this.capabilitiesService.enrichModels(models);
		return { models: enriched };
	}
}
