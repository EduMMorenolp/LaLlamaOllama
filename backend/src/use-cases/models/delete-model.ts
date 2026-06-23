import type { OllamaService } from "../../ollama/ollama.service.js";

export class DeleteModelUseCase {
	constructor(private readonly ollamaService: OllamaService) {}

	async execute(name: string) {
		await this.ollamaService.deleteModel(name);
		return { message: `Model ${name} deleted` };
	}
}
