// Native ollama API client (bypasses buggy /v1/chat/completions endpoint)
// Calls /api/chat directly instead of using the OpenAI SDK

import type { AppConfig } from "../config.js";

interface OllamaMessage {
	role: string;
	content: string;
}

interface OllamaTool {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	};
}

interface OllamaChatRequest {
	model: string;
	messages: OllamaMessage[];
	stream: boolean;
	tools?: OllamaTool[];
	options?: {
		temperature?: number;
		num_predict?: number;
	};
}

interface OllamaToolCall {
	function: { name: string; arguments: string };
}

interface OllamaChatResponse {
	model: string;
	message: {
		role: string;
		content: string;
		tool_calls?: OllamaToolCall[];
	};
	done: boolean;
}

interface OllamaChunk {
	model: string;
	message: { role: string; content: string };
	done: boolean;
}

interface OllamaToolCallChunk {
	model: string;
	message: {
		role: string;
		content: string;
		tool_calls?: OllamaToolCall[];
	};
	done: boolean;
}

export interface OllamaStreamResult {
	content: string;
	toolCalls: Array<{
		id: string;
		type: "function";
		function: { name: string; arguments: string };
	}>;
}

export async function callOllamaChat(
	config: AppConfig,
	model: string,
	messages: Array<{ role: string; content: string }>,
	tools: OllamaTool[],
	options: { temperature?: number },
	abortSignal?: AbortSignal,
): Promise<AsyncGenerator<OllamaStreamResult>> {
	const url = `${config.ollamaUrl}/api/chat`;

	const body: OllamaChatRequest = {
		model,
		messages: messages.map(m => ({ role: m.role, content: m.content })),
		stream: true,
		options: {
			temperature: options.temperature ?? 0.7,
		},
	};

	if (tools.length > 0) {
		body.tools = tools;
	}

	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		signal: abortSignal,
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Ollama API error (${response.status}): ${text}`);
	}

	const reader = response.body?.getReader();
	if (!reader) throw new Error("No response body");

	const decoder = new TextDecoder();
	let buffer = "";

	const gen: AsyncGenerator<OllamaStreamResult> = {
		[Symbol.asyncIterator]() { return this; },
		async next(): Promise<IteratorResult<OllamaStreamResult>> {
			while (true) {
				const { done, value } = await reader!.read();
				if (done) {
					// Process remaining buffer
					if (buffer.trim()) {
						try {
							const parsed = JSON.parse(buffer.trim());
							return {
								done: false,
								value: parseOllamaLine(parsed),
							};
						} catch {
							// ignore parse errors on incomplete buffer
						}
					}
					return { done: true, value: undefined as any };
				}

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed) continue;
					try {
						const parsed = JSON.parse(trimmed);
						return { done: false, value: parseOllamaLine(parsed) };
					} catch {
						// incomplete line, keep buffering
					}
				}
			}
		},
		async return(): Promise<IteratorResult<OllamaStreamResult>> {
			reader!.cancel();
			return { done: true, value: undefined as any };
		},
		async throw(e: any): Promise<IteratorResult<OllamaStreamResult>> {
			reader!.cancel();
			throw e;
		},
	};

	return gen;
}

function parseOllamaLine(data: any): OllamaStreamResult {
	const content = data.message?.content || "";
	const toolCalls: OllamaStreamResult["toolCalls"] = [];

	if (data.message?.tool_calls) {
		for (const tc of data.message.tool_calls) {
			toolCalls.push({
				id: tc.function?.name || `ollama-${Date.now()}`,
				type: "function",
				function: {
					name: tc.function?.name || "",
					arguments: typeof tc.function?.arguments === "string"
						? tc.function.arguments
						: JSON.stringify(tc.function?.arguments || {}),
				},
			});
		}
	}

	return { content, toolCalls };
}

export async function callOllamaChatSimple(
	config: AppConfig,
	model: string,
	messages: Array<{ role: string; content: string }>,
	tools: OllamaTool[],
	options: { temperature?: number },
): Promise<{ content: string; toolCalls: OllamaStreamResult["toolCalls"] }> {
	const url = `${config.ollamaUrl}/api/chat`;

	const body: OllamaChatRequest = {
		model,
		messages,
		stream: false,
		options: {
			temperature: options.temperature ?? 0.7,
		},
	};

	if (tools.length > 0) {
		body.tools = tools;
	}

	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Ollama API error (${response.status}): ${text}`);
	}

	const result = (await response.json()) as OllamaChatResponse;
	return parseOllamaLine(result);
}
