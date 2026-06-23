import type { Database } from "sqlite";
import type sqlite3 from "sqlite3";

export async function createSettingsTable(
	db: Database<sqlite3.Database, sqlite3.Statement>,
) {
	await db.exec(`
		CREATE TABLE IF NOT EXISTS core_directives (
			project TEXT PRIMARY KEY,
			content TEXT NOT NULL,
			updatedAt INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS global_settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updatedAt INTEGER NOT NULL
		);
	`);

	// Insert default settings if they don't exist
	const defaultSettings = [
		{ key: "consolidation_cron", value: "0 0 * * *" }, // Midnight every day
		{ key: "delegation_threshold", value: "3" }, // 3 times
	];

	for (const setting of defaultSettings) {
		await db.run(
			`INSERT OR IGNORE INTO global_settings (key, value, updatedAt) VALUES (?, ?, ?)`,
			setting.key,
			setting.value,
			Date.now(),
		);
	}
}
