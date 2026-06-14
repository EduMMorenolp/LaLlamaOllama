import type { DatabaseService } from "../../database/connection.js";
import { embed } from "../llm/index.js";
import { getMemory } from "./getMemory.js";

export async function updateMemory(
	dbService: DatabaseService,
	id: string,
	title?: string,
	content?: string,
	tags?: string,
	topicKey?: string,
	phase?: string,
	type?: string
): Promise<boolean> {
	const db = dbService.getDb();
	const memory = await getMemory(dbService, id);
	if (!memory) return false;

	const newTitle = title || memory.title;
	const newContent = content || memory.content;
	const newTags = tags !== undefined ? tags : memory.tags;
	const newTopicKey = topicKey !== undefined ? topicKey : (memory as { topic_key?: string }).topic_key;
	const newPhase = phase !== undefined ? phase : memory.phase;
	const newType = type !== undefined ? type : memory.type;
	const now = Date.now();

	let vectorJson: string | null = null;
	if (title || content) {
		try {
			const embeddings = await embed(`${newTitle}\n${newContent}`);
			if (embeddings && embeddings.length > 0) {
				vectorJson = JSON.stringify(embeddings[0]);
			}
		} catch (_err) {}
	}

	await dbService.enqueueWrite(async () => {
		if (vectorJson) {
			await db.run(
				`UPDATE memories SET type = ?, title = ?, content = ?, tags = ?, vector = ?, topic_key = ?, phase = ?, updatedAt = ? WHERE id = ?`,
				[newType, newTitle, newContent, newTags, vectorJson, newTopicKey, newPhase, now, id]
			);
		} else {
			await db.run(
				`UPDATE memories SET type = ?, title = ?, content = ?, tags = ?, topic_key = ?, phase = ?, updatedAt = ? WHERE id = ?`,
				[newType, newTitle, newContent, newTags, newTopicKey, newPhase, now, id]
			);
		}
	});
	return true;
}
