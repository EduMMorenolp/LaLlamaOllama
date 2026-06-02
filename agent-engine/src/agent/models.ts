import OpenAI from "openai";
import type { EnvConfig } from "../env.js";

export type ModelProvider = "ollama" | "openai" | "openrouter";

export interface ModelConfig {
	provider: ModelProvider;
	model: string;
	baseUrl: string;
	apiKey: string;
}

/**
 * Detecta el proveedor a partir del nombre del modelo.
 * Formato: "ollama/llama3.2:3b", "openrouter/anthropic/claude-3", "gpt-4o"
 */
export function detectProvider(modelKey: string): ModelProvider {
	if (modelKey.startsWith("ollama/")) return "ollama";
	if (modelKey.startsWith("openrouter/")) return "openrouter";
	return "openai";
}

/**
 * Devuelve el nombre del modelo limpio (sin prefijo)
 */
export function cleanModelName(modelKey: string): string {
	if (modelKey.startsWith("ollama/")) return modelKey.slice("ollama/".length);
	if (modelKey.startsWith("openrouter/")) return modelKey.slice("openrouter/".length);
	return modelKey;
}

/**
 * Crea un cliente OpenAI compatible según la configuración del modelo.
 * Soporta:
 * - Ollama (vía endpoint /v1 del backend proxy o directo)
 * - OpenAI
 * - OpenRouter
 */
export function createClient(config: ModelConfig): OpenAI {
	const baseUrl = config.baseUrl || "http://localhost:3016/v1";
	const apiKey = config.apiKey || "ollama";

	return new OpenAI({
		apiKey,
		baseURL: baseUrl,
		maxRetries: 2,
		timeout: 120000,
	});
}

/**
 * Construye la configuración del modelo por defecto desde la env config.
 * Usa el backend proxy de LaLlamaOllama como endpoint primario.
 */
export function getDefaultModelConfig(env: EnvConfig): ModelConfig {
	return {
		provider: "ollama",
		model: env.defaultModel,
		baseUrl: `${env.backendUrl}/v1`,
		apiKey: env.apiKey,
	};
}

/**
 * Lista modelos disponibles desde el backend.
 */
export async function listModels(env: EnvConfig): Promise<string[]> {
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
