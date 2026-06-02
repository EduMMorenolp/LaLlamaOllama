import type { BrainClient } from "./client.js";

export async function getContext(
	brain: BrainClient,
	limit = 15
): Promise<string> {
	return brain.getContext(limit);
}
