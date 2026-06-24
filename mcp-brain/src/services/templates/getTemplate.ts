import type { DatabaseService } from "../../database/connection.js";
import type { Template, TemplateVariable } from "./types.js";

function parseTemplate(row: Record<string, unknown>): Template {
	return {
		...row,
		variables: JSON.parse(
			(row.variables as string) || "[]",
		) as TemplateVariable[],
		is_seed: Boolean(row.is_seed),
	} as Template;
}

export async function getTemplate(
	dbService: DatabaseService,
	id: string,
): Promise<Template | null> {
	const db = dbService.getDb();
	const row = await db.get(`SELECT * FROM templates WHERE id = ?`, [id]);
	return row ? parseTemplate(row) : null;
}
