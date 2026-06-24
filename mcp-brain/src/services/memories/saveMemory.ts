import type { DatabaseService } from "../../database/connection.js";
import logger from "../../utils/logger.js";
import { cosineSimilarity, embed } from "../llm/index.js";
import type { Memory } from "../types.js";
import { getMemory } from "./getMemory.js";
import { updateMemory } from "./updateMemory.js";

const log = logger.child({ component: "memory-service" });

interface MemoryCandidate {
    judgment_id: string;
    score: number;
    memory: Record<string, unknown>;
}

const MAX_CONTENT_LENGTH = 1000;

export async function saveMemory(
	dbService: DatabaseService,
	project: string,
	type: string,
	title: string,
	content: string,
	tags?: string,
	sessionId?: string,
	topicKey?: string,
	phase?: string,
	agent?: string,
): Promise<{
	memory: Memory;
	judgment_required: boolean;
	candidates?: MemoryCandidate[];
}> {
	const db = dbService.getDb();

	// Truncate content to save tokens in storage and embeddings
	if (content && content.length > MAX_CONTENT_LENGTH) {
		content =
			content.slice(0, MAX_CONTENT_LENGTH) +
			`\n\n[...truncated from ${content.length} chars]`;
	}

	if (topicKey) {
		const existing = await db.get(
			`SELECT id FROM memories WHERE project = ? AND topic_key = ? ORDER BY createdAt DESC LIMIT 1`,
			[project, topicKey],
		);
		if (existing) {
			await updateMemory(
				dbService,
				existing.id,
				title,
				content,
				tags,
				topicKey,
			);
			const memory = await getMemory(dbService, existing.id);
			if (!memory) {
				throw new Error("Memory not found after create/update");
			}
			return { memory, judgment_required: false };
		}
	}

    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    let vectorJson: string | null = null;
    let queryVector: number[] = [];
    try {
        const embeddings = await embed(`${title}\n${content}`);
        if (embeddings && embeddings.length > 0) {
            queryVector = embeddings[0];
            vectorJson = JSON.stringify(queryVector);
        }
    } catch (_err) {
        log.warn("Could not generate embeddings");
    }

	await dbService.enqueueWrite(async () => {
		await db.run(
			`INSERT INTO memories (id, project, type, title, content, tags, sessionId, vector, topic_key, phase, agent, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				project,
				type,
				title,
				content,
				tags || "",
				sessionId || null,
				vectorJson,
				topicKey || null,
				phase || null,
				agent || null,
				now,
				now,
			],
		);
	});

    let judgment_required = false;
    const candidates: MemoryCandidate[] = [];

	if (queryVector.length > 0 && type !== "prompt") {
		// Load only the most recent 200 memories for similarity check to prevent OOM
		const recentRows = await db.all(
			`SELECT id, project, type, title, content, tags, vector, createdAt, updatedAt 
             FROM memories WHERE project = ? AND vector IS NOT NULL AND id != ?
             ORDER BY createdAt DESC LIMIT 200`,
			[project, id],
		);
		for (const row of recentRows) {
			const vec: number[] = JSON.parse(row.vector);
			const score = cosineSimilarity(queryVector, vec);
			if (score > 0.85) {
				candidates.push({
					judgment_id: `${id}:${row.id}`,
					score,
					memory: { ...row, vector: undefined },
				});
			}
		}
		if (candidates.length > 0) {
			candidates.sort((a, b) => b.score - a.score);
			// Keep only top 5 candidates
			candidates.splice(5);
			judgment_required = true;
		}
	}

    const memory = {
        id,
        project,
        type,
        title,
        content,
        tags: tags || "",
        sessionId,
        phase,
        agent,
        createdAt: now,
        updatedAt: now,
    };
    return { memory, judgment_required, candidates };
}
