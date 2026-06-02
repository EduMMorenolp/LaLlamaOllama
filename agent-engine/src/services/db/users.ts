import { getDb } from "./connection.js";

export interface UserProfile {
	userId: string;
	name: string | null;
	timezone: string;
	telegram_user: string | null;
	telegram_id: number | null;
	telegram_token: string | null;
	login_pin: string;
	preferences: string | null;
	created_at: string;
}

export function getUser(userId: string): UserProfile | null {
	const db = getDb();
	const stmt = db.prepare("SELECT * FROM users WHERE userId = ?");
	return (stmt.get(userId) as UserProfile | undefined) || null;
}

export function upsertUser(
	userId: string,
	data: Partial<Omit<UserProfile, "userId" | "created_at">>
): void {
	const db = getDb();
	const existing = getUser(userId);

	if (existing) {
		const fields = Object.keys(data)
			.map((k) => `${k} = ?`)
			.join(", ");
		const values = Object.values(data);
		db.prepare(`UPDATE users SET ${fields} WHERE userId = ?`).run(...values, userId);
	} else {
		db.prepare(
			`INSERT INTO users (userId, name, timezone, telegram_user, telegram_id, telegram_token, login_pin, preferences) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		).run(
			userId,
			data.name || null,
			data.timezone || "America/Argentina/Buenos_Aires",
			data.telegram_user || null,
			(data as Record<string, unknown>).telegram_id || null,
			data.telegram_token || null,
			data.login_pin || "0000",
			data.preferences || null
		);
	}
}

export function listAllUsers(): UserProfile[] {
	const db = getDb();
	return db.prepare("SELECT * FROM users ORDER BY created_at DESC").all() as UserProfile[];
}

export function deleteUser(userId: string): void {
	getDb().prepare("DELETE FROM users WHERE userId = ?").run(userId);
}
