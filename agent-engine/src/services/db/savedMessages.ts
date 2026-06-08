import { getDb } from "./connection.js";

export interface SavedMessage {
	id: number;
	userId: string;
	chatId: string;
	messageRole: string;
	messageContent: string;
	messageTimestamp: string | null;
	notes: string;
	created_at: string;
}

export function saveMessageToFavorites(
	userId: string,
	chatId: string,
	messageRole: string,
	messageContent: string,
	messageTimestamp?: string
): boolean {
	const db = getDb();
	try {
		db.prepare(
			`INSERT OR IGNORE INTO saved_messages (userId, chatId, messageRole, messageContent, messageTimestamp)
       VALUES (?, ?, ?, ?, ?)`
		).run(userId, chatId, messageRole, messageContent, messageTimestamp || null);
		return true;
	} catch {
		return false;
	}
}

export function unsaveMessage(userId: string, chatId: string, messageContent: string): boolean {
	const db = getDb();
	try {
		db.prepare(`DELETE FROM saved_messages WHERE userId = ? AND chatId = ? AND messageContent = ?`).run(
			userId,
			chatId,
			messageContent
		);
		return true;
	} catch {
		return false;
	}
}

export function listSavedMessages(userId: string, limit = 50): SavedMessage[] {
	const db = getDb();
	return db
		.prepare("SELECT * FROM saved_messages WHERE userId = ? ORDER BY created_at DESC LIMIT ?")
		.all(userId, limit) as SavedMessage[];
}

export function isMessageSaved(userId: string, chatId: string, messageContent: string): boolean {
	const db = getDb();
	const row = db
		.prepare("SELECT id FROM saved_messages WHERE userId = ? AND chatId = ? AND messageContent = ?")
		.get(userId, chatId, messageContent);
	return !!row;
}
