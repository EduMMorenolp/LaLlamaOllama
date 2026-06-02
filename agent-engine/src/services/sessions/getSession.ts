import type { SessionState } from "./types.js";
import { getSessionMap } from "./startSession.js";

export async function getSession(chatId: string): Promise<SessionState | undefined> {
	return getSessionMap().get(chatId);
}

export function getActiveSessionIds(): string[] {
	return Array.from(getSessionMap().keys());
}
