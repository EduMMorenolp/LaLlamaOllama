import Database from "better-sqlite3";
import { getDb } from "./connection.js";

export interface SettingEntry {
	key: string;
	value: string;
	updated_at: string;
}

/**
 * Get a setting value by key.
 * Returns null if the key does not exist.
 */
export function getSetting(key: string): string | null {
	try {
		const db = getDb();
		const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
		return row?.value ?? null;
	} catch {
		return null;
	}
}

/**
 * Set a setting value (insert or update).
 */
export function setSetting(key: string, value: string): void {
	try {
		const db = getDb();
		db.prepare(
			"INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
		).run(key, value);
	} catch {
		// DB might not be available
	}
}

/**
 * Get all settings as an array of entries.
 */
export function getAllSettings(): SettingEntry[] {
	try {
		const db = getDb();
		return db.prepare("SELECT key, value, updated_at FROM settings ORDER BY key").all() as SettingEntry[];
	} catch {
		return [];
	}
}

/**
 * Delete a setting by key.
 */
export function deleteSetting(key: string): void {
	try {
		const db = getDb();
		db.prepare("DELETE FROM settings WHERE key = ?").run(key);
	} catch {
		// DB might not be available
	}
}
