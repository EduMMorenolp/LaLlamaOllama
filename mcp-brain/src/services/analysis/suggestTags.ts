import { generate } from "../llm/index.js";

export async function suggestTags(
	model: string,
	title: string,
	content: string,
): Promise<string[]> {
	const prompt = `You are a taxonomy expert. Analyze this memory and provide exactly 3 to 5 comma-separated tags that categorize it well. Return ONLY the comma separated string, no markdown.\n\nTitle: ${title}\nContent: ${content}\nTags:`;
	const response = await generate(model, prompt, {
		temperature: 0.1,
		num_ctx: 1024,
	});
	return response
		.split(",")
		.map((t: string) => t.trim().toLowerCase())
		.filter(Boolean);
}
