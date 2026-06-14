import axios from "axios";
import { config } from "../config.js";
import logger from "../../utils/logger.js";

const log = logger.child({ component: "llm" });

export async function generate(model: string, prompt: string, options: Record<string, unknown> = {}): Promise<string> {
	try {
		const response = await axios.post(`${config.ollamaUrl}/api/generate`, {
			model,
			prompt,
			options,
			stream: false,
		});
		return response.data.response || "";
	} catch (error) {
		log.error({ err: error, model }, "Error generating text");
		throw error;
	}
}
