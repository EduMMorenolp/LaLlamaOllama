import type { DatabaseService } from "../../database/connection.js";

export async function getCoreDirectives(
	dbService: DatabaseService,
	project: string,
): Promise<string> {
	const db = dbService.getDb();
	const row = await db.get(
		`SELECT content FROM core_directives WHERE project = ?`,
		[project],
	);

	const criticalRule = `
	# [!IMPORTANT]
	**OBLIGACIÓN COGNITIVA CRÍTICA (MEMORIA AUTÓNOMA):** Cada vez que utilices tus herramientas para modificar, crear o refactorizar código en este proyecto, TIENES LA OBLIGACIÓN ESTRICTA Y OBLIGATORIA de ejecutar en ese mismo turno la herramienta \`mem_save\`, documentando el resumen exacto de las decisiones técnicas y cambios realizados antes de emitir tu respuesta final al usuario. SIEMPRE debes incluir tu identidad en el parámetro \`agent\` (ej. 'Cursor / Claude 3.5 Sonnet', 'Antigravity / Gemini 2.5 Flash', 'OpenCode AI', 'RooCode / Cline'). Omitir este guardado es inaceptable.`;

	if (row?.content) {
		if (!row.content.includes("OBLIGACIÓN COGNITIVA CRÍTICA")) {
			return row.content + criticalRule;
		}
		return row.content;
	}

	return `# Directivas Centrales: ${project}\n1. **Arquitectura Limpia:** Mantén el código modular y desacoplado.\n2. **Spec-Driven Development (SDD):** Evalúa e indica siempre la fase activa (exploración, diseño, implementación, revisión).\n3. **Transparencia:** Registra los aprendizajes clave en la memoria pasiva para evitar redundancia.\n${criticalRule}`;
}

export async function updateCoreDirectives(
	dbService: DatabaseService,
	project: string,
	content: string,
): Promise<boolean> {
	const db = dbService.getDb();
	const now = Date.now();
	await dbService.enqueueWrite(async () => {
		await db.run(
			`INSERT INTO core_directives (project, content, updatedAt) VALUES (?, ?, ?)
			 ON CONFLICT(project) DO UPDATE SET content = ?, updatedAt = ?`,
			[project, content, now, content, now],
		);
	});
	return true;
}

export async function getGlobalSetting(
	dbService: DatabaseService,
	key: string,
	defaultValue: string = "",
): Promise<string> {
	const db = dbService.getDb();
	const row = await db.get(`SELECT value FROM global_settings WHERE key = ?`, [
		key,
	]);
	return row ? row.value : defaultValue;
}

export async function updateGlobalSetting(
	dbService: DatabaseService,
	key: string,
	value: string,
): Promise<boolean> {
	const db = dbService.getDb();
	const now = Date.now();
	await dbService.enqueueWrite(async () => {
		await db.run(
			`INSERT INTO global_settings (key, value, updatedAt) VALUES (?, ?, ?)
			 ON CONFLICT(key) DO UPDATE SET value = ?, updatedAt = ?`,
			[key, value, now, value, now],
		);
	});
	return true;
}
