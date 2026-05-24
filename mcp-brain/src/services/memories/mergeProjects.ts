import type { DatabaseService } from "../../database/connection.js";

export interface MergeProjectsResult {
    success: boolean;
    movedMemories: number;
    movedDirectives: number;
    movedSessions: number;
    deletedSource: boolean;
}

export async function mergeProjects(
    dbService: DatabaseService,
    source: string,
    target: string
): Promise<MergeProjectsResult> {
    const db = dbService.getDb();

    let movedMemories = 0;
    let movedDirectives = 0;
    let movedSessions = 0;

    await dbService.enqueueWrite(async () => {
        // 1. Update memories
        const memResult = await db.run(
            "UPDATE memories SET project = ? WHERE project = ?",
            [target, source]
        );
        movedMemories = memResult.changes || 0;

        // 2. Update core_directives
        const existingTarget = await db.get(
            "SELECT content FROM core_directives WHERE project = ?",
            [target]
        );
        const existingSource = await db.get(
            "SELECT content FROM core_directives WHERE project = ?",
            [source]
        );

        if (existingSource) {
            if (existingTarget) {
                // Merge: append source content to target
                const mergedContent = existingTarget.content +
                    "\n\n--- Merged from " + source + " ---\n\n" +
                    existingSource.content;
                await db.run(
                    "UPDATE core_directives SET content = ?, updatedAt = ? WHERE project = ?",
                    [mergedContent, Date.now(), target]
                );
                // Delete source directives
                await db.run(
                    "DELETE FROM core_directives WHERE project = ?",
                    [source]
                );
                movedDirectives = 1;
            } else {
                // Rename source to target
                await db.run(
                    "UPDATE core_directives SET project = ?, updatedAt = ? WHERE project = ?",
                    [target, Date.now(), source]
                );
                movedDirectives = 1;
            }
        }

        // 3. Update sessions
        const sessResult = await db.run(
            "UPDATE sessions SET project = ? WHERE project = ?",
            [target, source]
        );
        movedSessions = sessResult.changes || 0;

        // 4. Update mcp_audit_log
        try {
            await db.run(
                "UPDATE mcp_audit_log SET project = ? WHERE project = ?",
                [target, source]
            );
        } catch {
            // Column or table may not exist - ignore
        }
    });

    // Check if source still has records
    const remainingMemories = await db.get(
        "SELECT COUNT(*) as count FROM memories WHERE project = ?",
        [source]
    );
    const remainingDirectives = await db.get(
        "SELECT COUNT(*) as count FROM core_directives WHERE project = ?",
        [source]
    );
    const remainingSessions = await db.get(
        "SELECT COUNT(*) as count FROM sessions WHERE project = ?",
        [source]
    );

    const sourceEmpty = (remainingMemories?.count || 0) === 0 &&
        (remainingDirectives?.count || 0) === 0 &&
        (remainingSessions?.count || 0) === 0;

    return {
        success: true,
        movedMemories,
        movedDirectives,
        movedSessions,
        deletedSource: sourceEmpty,
    };
}
