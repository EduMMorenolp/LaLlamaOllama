import type { AgentsService, FileNode } from "../../services/agents.service.js";

export class AnalyzeProjectUseCase {
	constructor(private readonly agentsService: AgentsService) {}

	async execute(
		model: string,
		projectName: string,
		structure: unknown,
		configFiles: Record<string, unknown>,
	) {
		const result = await this.agentsService.analyzeProject(
			model,
			projectName,
			structure as FileNode,
			(configFiles as Record<string, string>) || {},
		);
		return result;
	}
}
