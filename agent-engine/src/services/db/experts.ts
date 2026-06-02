import { getDb } from "./connection.js";

export interface SubAgent {
	name: string;
	model: string;
	system_prompt: string;
	tools: string[];
	experts: string[];
	temperature: number;
	created_at?: string;
}

export function getExpert(name: string): SubAgent | null {
	if (!name) return null;
	const db = getDb();
	const row = db.prepare("SELECT * FROM sub_agents WHERE name = ?").get(name) as
		| Record<string, unknown>
		| undefined;
	if (!row) return null;

	return {
		name: row.name as string,
		model: (row.model as string) || "",
		system_prompt: row.system_prompt as string,
		tools: JSON.parse((row.tools as string) || "[]") as string[],
		experts: JSON.parse((row.experts as string) || "[]") as string[],
		temperature: (row.temperature as number) || 0.7,
		created_at: row.created_at as string,
	};
}

export function upsertExpert(agent: SubAgent): void {
	if (!agent.name || agent.name.trim() === "") {
		throw new Error("El nombre del agente no puede estar vacío.");
	}
	const db = getDb();
	db.prepare(
		`INSERT INTO sub_agents (name, model, system_prompt, tools, experts, temperature)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(name) DO UPDATE SET
		   model = excluded.model,
		   system_prompt = excluded.system_prompt,
		   tools = excluded.tools,
		   experts = excluded.experts,
		   temperature = excluded.temperature`
	).run(
		agent.name,
		agent.model,
		agent.system_prompt,
		JSON.stringify(agent.tools || []),
		JSON.stringify(agent.experts || []),
		agent.temperature ?? 0.7
	);
}

export function listExperts(): SubAgent[] {
	const db = getDb();
	const rows = db
		.prepare("SELECT * FROM sub_agents WHERE name != '__general__' ORDER BY name ASC")
		.all() as Array<Record<string, unknown>>;

	return rows.map((row) => ({
		name: row.name as string,
		model: (row.model as string) || "",
		system_prompt: row.system_prompt as string,
		tools: JSON.parse((row.tools as string) || "[]") as string[],
		experts: JSON.parse((row.experts as string) || "[]") as string[],
		temperature: (row.temperature as number) || 0.7,
		created_at: row.created_at as string,
	}));
}

export function getGeneralConfig(): SubAgent | null {
	const db = getDb();
	const row = db.prepare("SELECT * FROM sub_agents WHERE name = '__general__'").get() as
		| Record<string, unknown>
		| undefined;
	if (!row) return null;

	return {
		name: "__general__",
		model: (row.model as string) || "",
		system_prompt: row.system_prompt as string,
		tools: JSON.parse((row.tools as string) || "[]") as string[],
		experts: JSON.parse((row.experts as string) || "[]") as string[],
		temperature: (row.temperature as number) || 0.7,
	};
}

export function deleteExpert(name: string): void {
	getDb().prepare("DELETE FROM sub_agents WHERE name = ?").run(name);
}
