import { getDb } from "./connection.js";

export interface ScheduledTask {
	id: number;
	name: string;
	cron_expression: string;
	task_text: string;
	mode_id: string | null;
	origin: string;
	schedule_type: string;
	enabled: number;
	last_run_at: string | null;
	next_run_at: string | null;
	created_at: string;
}

export function listScheduledTasks(): ScheduledTask[] {
	const db = getDb();
	return db.prepare("SELECT * FROM scheduled_tasks ORDER BY name ASC").all() as ScheduledTask[];
}

export function getScheduledTask(id: number): ScheduledTask | undefined {
	const db = getDb();
	return db.prepare("SELECT * FROM scheduled_tasks WHERE id = ?").get(id) as ScheduledTask | undefined;
}

export function createScheduledTask(input: { name: string; cron_expression: string; task_text: string; mode_id?: string }): number {
	const db = getDb();
	const result = db.prepare(
		`INSERT INTO scheduled_tasks (name, cron_expression, task_text, mode_id)
		 VALUES (?, ?, ?, ?)`
	).run(input.name, input.cron_expression, input.task_text, input.mode_id || null);
	return Number(result.lastInsertRowid);
}

export function updateScheduledTask(id: number, patch: Partial<ScheduledTask>): void {
	const db = getDb();
	const updates: string[] = [];
	const values: Array<string | number | null> = [];
	const allowed = ["name", "cron_expression", "task_text", "mode_id", "enabled", "last_run_at", "next_run_at"];
	for (const key of allowed) {
		if ((patch as any)[key] !== undefined) {
			updates.push(`${key} = ?`);
			values.push((patch as any)[key]);
		}
	}
	if (updates.length === 0) return;
	values.push(id);
	db.prepare(`UPDATE scheduled_tasks SET ${updates.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteScheduledTask(id: number): void {
	const db = getDb();
	db.prepare("DELETE FROM scheduled_tasks WHERE id = ?").run(id);
}

export function toggleScheduledTask(id: number): void {
	const db = getDb();
	db.prepare("UPDATE scheduled_tasks SET enabled = CASE WHEN enabled THEN 0 ELSE 1 END WHERE id = ?").run(id);
}

export function getDueTasks(): ScheduledTask[] {
	const db = getDb();
	return db.prepare(
		"SELECT * FROM scheduled_tasks WHERE enabled = 1 AND (next_run_at IS NULL OR next_run_at <= datetime('now'))"
	).all() as ScheduledTask[];
}
