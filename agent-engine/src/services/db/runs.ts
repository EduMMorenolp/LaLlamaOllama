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
}): number {
	const db = getDb();
	const result = db
		.prepare(
			`INSERT INTO runs (chatId, userText, origin, status)
			 VALUES (?, ?, ?, ?)`
		)
		.run(input.chatId, input.userText, input.origin || "web", input.status || "queued");

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
	}
): void {
	const db = getDb();
	const updates: string[] = [];
	const values: Array<string | number | null> = [];

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
	return db
		.prepare("SELECT * FROM runs ORDER BY created_at DESC LIMIT ?")
		.all(limit) as StoredRun[];
}
