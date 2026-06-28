import logger from "../../utils/logger.js";

const log = logger.child({ component: "llm" });

export async function embed(_input: string): Promise<number[][]> {
	log.warn("Embeddings disabled: mcp-brain runs without ollama");
	return [];
}
