import type { OllamaService } from "../../ollama/ollama.service.js";

export class CleanWorkspaceUseCase {
	constructor(private readonly ollamaService: OllamaService) {}

	async execute() {
		const result = await this.ollamaService.cleanWorkspace();
		return { message: "Workspace cleaned", freed: result.freed };
	}
}
