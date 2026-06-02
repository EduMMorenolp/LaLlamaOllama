import { getSessionMap } from "./startSession.js";

export async function endSession(chatId: string): Promise<boolean> {
	const sessions = getSessionMap();
	if (!sessions.has(chatId)) return false;
	sessions.delete(chatId);
	return true;
}
