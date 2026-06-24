import type { OllamaService } from "./ollama.service.js";

interface CacheEntry {
	caps: string[];
	ts: number;
}

const CAPABILITY_MAP: Record<string, string> = {
	completion: "text",
	vision: "vision",
	tools: "tools",
	thinking: "thinking",
	audio: "audio",
};

const CAPABILITY_ORDER = ["vision", "thinking", "tools", "audio", "text"];

export class ModelCapabilitiesService {
	private cache = new Map<string, CacheEntry>();
	private readonly ttl = 5 * 60 * 1000;

	constructor(private readonly ollamaService: OllamaService) {}

	async getCapabilities(modelName: string): Promise<string[]> {
		const cached = this.cache.get(modelName);
		if (cached && Date.now() - cached.ts < this.ttl) {
			return cached.caps;
		}

		const caps = new Set<string>();

		try {
			const details = await this.ollamaService.showModel(modelName);
			const rawCaps = (details.capabilities as string[]) || [];

			for (const raw of rawCaps) {
				const mapped = CAPABILITY_MAP[raw];
				if (mapped) caps.add(mapped);
			}
		} catch {
			const name = modelName.toLowerCase();

			if (/vision|llava|moondream|paligemma|cogvlm|minicpm-v|internvl/.test(name)) {
				caps.add("vision");
			}
			if (/deepseek-r1|qwq|r1-distill/.test(name)) {
				caps.add("thinking");
			}
			if (/whisper|bark/.test(name)) {
				caps.add("audio");
			}

			const TOOL_FAMILIES = [
				"qwen2.5", "qwen3", "llama3.1", "llama3.2", "llama3.3",
				"mistral", "mixtral", "phi-4", "phi4",
				"command-r", "deepseek-v2", "deepseek-v3",
				"dbrx", "nemotron", "hermes", "functionary",
			];
			if (TOOL_FAMILIES.some((f) => name.includes(f))) {
				caps.add("tools");
			}
		}

		caps.add("text");

		const result = CAPABILITY_ORDER.filter((c) => caps.has(c));
		this.cache.set(modelName, { caps: result, ts: Date.now() });
		return result;
	}

	async enrichModels(models: { name: string }[]): Promise<(typeof models[number] & { capabilities: string[] })[]> {
		const enriched = await Promise.all(
			models.map(async (model) => ({
				...model,
				capabilities: await this.getCapabilities(model.name),
			})),
		);
		return enriched;
	}
}
