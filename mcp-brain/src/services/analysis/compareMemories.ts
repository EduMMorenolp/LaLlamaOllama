import type { DatabaseService } from "../../database/connection.js";
import { generate } from "../llm/index.js";
import { getMemory } from "../memories/index.js";

interface CompareMemoriesResult {
	analysis: string;
	memA: string;
	memB: string;
}

export async function compareMemories(
	dbService: DatabaseService,
	model: string,
	memAId: string,
	memBId: string,
): Promise<CompareMemoriesResult> {
	const memA = await getMemory(dbService, memAId);
	const memB = await getMemory(dbService, memBId);

	if (!memA || !memB) throw new Error("One or both memories not found");

	const prompt = `Compare these two memories and provide a brief analysis of their relationship, similarities, and any differences.
Memory A: [${memA.type}] ${memA.title} - ${memA.content}
Memory B: [${memB.type}] ${memB.title} - ${memB.content}
Analysis:`;
	const analysis = await generate(model, prompt, {
		temperature: 0.1,
		num_ctx: 2048,
	});
	return { analysis, memA: memA.title, memB: memB.title };
}
