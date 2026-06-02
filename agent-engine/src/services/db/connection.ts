import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { logger } from "../../utils/logger.js";

let _db: Database.Database | null = null;

export function getDb(dbPath?: string): Database.Database {
	if (_db) return _db;

	const resolvedPath = resolve(process.cwd(), dbPath || "./agent-engine.db");
	const dbDir = dirname(resolvedPath);

	if (!existsSync(dbDir)) {
		mkdirSync(dbDir, { recursive: true });
	}

	_db = new Database(resolvedPath);
	_db.pragma("journal_mode = WAL");

	// ─── Schema ────────────────────────────────────────────────────────────
	_db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			userId TEXT PRIMARY KEY,
			name TEXT,
			timezone TEXT DEFAULT 'America/Argentina/Buenos_Aires',
			telegram_user TEXT,
			telegram_id INTEGER,
			telegram_token TEXT,
			login_pin TEXT DEFAULT '0000',
			preferences TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS sub_agents (
			name TEXT PRIMARY KEY,
			model TEXT NOT NULL,
			system_prompt TEXT NOT NULL,
			tools TEXT DEFAULT '[]',
			experts TEXT DEFAULT '[]',
			temperature REAL DEFAULT 0.7,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			userId TEXT NOT NULL,
			chatId TEXT,
			role TEXT NOT NULL,
			content TEXT NOT NULL,
			origin TEXT DEFAULT 'web',
			expertName TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS models (
			name TEXT PRIMARY KEY,
			displayName TEXT,
			apiKey TEXT,
			baseUrl TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS chats (
			id TEXT PRIMARY KEY,
			userId TEXT NOT NULL,
			title TEXT DEFAULT 'Nuevo chat',
			origin TEXT DEFAULT 'web',
			expertName TEXT,
			pinned INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_messages_userId ON messages(userId);
		CREATE INDEX IF NOT EXISTS idx_messages_chatId ON messages(chatId);
		CREATE INDEX IF NOT EXISTS idx_chats_userId ON chats(userId);
		CREATE INDEX IF NOT EXISTS idx_sub_agents_name ON sub_agents(name);
	`);

	// ─── Migrations ───────────────────────────────────────────────────────
	try {
		_db.exec("ALTER TABLE sub_agents ADD COLUMN model TEXT DEFAULT ''");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE sub_agents ADD COLUMN experts TEXT DEFAULT '[]'");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE users ADD COLUMN telegram_user TEXT");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE users ADD COLUMN telegram_id INTEGER");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE users ADD COLUMN telegram_token TEXT");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE messages ADD COLUMN chatId TEXT");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE messages ADD COLUMN expertName TEXT");
	} catch {
		// already exists
	}

	logger.info(`[DB] SQLite initialized: ${resolvedPath}`);
	return _db;
}

export function closeDb(): void {
	if (_db) {
		_db.close();
		_db = null;
	}
}
