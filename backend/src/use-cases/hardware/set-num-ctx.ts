import type { OllamaService } from "../../ollama/ollama.service.js";

export class SetNumCtxUseCase {
	constructor(private readonly ollamaService: OllamaService) {}

	execute(numCtx: number) {
		this.ollamaService.setGlobalNumCtx(numCtx);
		return {
			message: `Contexto global: ${numCtx} tokens`,
			globalNumCtx: numCtx,
		};
	}
}
