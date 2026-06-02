import type { BrainClient } from "./client.js";

export async function saveMemory(
	brain: BrainClient,
	type: string,
	title: string,
	content: string,
	tags?: string,
	agent?: string
): Promise<string> {
	return brain.saveMemory(type, title, content, tags, agent);
}
