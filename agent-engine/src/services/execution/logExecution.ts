import type { ExecutionEntry } from "./types.js";

const history: ExecutionEntry[] = [];
const MAX_HISTORY = 100;

export async function logExecution(entry: ExecutionEntry): Promise<void> {
	history.push(entry);
	if (history.length > MAX_HISTORY) {
		history.shift();
	}
}
