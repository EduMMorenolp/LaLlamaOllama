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

	// ─── Schema ──────────────────────────────────────────────────────────
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
			persona TEXT,
			language TEXT DEFAULT 'es',
			interests TEXT,
			dislikes TEXT,
			communication_style TEXT,
			tone_preference TEXT,
			interaction_count INTEGER DEFAULT 0,
			last_topics TEXT,
			average_sentiment REAL DEFAULT 0.5,
			model_preference TEXT,
			metadata TEXT,
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

		CREATE TABLE IF NOT EXISTS runs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			chatId TEXT NOT NULL,
			userText TEXT NOT NULL,
			origin TEXT DEFAULT 'web',
			status TEXT NOT NULL DEFAULT 'queued',
			model TEXT,
			resultText TEXT,
			errorText TEXT,
			latencyMs INTEGER,
			priority TEXT DEFAULT 'medium',
			preferred_model TEXT,
			tags TEXT,
			due_date TEXT,
			description TEXT,
			scheduled_at TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS run_events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			runId INTEGER NOT NULL,
			type TEXT NOT NULL,
			payload TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(runId) REFERENCES runs(id) ON DELETE CASCADE
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

		CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
			id UNINDEXED,
			content,
			role UNINDEXED,
			chatId UNINDEXED,
			userId UNINDEXED,
			content='messages',
			content_rowid='id'
		);
		CREATE TRIGGER IF NOT EXISTS messages_fts_ai AFTER INSERT ON messages BEGIN
			INSERT INTO messages_fts (id, content, role, chatId, userId)
			VALUES (new.id, new.content, new.role, new.chatId, new.userId);
		END;
		CREATE TRIGGER IF NOT EXISTS messages_fts_ad AFTER DELETE ON messages BEGIN
			INSERT INTO messages_fts (messages_fts, id, content, role, chatId, userId)
			VALUES ('delete', old.id, old.content, old.role, old.chatId, old.userId);
		END;
		CREATE TRIGGER IF NOT EXISTS messages_fts_au AFTER UPDATE ON messages BEGIN
			INSERT INTO messages_fts (messages_fts, id, content, role, chatId, userId)
			VALUES ('delete', old.id, old.content, old.role, old.chatId, old.userId);
			INSERT INTO messages_fts (id, content, role, chatId, userId)
			VALUES (new.id, new.content, new.role, new.chatId, new.userId);
		END;

		CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_sub_agents_name ON sub_agents(name);
		CREATE INDEX IF NOT EXISTS idx_runs_chatId ON runs(chatId);
		CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
		CREATE INDEX IF NOT EXISTS idx_run_events_runId ON run_events(runId);

		CREATE TABLE IF NOT EXISTS agent_modes (
			name TEXT PRIMARY KEY,
			label TEXT NOT NULL DEFAULT '',
			system_prompt TEXT NOT NULL DEFAULT '',
			tools TEXT NOT NULL DEFAULT '[]',
			model TEXT DEFAULT '',
			temperature REAL DEFAULT 0.7,
			history_limit INTEGER DEFAULT 10,
			tool_policy TEXT DEFAULT 'restricted',
			extends TEXT DEFAULT NULL,
			usage_count INTEGER DEFAULT 0,
			last_used TEXT DEFAULT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS custom_tools (
			name TEXT PRIMARY KEY,
			description TEXT NOT NULL,
			parameters TEXT NOT NULL DEFAULT '{}',
			handler_type TEXT NOT NULL CHECK(handler_type IN ('bash', 'prompt', 'http')),
			handler_config TEXT NOT NULL DEFAULT '{}',
			created_by TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS scheduled_tasks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			cron_expression TEXT NOT NULL,
			task_text TEXT NOT NULL,
			mode_id TEXT DEFAULT NULL,
			origin TEXT DEFAULT 'scheduler',
			schedule_type TEXT DEFAULT 'cron',
			enabled INTEGER DEFAULT 1,
			last_run_at DATETIME DEFAULT NULL,
			next_run_at DATETIME DEFAULT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_enabled ON scheduled_tasks(enabled);

		CREATE TABLE IF NOT EXISTS telegram_transcriptions (
			file_id TEXT PRIMARY KEY,
			transcription TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`);

	// ─── Migrations ──────────────────────────────────────────────────────
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
	try {
		_db.exec("ALTER TABLE runs ADD COLUMN model TEXT");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE runs ADD COLUMN resultText TEXT");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE runs ADD COLUMN errorText TEXT");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE runs ADD COLUMN latencyMs INTEGER");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE sub_agents ADD COLUMN history_limit INTEGER DEFAULT 10");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE runs ADD COLUMN priority TEXT DEFAULT 'medium'");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE runs ADD COLUMN preferred_model TEXT");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE runs ADD COLUMN tags TEXT");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE runs ADD COLUMN due_date TEXT");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE runs ADD COLUMN description TEXT");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE runs ADD COLUMN scheduled_at TEXT");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE runs ADD COLUMN cron_expression TEXT DEFAULT NULL");
	} catch {
		// already exists
	}
	try {
		_db.exec("ALTER TABLE runs ADD COLUMN is_recurring INTEGER DEFAULT 0");
	} catch {
		// already exists
	}
	try { _db.exec("ALTER TABLE users ADD COLUMN persona TEXT"); } catch { /* exists */ }
	try { _db.exec("ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'es'"); } catch { /* exists */ }
	try { _db.exec("ALTER TABLE users ADD COLUMN interests TEXT"); } catch { /* exists */ }
	try { _db.exec("ALTER TABLE users ADD COLUMN dislikes TEXT"); } catch { /* exists */ }
	try { _db.exec("ALTER TABLE users ADD COLUMN communication_style TEXT"); } catch { /* exists */ }
	try { _db.exec("ALTER TABLE users ADD COLUMN tone_preference TEXT"); } catch { /* exists */ }
	try { _db.exec("ALTER TABLE users ADD COLUMN interaction_count INTEGER DEFAULT 0"); } catch { /* exists */ }
	try { _db.exec("ALTER TABLE users ADD COLUMN last_topics TEXT"); } catch { /* exists */ }
	try { _db.exec("ALTER TABLE users ADD COLUMN average_sentiment REAL DEFAULT 0.5"); } catch { /* exists */ }
	try { _db.exec("ALTER TABLE users ADD COLUMN model_preference TEXT"); } catch { /* exists */ }
	try { _db.exec("ALTER TABLE users ADD COLUMN metadata TEXT"); } catch { /* exists */ }
	// Populate FTS with existing messages (safe to run multiple times)
	try {
		_db.exec(`
			INSERT OR IGNORE INTO messages_fts (id, content, role, chatId, userId)
			SELECT id, content, role, chatId, userId FROM messages
			WHERE id NOT IN (SELECT id FROM messages_fts)
		`);
	} catch { /* FTS may not be available or already populated */ }
	try {
		_db.exec(`
			CREATE TABLE IF NOT EXISTS message_feedback (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				userId TEXT NOT NULL,
				chatId TEXT NOT NULL,
				messageId INTEGER,
				rating TEXT NOT NULL CHECK(rating IN ('up', 'down')),
				reason TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
			CREATE INDEX IF NOT EXISTS idx_feedback_userId ON message_feedback(userId);
			CREATE INDEX IF NOT EXISTS idx_feedback_chatId ON message_feedback(chatId);
			CREATE INDEX IF NOT EXISTS idx_feedback_rating ON message_feedback(rating);
		`);
	} catch { /* ignore */ }

	try {
		_db.exec(`
			CREATE TABLE IF NOT EXISTS workspace_context (
				userId TEXT PRIMARY KEY,
				project TEXT,
				last_file TEXT,
				last_directory TEXT,
				open_files TEXT,
				tags TEXT,
				metadata TEXT,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
		`);
	} catch { /* ignore */ }

	try {
		_db.exec(`
			CREATE TABLE IF NOT EXISTS saved_messages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				userId TEXT NOT NULL,
				chatId TEXT NOT NULL,
				messageRole TEXT NOT NULL,
				messageContent TEXT NOT NULL,
				messageTimestamp TEXT,
				notes TEXT DEFAULT '',
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(userId, chatId, messageRole, messageContent(100))
			);
			CREATE INDEX IF NOT EXISTS idx_saved_messages_userId ON saved_messages(userId);
		`);
	} catch {
		/* ignore */
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
