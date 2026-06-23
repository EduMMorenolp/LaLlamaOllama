import type { DatabaseService } from "../../database/connection.js";

export interface DeleteProjectResult {
	deletedMemories: number;
	deletedDirectives: number;
}

export async function deleteProject(
	dbService: DatabaseService,
	project: string,
): Promise<DeleteProjectResult> {
	return dbService.enqueueWrite(async () => {
		const db = dbService.getDb();
		const memoriesRes = await db.run(`DELETE FROM memories WHERE project = ?`, [
			project,
		]);
		const deletedMemories = memoriesRes.changes || 0;

		const directivesRes = await db.run(
			`DELETE FROM core_directives WHERE project = ?`,
			[project],
		);
		const deletedDirectives = directivesRes.changes || 0;

		return { deletedMemories, deletedDirectives };
	});
}
