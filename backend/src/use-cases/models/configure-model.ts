import type { OllamaService } from "../../ollama/ollama.service.js";

export class ConfigureModelUseCase {
	constructor(private readonly ollamaService: OllamaService) {}

	async execute(
		model: string,
		modelfile: string,
	): Promise<{ success: boolean; message: string }> {
		await this.ollamaService.configureModel(model, modelfile);
		return { success: true, message: `Model ${model} configured successfully` };
	}
}
