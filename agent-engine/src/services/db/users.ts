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
	persona: string | null;
	language: string;
	interests: string | null;
	dislikes: string | null;
	communication_style: string | null;
	tone_preference: string | null;
	interaction_count: number;
	last_topics: string | null;
	average_sentiment: number;
	model_preference: string | null;
	metadata: string | null;
	created_at: string;
}

const ALL_COLS = [
	"userId", "name", "timezone", "telegram_user", "telegram_id", "telegram_token",
	"login_pin", "preferences", "persona", "language", "interests", "dislikes",
	"communication_style", "tone_preference", "interaction_count", "last_topics",
	"average_sentiment", "model_preference", "metadata", "created_at",
];

export function getUser(userId: string): UserProfile | null {
	const db = getDb();
	const stmt = db.prepare("SELECT * FROM users WHERE userId = ?");
	return (stmt.get(userId) as UserProfile | undefined) || null;
}

export function upsertUser(userId: string, data: Partial<Omit<UserProfile, "userId" | "created_at">>): void {
	const db = getDb();
	const existing = getUser(userId);

	if (existing) {
		const keys = Object.keys(data) as (keyof typeof data)[];
		if (keys.length === 0) return;
		const setClause = keys.map((k) => `${String(k)} = ?`).join(", ");
		const values = keys.map((k) => data[k]);
		db.prepare(`UPDATE users SET ${setClause} WHERE userId = ?`).run(...values, userId);
	} else {
		const cols = ["userId", ...Object.keys(data)];
		const placeholders = cols.map(() => "?").join(", ");
		const values = cols.map((k) => {
			if (k === "userId") return userId;
			return (data as Record<string, unknown>)[k] ?? null;
		});
		db.prepare(`INSERT INTO users (${cols.join(", ")}) VALUES (${placeholders})`).run(...values);
	}
}

export function updateUserStats(
	userId: string,
	stats: {
		interaction_count?: number;
		last_topics?: string;
		average_sentiment?: number;
	}
): void {
	const db = getDb();
	const sets: string[] = [];
	const vals: unknown[] = [];
	if (stats.interaction_count !== undefined) { sets.push("interaction_count = ?"); vals.push(stats.interaction_count); }
	if (stats.last_topics !== undefined) { sets.push("last_topics = ?"); vals.push(stats.last_topics); }
	if (stats.average_sentiment !== undefined) { sets.push("average_sentiment = ?"); vals.push(stats.average_sentiment); }
	if (sets.length === 0) return;
	vals.push(userId);
	db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE userId = ?`).run(...vals);
}

export function updateUserPreferences(
	userId: string,
	prefs: {
		persona?: string;
		language?: string;
		interests?: string;
		dislikes?: string;
		communication_style?: string;
		tone_preference?: string;
		model_preference?: string;
		metadata?: string;
	}
): void {
	const db = getDb();
	const sets: string[] = [];
	const vals: unknown[] = [];
	for (const [key, val] of Object.entries(prefs)) {
		if (val !== undefined) { sets.push(`${key} = ?`); vals.push(val); }
	}
	if (sets.length === 0) return;
	vals.push(userId);
	db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE userId = ?`).run(...vals);
}

export function getUserPreferences(userId: string): UserProfile | null {
	return getUser(userId);
}

/** Return a human-readable summary of the user profile for prompt injection */
export function formatUserProfileForPrompt(user: UserProfile): string {
	const lines: string[] = [];
	if (user.name) lines.push(`Nombre: ${user.name}`);
	if (user.persona) lines.push(`Persona: ${user.persona}`);
	if (user.communication_style) lines.push(`Estilo de comunicación: ${user.communication_style}`);
	if (user.tone_preference) lines.push(`Tono preferido: ${user.tone_preference}`);
	if (user.interests) {
		try {
			const interests = JSON.parse(user.interests);
			if (Array.isArray(interests) && interests.length > 0) {
				lines.push(`Intereses: ${interests.join(", ")}`);
			}
		} catch { lines.push(`Intereses: ${user.interests}`); }
	}
	if (user.dislikes) {
		try {
			const dislikes = JSON.parse(user.dislikes);
			if (Array.isArray(dislikes) && dislikes.length > 0) {
				lines.push(`Temas que no le gustan: ${dislikes.join(", ")}`);
			}
		} catch { lines.push(`Disgustos: ${user.dislikes}`); }
	}
	if (user.language) lines.push(`Idioma: ${user.language}`);
	if (user.interaction_count > 0) lines.push(`Interacciones: ${user.interaction_count} conversaciones`);
	if (user.last_topics) {
		try {
			const topics = JSON.parse(user.last_topics);
			if (Array.isArray(topics) && topics.length > 0) {
				lines.push(`Temas recientes: ${topics.join(", ")}`);
			}
		} catch { lines.push(`Temas recientes: ${user.last_topics}`); }
	}
	if (user.model_preference) lines.push(`Modelo preferido: ${user.model_preference}`);
	if (user.metadata) {
		try {
			const md = JSON.parse(user.metadata);
			for (const [k, v] of Object.entries(md)) {
				lines.push(`${k}: ${v}`);
			}
		} catch { /* skip */ }
	}
	return lines.length > 0 ? lines.join("\n") : "";
}

export function listAllUsers(): UserProfile[] {
	const db = getDb();
	return db.prepare("SELECT * FROM users ORDER BY created_at DESC").all() as UserProfile[];
}

export function deleteUser(userId: string): void {
	getDb().prepare("DELETE FROM users WHERE userId = ?").run(userId);
}
