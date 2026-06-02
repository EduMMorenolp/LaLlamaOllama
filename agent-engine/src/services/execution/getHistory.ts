import type { ExecutionEntry } from "./types.js";

// Shared mutable state (like mcp-brain's write queue but simpler)
const history: ExecutionEntry[] = [];
const MAX_HISTORY = 100;

export function addEntry(entry: ExecutionEntry): void {
	history.push(entry);
	if (history.length > MAX_HISTORY) {
		history.shift();
	}
}

export function getHistory(limit = 20): ExecutionEntry[] {
	return history.slice(-limit).reverse();
}
