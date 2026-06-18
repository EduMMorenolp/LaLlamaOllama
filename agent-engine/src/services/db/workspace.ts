import { getDb } from "./connection.js";

export interface WorkspaceContext {
	userId: string;
	project: string | null;
	last_file: string | null;
	last_directory: string | null;
	open_files: string | null;
	tags: string | null;
	metadata: string | null;
	updated_at: string;
}

export function getWorkspaceContext(userId: string): WorkspaceContext | null {
	const db = getDb();
	return db.prepare("SELECT * FROM workspace_context WHERE userId = ?").get(userId) as WorkspaceContext | null;
}

export function upsertWorkspaceContext(
	userId: string,
	data: Partial<Omit<WorkspaceContext, "userId" | "updated_at">>
): void {
	const db = getDb();
	const existing = getWorkspaceContext(userId);
	const now = new Date().toISOString();

	if (existing) {
		const keys = Object.keys(data) as (keyof typeof data)[];
		if (keys.length === 0) return;
		const setClause = [...keys.map((k) => `${String(k)} = ?`), "updated_at = ?"].join(", ");
		const values = [...keys.map((k) => data[k]), now, userId];
		db.prepare(`UPDATE workspace_context SET ${setClause} WHERE userId = ?`).run(...values);
	} else {
		const cols = ["userId", ...Object.keys(data), "updated_at"];
		const placeholders = cols.map(() => "?").join(", ");
		const values = [userId, ...Object.keys(data).map((k) => (data as Record<string, unknown>)[k] ?? null), now];
		db.prepare(`INSERT INTO workspace_context (${cols.join(", ")}) VALUES (${placeholders})`).run(...values);
	}
}

export function trackFileAccess(userId: string, filePath: string): void {
	const ctx = getWorkspaceContext(userId);
	const dir = filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/")) : ".";
	let openFiles: string[] = [];
	if (ctx?.open_files) {
		try { openFiles = JSON.parse(ctx.open_files); } catch { openFiles = []; }
	}
	openFiles = [filePath, ...openFiles.filter((f) => f !== filePath)].slice(0, 10);

	upsertWorkspaceContext(userId, {
		last_file: filePath,
		last_directory: dir,
		open_files: JSON.stringify(openFiles),
	});
}

export function formatWorkspaceForPrompt(ctx: WorkspaceContext): string {
	const lines: string[] = [];
	if (ctx.project) lines.push(`Proyecto: ${ctx.project}`);
	if (ctx.last_file) lines.push(`Último archivo accedido: ${ctx.last_file}`);
	if (ctx.last_directory) lines.push(`Último directorio: ${ctx.last_directory}`);
	if (ctx.open_files) {
		try {
			const files = JSON.parse(ctx.open_files) as string[];
			if (files.length > 0) lines.push(`Archivos recientes: ${files.join(", ")}`);
		} catch { /* ignore */ }
	}
	if (ctx.tags) {
		try {
			const tags = JSON.parse(ctx.tags) as string[];
			if (tags.length > 0) lines.push(`Tags: ${tags.join(", ")}`);
		} catch { lines.push(`Tags: ${ctx.tags}`); }
	}
	return lines.length > 0 ? lines.join("\n") : "";
}
