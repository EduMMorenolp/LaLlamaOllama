import { getDb } from "./connection.js";

export interface CustomToolRow {
	name: string;
	description: string;
	parameters: string; // JSON Schema string
	handler_type: "bash" | "prompt" | "http";
	handler_config: string; // JSON string
	created_by: string;
	created_at: string;
	updated_at: string;
}

export interface CustomToolInput {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
	handler_type: "bash" | "prompt" | "http";
	handler_config: Record<string, unknown>;
	created_by?: string;
}

const MAX_CUSTOM_TOOLS = 50;

export function listCustomTools(): CustomToolRow[] {
	const db = getDb();
	return db.prepare("SELECT * FROM custom_tools ORDER BY created_at ASC").all() as CustomToolRow[];
}

export function getCustomTool(name: string): CustomToolRow | null {
	const db = getDb();
	return (db.prepare("SELECT * FROM custom_tools WHERE name = ?").get(name) as CustomToolRow | undefined) || null;
}

export function upsertCustomTool(input: CustomToolInput): CustomToolRow {
	const db = getDb();
	const existing = getCustomTool(input.name);

	// Validate: if new, check limit
	if (!existing) {
		const count = db.prepare("SELECT COUNT(*) as count FROM custom_tools").get() as { count: number };
		if (count.count >= MAX_CUSTOM_TOOLS) {
			throw new Error(`Límite de ${MAX_CUSTOM_TOOLS} herramientas personalizadas alcanzado. Elimina alguna antes de crear otra.`);
		}
	}

	const now = new Date().toISOString();
	const parameters = typeof input.parameters === "string" ? input.parameters : JSON.stringify(input.parameters);
	const handlerConfig = typeof input.handler_config === "string" ? input.handler_config : JSON.stringify(input.handler_config);

	if (existing) {
		db.prepare(`
			UPDATE custom_tools
			SET description = ?, parameters = ?, handler_type = ?, handler_config = ?, updated_at = ?
			WHERE name = ?
		`).run(input.description, parameters, input.handler_type, handlerConfig, now, input.name);
	} else {
		db.prepare(`
			INSERT INTO custom_tools (name, description, parameters, handler_type, handler_config, created_by, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run(input.name, input.description, parameters, input.handler_type, handlerConfig, input.created_by || "", now, now);
	}

	return getCustomTool(input.name)!;
}

export function deleteCustomTool(name: string): boolean {
	const db = getDb();
	const result = db.prepare("DELETE FROM custom_tools WHERE name = ?").run(name);
	return result.changes > 0;
}

export function getCustomToolsCount(): number {
	const db = getDb();
	const row = db.prepare("SELECT COUNT(*) as count FROM custom_tools").get() as { count: number };
	return row.count;
}
