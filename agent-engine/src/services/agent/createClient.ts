import OpenAI from "openai";
import type { AppConfig } from "../config.js";

export type ModelProvider = "ollama" | "openai" | "openrouter";

export interface ModelConfig {
	provider: ModelProvider;
	model: string;
	baseUrl: string;
	apiKey: string;
	timeout?: number;
}

export function detectProvider(modelKey: string): ModelProvider {
	if (modelKey.startsWith("ollama/")) return "ollama";
	if (modelKey.startsWith("openrouter/")) return "openrouter";
	return "openai";
}

export function cleanModelName(modelKey: string): string {
	if (modelKey.startsWith("ollama/")) return modelKey.slice("ollama/".length);
	if (modelKey.startsWith("openrouter/")) return modelKey.slice("openrouter/".length);
	return modelKey;
}

export function createClient(config: ModelConfig): OpenAI {
	const baseUrl = config.baseUrl || "http://localhost:3016/v1";
	const apiKey = config.apiKey || "ollama";
	return new OpenAI({
		apiKey,
		baseURL: baseUrl,
		maxRetries: 2,
		timeout: config.timeout ?? 120000,
	});
}

export function getDefaultModelConfig(env: AppConfig): ModelConfig {
	return {
		provider: "ollama",
		model: env.defaultModel,
		baseUrl: `${env.backendUrl}/v1`,
		apiKey: env.apiKey,
		timeout: env.llmTimeout,
	};
}

export async function listModels(env: AppConfig): Promise<string[]> {
	try {
		const res = await fetch(`${env.backendUrl}/api/models`, {
			headers: { "x-api-key": env.apiKey },
		});
		if (!res.ok) return [env.defaultModel];
		const data = (await res.json()) as { models?: Array<{ name: string }> };
		return data.models?.map((m) => m.name) || [env.defaultModel];
	} catch {
		return [env.defaultModel];
	}
}
