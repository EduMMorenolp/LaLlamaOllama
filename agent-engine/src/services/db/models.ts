import { getDb } from "./connection.js";

export interface ModelEntry {
	name: string;
	displayName?: string;
	apiKey?: string;
	baseUrl?: string;
	created_at?: string;
}

export function getModel(name: string): ModelEntry | null {
	const db = getDb();
	return (db.prepare("SELECT * FROM models WHERE name = ?").get(name) as ModelEntry | undefined) || null;
}

export function upsertModel(model: ModelEntry): void {
	const db = getDb();
	db.prepare(
		`INSERT INTO models (name, displayName, apiKey, baseUrl)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT(name) DO UPDATE SET
		   displayName = excluded.displayName,
		   apiKey = excluded.apiKey,
		   baseUrl = excluded.baseUrl`
	).run(model.name, model.displayName || null, model.apiKey || null, model.baseUrl || null);
}

export function listModels(): ModelEntry[] {
	const db = getDb();
	return db.prepare("SELECT * FROM models ORDER BY name ASC").all() as ModelEntry[];
}

export function deleteModel(name: string): void {
	getDb().prepare("DELETE FROM models WHERE name = ?").run(name);
}
