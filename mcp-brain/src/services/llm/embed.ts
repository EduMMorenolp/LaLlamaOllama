import axios from "axios";
import { config } from "../config.js";
import logger from "../../utils/logger.js";

const log = logger.child({ component: "llm" });

export async function embed(input: string): Promise<number[][]> {
	try {
		const response = await axios.post(`${config.ollamaUrl}/api/embed`, {
			model: config.embeddingModel,
			input,
		});
		return response.data.embeddings || [];
	} catch (error) {
		log.error({ err: error }, "Error generating embeddings");
		return [];
	}
}
