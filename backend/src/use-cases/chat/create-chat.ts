import type { OllamaService } from "../../ollama/ollama.service.js";
import type { ChatRequest } from "../../types/chat.js";

export class CreateChatUseCase {
	constructor(private readonly ollamaService: OllamaService) {}

	async execute(input: ChatRequest) {
		const { model, messages, stream: _stream, user, ...options } = input;

		const response = await this.ollamaService.chat(
			model,
			messages,
			{
				temperature: options.temperature,
				num_ctx: options.num_ctx,
				top_p: options.top_p,
				top_k: options.top_k,
			},
			"5m",
			user,
			options.tools,
		);

		const promptTokens = response.prompt_eval_count || 0;
		const completionTokens = response.eval_count || 0;

		return {
			id: `chatcmpl-${Date.now()}`,
			object: "chat.completion",
			created: Math.floor(Date.now() / 1000),
			model,
			choices: [
				{
					index: 0,
					message: response.message,
					finish_reason: "stop",
				},
			],
			usage: {
				prompt_tokens: promptTokens,
				completion_tokens: completionTokens,
				total_tokens: promptTokens + completionTokens,
			},
		};
	}
}
