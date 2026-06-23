import axios from "axios";
import logger from "../../utils/logger.js";
import { config } from "../config.js";

const log = logger.child({ component: "llm" });

export async function generate(
	model: string,
	prompt: string,
	options: Record<string, unknown> = {},
): Promise<string> {
	try {
		const response = await axios.post(
			`${config.backendUrl}/v1/chat/completions`,
			{
				model,
				messages: [{ role: "user", content: prompt }],
				stream: false,
				...options,
			},
			{
				headers: { "x-api-key": config.apiKey },
			},
		);
		return response.data?.choices?.[0]?.message?.content || "";
	} catch (error) {
		log.error({ err: error, model }, "Error generating text via backend proxy");
		throw error;
	}
}
