import { touchChat } from "./chats.js";
import { getDb } from "./connection.js";

/** Sanitize FTS5 query input to prevent injection of special characters */
function sanitizeFts5(input: string): string {
	return input.replace(/["*()^+~\\-]/g, " ").replace(/\s+/g, " ").trim();
}

export interface StoredMessage {
	id?: number;
	userId: string;
	chatId?: string;
	role: string;
	content: string;
	origin: string;
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

export interface SearchResult {
	id: number;
	content: string;
	role: string;
	chatId: string | null;
	userId: string;
	created_at: string;
	rank: number;
	snippet?: string;
}

export function searchMessages(
	query: string,
	userId?: string,
	limit = 20,
	offset = 0
): SearchResult[] {
	const db = getDb();
	const sanitized = sanitizeFts5(query);
	if (!sanitized) {
		return [];
	}
	const ftsQuery = sanitized.includes(" ")
		? sanitized.split(" ").map((w) => `"${w}"`).join(" OR ")
		: `"${sanitized}"`;

	let sql: string;
	let params: unknown[];

	if (userId) {
		sql = `
			SELECT m.id, m.content, m.role, m.chatId, m.userId, m.created_at,
				rank as rank,
				snippet(messages_fts, 1, '**', '**', '...', 40) as snippet
			FROM messages_fts
			JOIN messages m ON m.id = messages_fts.id
			WHERE messages_fts MATCH ? AND m.userId = ?
			ORDER BY rank
			LIMIT ? OFFSET ?
		`;
		params = [ftsQuery, userId, limit, offset];
	} else {
		sql = `
			SELECT m.id, m.content, m.role, m.chatId, m.userId, m.created_at,
				rank as rank,
				snippet(messages_fts, 1, '**', '**', '...', 40) as snippet
			FROM messages_fts
			JOIN messages m ON m.id = messages_fts.id
			WHERE messages_fts MATCH ?
			ORDER BY rank
			LIMIT ? OFFSET ?
		`;
		params = [ftsQuery, limit, offset];
	}

	return db.prepare(sql).all(...params) as SearchResult[];
}

export function countSearchResults(query: string, userId?: string): number {
	const db = getDb();
	const sanitized = sanitizeFts5(query);
	if (!sanitized) {
		return 0;
	}
	const ftsQuery = sanitized.includes(" ")
		? sanitized.split(" ").map((w) => `"${w}"`).join(" OR ")
		: `"${sanitized}"`;

	let sql: string;
	let params: unknown[];

	if (userId) {
		sql = "SELECT COUNT(*) as c FROM messages_fts JOIN messages m ON m.id = messages_fts.id WHERE messages_fts MATCH ? AND m.userId = ?";
		params = [ftsQuery, userId];
	} else {
		sql = "SELECT COUNT(*) as c FROM messages_fts WHERE messages_fts MATCH ?";
		params = [ftsQuery];
	}

	return (db.prepare(sql).get(...params) as { c: number })?.c || 0;
}