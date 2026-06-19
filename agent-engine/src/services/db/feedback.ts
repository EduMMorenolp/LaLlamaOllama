import { getDb } from "./connection.js";

export interface MessageFeedback {
	id: number;
	userId: string;
	chatId: string;
	messageId: number | null;
	rating: "up" | "down";
	reason: string | null;
	created_at: string;
}

export function saveFeedback(
	userId: string,
	chatId: string,
	rating: "up" | "down",
	reason?: string,
	messageId?: number
): void {
	const db = getDb();
	db.prepare(
		`INSERT INTO message_feedback (userId, chatId, messageId, rating, reason) VALUES (?, ?, ?, ?, ?)`
	).run(userId, chatId, messageId || null, rating, reason || null);
}

export function getFeedbackStats(userId: string): { up: number; down: number; total: number } {
	const db = getDb();
	const up = (db.prepare("SELECT COUNT(*) as c FROM message_feedback WHERE userId = ? AND rating = 'up'").get(userId) as { c: number })?.c || 0;
	const down = (db.prepare("SELECT COUNT(*) as c FROM message_feedback WHERE userId = ? AND rating = 'down'").get(userId) as { c: number })?.c || 0;
	return { up, down, total: up + down };
}

export function getRecentFeedback(userId: string, limit = 5): MessageFeedback[] {
	const db = getDb();
	return db
		.prepare("SELECT * FROM message_feedback WHERE userId = ? ORDER BY created_at DESC LIMIT ?")
		.all(userId, limit) as MessageFeedback[];
}

export function getChatFeedback(chatId: string): MessageFeedback[] {
	const db = getDb();
	return db
		.prepare("SELECT * FROM message_feedback WHERE chatId = ? ORDER BY created_at DESC")
		.all(chatId) as MessageFeedback[];
}
