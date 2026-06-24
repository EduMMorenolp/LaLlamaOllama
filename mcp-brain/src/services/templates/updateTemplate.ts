import type { DatabaseService } from "../../database/connection.js";
import type { Template, TemplateVariable } from "./types.js";

export interface UpdateTemplateInput {
	name?: string;
	description?: string;
	content?: string;
	variables?: TemplateVariable[];
	output_path?: string;
}

export async function updateTemplate(
	dbService: DatabaseService,
	id: string,
	input: UpdateTemplateInput,
): Promise<Template | null> {
	const db = dbService.getDb();
	const now = Date.now();

	const fields: string[] = [];
	const params: unknown[] = [];

	if (input.name !== undefined) {
		fields.push("name = ?");
		params.push(input.name);
	}
	if (input.description !== undefined) {
		fields.push("description = ?");
		params.push(input.description);
	}
	if (input.content !== undefined) {
		fields.push("content = ?");
		params.push(input.content);
	}
	if (input.variables !== undefined) {
		fields.push("variables = ?");
		params.push(JSON.stringify(input.variables));
	}
	if (input.output_path !== undefined) {
		fields.push("output_path = ?");
		params.push(input.output_path);
	}

	if (fields.length === 0) return null;

	fields.push("updated_at = ?");
	params.push(now);
	params.push(id);

	await dbService.enqueueWrite(async () => {
		await db.run(
			`UPDATE templates SET ${fields.join(", ")} WHERE id = ?`,
			...params,
		);
	});

	const row = await db.get(`SELECT * FROM templates WHERE id = ?`, [id]);
	if (!row) return null;
	return {
		...row,
		variables: JSON.parse(
			(row.variables as string) || "[]",
		) as TemplateVariable[],
		is_seed: Boolean(row.is_seed),
	} as Template;
}

export async function deleteTemplate(
	dbService: DatabaseService,
	id: string,
): Promise<{ deleted: boolean; protected: boolean }> {
	const db = dbService.getDb();

	const row = await db.get(`SELECT is_seed FROM templates WHERE id = ?`, [id]);
	if (!row) return { deleted: false, protected: false };
	if (row.is_seed) return { deleted: false, protected: true };

	let changes = 0;
	await dbService.enqueueWrite(async () => {
		const res = await db.run(`DELETE FROM templates WHERE id = ?`, [id]);
		changes = res.changes || 0;
	});

	return { deleted: changes > 0, protected: false };
}
