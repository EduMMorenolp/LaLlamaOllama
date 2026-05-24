import type { DatabaseService } from "../../database/connection.js";

const VALID_RELATIONS = [
    "related",
    "compatible",
    "scoped",
    "conflicts_with",
    "supersedes",
    "not_conflict",
] as const;

export async function judge(
    dbService: DatabaseService,
    judgmentId: string,
    relation: string,
    reason?: string
): Promise<boolean> {
    if (!VALID_RELATIONS.includes(relation as typeof VALID_RELATIONS[number])) {
        throw new Error("Invalid relation \"" + relation + "\". Valid values: " + VALID_RELATIONS.join(", "));
    }
    const parts = judgmentId.split(":");
    if (parts.length !== 2) return false;
    const [sourceId, targetId] = parts;
    const db = dbService.getDb();
    const id = "rel_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);

    await dbService.enqueueWrite(async () => {
        await db.run(
            "INSERT INTO relations (id, sourceId, targetId, relation, reason, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
            [id, sourceId, targetId, relation, reason || "", Date.now()]
        );
    });
    return true;
}
