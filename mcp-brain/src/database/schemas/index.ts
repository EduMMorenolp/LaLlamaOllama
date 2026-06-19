import type { Database } from "sqlite";
import type sqlite3 from "sqlite3";
import { createAuditTable } from "./audit.js";
import { createConversationTable } from "./conversation.js";
import { createMemoriesTable } from "./memories.js";
import { createRelationsTable } from "./relations.js";
import { createSessionsTable } from "./sessions.js";
import { createSettingsTable } from "./settings.js";
import { createTemplatesTable } from "./templates.js";

export async function applySchemas(db: Database<sqlite3.Database, sqlite3.Statement>) {
	await createSessionsTable(db);
	await createMemoriesTable(db);
	await createRelationsTable(db);
	await createSettingsTable(db);
	await createAuditTable(db);
	await createTemplatesTable(db);
	await createConversationTable(db);
}

