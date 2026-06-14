import { getDb } from "./connection.js";

export interface StoredRun {
	id: number;
	chatId: string;
	userText: string;
	origin: string;
	status: string;
	model?: string | null;
	resultText?: string | null;
	errorText?: string | null;
	latencyMs?: number | null;
	priority?: string;
	preferred_model?: string | null;
	tags?: string | null;
	due_date?: string | null;
	description?: string | null;
	scheduled_at?: string | null;
	created_at?: string;
	updated_at?: string;
}

export interface RunEventRecord {
	id?: number;
	runId: number;
	type: string;
	payload: string;
	created_at?: string;
}

export function createRun(input: {
	chatId: string;
	userText: string;
	origin?: string;
	status?: string;
	priority?: string;
	preferredModel?: string;
	tags?: string;
	dueDate?: string;
	description?: string;
	scheduledAt?: string;
}): number {
	const db = getDb();
	const result = db
		.prepare(
			`INSERT INTO runs (chatId, userText, origin, status, priority, preferred_model, tags, due_date, description, scheduled_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			input.chatId,
			input.userText,
			input.origin || "web",
			input.status || "queued",
			input.priority || "medium",
			input.preferredModel || null,
			input.tags || null,
			input.dueDate || null,
			input.description || null,
			input.scheduledAt || null
		);

	return Number(result.lastInsertRowid);
}

export function updateRun(
	runId: number,
	patch: {
		status?: string;
		model?: string;
		resultText?: string | null;
		errorText?: string | null;
		latencyMs?: number | null;
		priority?: string;
		preferredModel?: string | null;
		tags?: string | null;
		dueDate?: string | null;
		description?: string | null;
		scheduledAt?: string | null;
		userText?: string;
	}
): void {
	const db = getDb();
	const updates: string[] = [];
	const values: Array<string | number | null> = [];

	if (patch.userText !== undefined) {
		updates.push("userText = ?");
		values.push(patch.userText);
	}
	if (patch.status !== undefined) {
		updates.push("status = ?");
		values.push(patch.status);
	}
	if (patch.model !== undefined) {
		updates.push("model = ?");
		values.push(patch.model);
	}
	if (patch.resultText !== undefined) {
		updates.push("resultText = ?");
		values.push(patch.resultText);
	}
	if (patch.errorText !== undefined) {
		updates.push("errorText = ?");
		values.push(patch.errorText);
	}
	if (patch.latencyMs !== undefined) {
		updates.push("latencyMs = ?");
		values.push(patch.latencyMs);
	}
	if (patch.priority !== undefined) {
		updates.push("priority = ?");
		values.push(patch.priority);
	}
	if (patch.preferredModel !== undefined) {
		updates.push("preferred_model = ?");
		values.push(patch.preferredModel);
	}
	if (patch.tags !== undefined) {
		updates.push("tags = ?");
		values.push(patch.tags);
	}
	if (patch.dueDate !== undefined) {
		updates.push("due_date = ?");
		values.push(patch.dueDate);
	}
	if (patch.description !== undefined) {
		updates.push("description = ?");
		values.push(patch.description);
	}
	if (patch.scheduledAt !== undefined) {
		updates.push("scheduled_at = ?");
		values.push(patch.scheduledAt);
	}

	if (updates.length === 0) {
		return;
	}

	updates.push("updated_at = CURRENT_TIMESTAMP");
	values.push(runId);
	db.prepare(`UPDATE runs SET ${updates.join(", ")} WHERE id = ?`).run(...values);
}

export function appendRunEvent(event: RunEventRecord): number {
	const db = getDb();
	const result = db
		.prepare(
			`INSERT INTO run_events (runId, type, payload)
			 VALUES (?, ?, ?)`
		)
		.run(event.runId, event.type, event.payload);

	return Number(result.lastInsertRowid);
}

export function getRun(runId: number): StoredRun | undefined {
	const db = getDb();
	return db.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as StoredRun | undefined;
}

export function listRuns(limit = 20): StoredRun[] {
	const db = getDb();
	return db.prepare("SELECT * FROM runs ORDER BY created_at DESC LIMIT ?").all(limit) as StoredRun[];
}

export function listRunsByFilters(filters: { status?: string; origin?: string; limit?: number; offset?: number }): StoredRun[] {
	const db = getDb();
	const conditions: string[] = [];
	const params: Array<string | number> = [];

	if (filters.status) {
		conditions.push("status = ?");
		params.push(filters.status);
	}
	if (filters.origin) {
		conditions.push("origin = ?");
		params.push(filters.origin);
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
	const limit = filters.limit ?? 50;
	const offset = filters.offset ?? 0;

	return db
		.prepare(`SELECT * FROM runs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
		.all(...params, limit, offset) as StoredRun[];
}

export function getRunEvents(runId: number): RunEventRecord[] {
	const db = getDb();
	return db.prepare("SELECT * FROM run_events WHERE runId = ? ORDER BY id ASC").all(runId) as RunEventRecord[];
}

export function cancelRun(runId: number): void {
	const db = getDb();
	db.prepare("UPDATE runs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(runId);
}
