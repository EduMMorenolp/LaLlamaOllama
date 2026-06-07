import { touchChat } from "./chats.js";
import { getDb } from "./connection.js";

export interface StoredMessage {
	id?: number;
	userId: string;
	chatId?: string;
	role: string;
	content: string;
	origin: "web" | "telegram";
	expertName?: string | null;
	created_at?: string;
}

export function saveMessage(msg: StoredMessage): void {
	const db = getDb();
	db.prepare(
		`INSERT INTO messages (userId, chatId, role, content, origin, expertName)
		 VALUES (?, ?, ?, ?, ?, ?)`
	).run(msg.userId, msg.chatId || null, msg.role, msg.content, msg.origin, msg.expertName || null);

	if (msg.chatId) {
		touchChat(msg.chatId);
	}
}

export function getMessages(chatId: string, limit = 50): StoredMessage[] {
	const db = getDb();
	return db
		.prepare("SELECT * FROM messages WHERE chatId = ? ORDER BY created_at ASC LIMIT ?")
		.all(chatId, limit) as StoredMessage[];
}

export function getMessagesByUser(userId: string, limit = 50): StoredMessage[] {
	const db = getDb();
	return db
		.prepare("SELECT * FROM messages WHERE userId = ? ORDER BY created_at ASC LIMIT ?")
		.all(userId, limit) as StoredMessage[];
}
