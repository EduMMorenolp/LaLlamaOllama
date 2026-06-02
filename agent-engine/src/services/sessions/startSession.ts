import type { SessionState } from "./types.js";

const sessions = new Map<string, SessionState>();

export async function startSession(
	chatId: string,
	workspaceDir: string
): Promise<SessionState> {
	if (!sessions.has(chatId)) {
		sessions.set(chatId, {
			messages: [],
			toolContext: {
				sessionId: chatId,
				workspaceDir,
				chatId,
			},
		});
	}
	return sessions.get(chatId)!;
}

export function getSessionMap(): Map<string, SessionState> {
	return sessions;
}
