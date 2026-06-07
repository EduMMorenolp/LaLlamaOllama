import { randomUUID } from "node:crypto";
import { getDb } from "./connection.js";

export interface ChatEntry {
	id: string;
	userId: string;
	title: string;
	origin: string;
	expertName: string | null;
	pinned: number;
	created_at: string;
	updated_at: string;
	lastMessage?: string;
}

export function createChat(userId: string, expertName?: string | null, title?: string, origin = "web"): ChatEntry {
	const db = getDb();
	const id = randomUUID();
	const now = new Date().toISOString();

	db.prepare(
		`INSERT INTO chats (id, userId, title, origin, expertName, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`
	).run(id, userId, title || "Nuevo chat", origin, expertName || null, now, now);

	return {
		id,
		userId,
		title: title || "Nuevo chat",
		origin,
		expertName: expertName || null,
		pinned: 0,
		created_at: now,
		updated_at: now,
	};
}

export function listChats(userId: string, expertName?: string | null): ChatEntry[] {
	const db = getDb();
	let query: string;
	let params: unknown[];

	if (expertName === undefined) {
		query = `
			SELECT c.*,
				(SELECT content FROM messages WHERE chatId = c.id ORDER BY created_at DESC LIMIT 1) as lastMessage
			FROM chats c
			WHERE c.userId = ? AND c.origin = 'web'
			ORDER BY c.pinned DESC, c.updated_at DESC`;
		params = [userId];
	} else if (expertName === null) {
		query = `
			SELECT c.*,
				(SELECT content FROM messages WHERE chatId = c.id ORDER BY created_at DESC LIMIT 1) as lastMessage
			FROM chats c
			WHERE c.userId = ? AND c.expertName IS NULL AND c.origin = 'web'
			ORDER BY c.pinned DESC, c.updated_at DESC`;
		params = [userId];
	} else {
		query = `
			SELECT c.*,
				(SELECT content FROM messages WHERE chatId = c.id ORDER BY created_at DESC LIMIT 1) as lastMessage
			FROM chats c
			WHERE c.userId = ? AND c.expertName = ? AND c.origin = 'web'
			ORDER BY c.pinned DESC, c.updated_at DESC`;
		params = [userId, expertName];
	}

	return db.prepare(query).all(...params) as ChatEntry[];
}

export function listChannelChats(userId: string): ChatEntry[] {
	const db = getDb();
	return db
		.prepare(
			`SELECT c.*,
				(SELECT content FROM messages WHERE chatId = c.id ORDER BY created_at DESC LIMIT 1) as lastMessage
			FROM chats c
			WHERE c.userId = ? AND c.origin != 'web'
			ORDER BY c.origin ASC`
		)
		.all(userId) as ChatEntry[];
}

export function getOrCreateChannelChat(userId: string, origin: string): ChatEntry {
	const db = getDb();
	const existing = db.prepare("SELECT * FROM chats WHERE userId = ? AND origin = ?").get(userId, origin) as
		| ChatEntry
		| undefined;
	if (existing) return existing;

	const label = origin.charAt(0).toUpperCase() + origin.slice(1);
	return createChat(userId, null, `💬 ${label}`, origin);
}

export function getChat(id: string): ChatEntry | null {
	const db = getDb();
	return (db.prepare("SELECT * FROM chats WHERE id = ?").get(id) as ChatEntry | undefined) || null;
}

export function renameChat(id: string, title: string): void {
	getDb().prepare("UPDATE chats SET title = ? WHERE id = ?").run(title, id);
}

export function deleteChat(id: string): void {
	const db = getDb();
	db.prepare("DELETE FROM messages WHERE chatId = ?").run(id);
	db.prepare("DELETE FROM chats WHERE id = ?").run(id);
}

export function togglePin(id: string): boolean {
	const db = getDb();
	const chat = db.prepare("SELECT pinned FROM chats WHERE id = ?").get(id) as { pinned: number } | undefined;
	if (!chat) return false;
	const newPinned = chat.pinned ? 0 : 1;
	db.prepare("UPDATE chats SET pinned = ? WHERE id = ?").run(newPinned, id);
	return !!newPinned;
}

export function touchChat(id: string): void {
	getDb().prepare("UPDATE chats SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
}

export function getChatWithStats(chatId: string): { chat: ChatEntry | null; messageCount: number } {
	const db = getDb();
	const chat = getChat(chatId);
	if (!chat) return { chat: null, messageCount: 0 };
	const row = db.prepare("SELECT COUNT(*) as count FROM messages WHERE chatId = ?").get(chatId) as
		| { count: number }
		| undefined;
	return { chat, messageCount: row?.count || 0 };
}
