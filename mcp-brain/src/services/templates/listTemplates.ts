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

export async function listTemplates(
	dbService: DatabaseService,
	tool?: string,
	type?: string,
): Promise<Template[]> {
	const db = dbService.getDb();
	const conditions: string[] = [];
	const params: string[] = [];

	if (tool) {
		conditions.push("tool = ?");
		params.push(tool);
	}
	if (type) {
		conditions.push("type = ?");
		params.push(type);
	}

	const where =
		conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
	const rows = await db.all(
		`SELECT * FROM templates ${where} ORDER BY tool, type, name`,
		params,
	);
	return rows.map(parseTemplate);
}
