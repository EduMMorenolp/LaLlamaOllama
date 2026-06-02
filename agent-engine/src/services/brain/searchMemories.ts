import type { BrainClient } from "./client.js";
import type { SearchResult } from "../types.js";

export async function searchMemories(
	brain: BrainClient,
	query: string,
	limit = 10
): Promise<SearchResult[]> {
	return brain.searchMemories(query, limit);
}
