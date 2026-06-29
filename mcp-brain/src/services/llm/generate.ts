import logger from "../../utils/logger.js";

const log = logger.child({ component: "llm" });

export async function generate(
	_model: string,
	_prompt: string,
	_options: Record<string, unknown> = {},
): Promise<string> {
	log.warn("LLM generation disabled: mcp-brain runs without backend or ollama");
	throw new Error("LLM generation unavailable: mcp-brain is in standalone mode");
}
