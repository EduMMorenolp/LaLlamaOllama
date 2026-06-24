import axios from "axios";
import logger from "../../utils/logger.js";
import { config } from "../config.js";

const log = logger.child({ component: "llm" });

export async function embed(input: string): Promise<number[][]> {
	try {
		const response = await axios.post(`${config.ollamaUrl}/api/embeddings`, {
			model: config.embeddingModel,
			input,
		});
		return response.data.embeddings || [];
	} catch (error) {
		log.error({ err: error }, "Error generating embeddings");
		return [];
	}
}
