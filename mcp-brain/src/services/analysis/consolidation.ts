import type { DatabaseService } from "../../database/connection.js";
import { generate } from "../llm/generate.js";
import { deleteMemory } from "../memories/deleteMemory.js";
import { saveMemory } from "../memories/saveMemory.js";
import { getGlobalSetting } from "../settings/index.js";
import logger from "../../utils/logger.js";

const log = logger.child({ component: "consolidation" });

export async function consolidateMemories(
	dbService: DatabaseService,
	project: string,
	customModel?: string
): Promise<{ consolidatedGroups: number; deletedMemories: number }> {
	const db = dbService.getDb();
	const model = customModel || (await getGlobalSetting(dbService, "consolidation_model", "llama3.2"));

	const allMemories = await db.all(
		`SELECT id, title, content, tags, topic_key FROM memories WHERE project = ? ORDER BY createdAt ASC`,
		[project]
	);

	interface MemoryRecord {
		id: string;
		title: string;
		content: string;
		tags: string;
		topic_key: string;
	}

	// Group by topic_key or primary tag
	const groups: Record<string, MemoryRecord[]> = {};
	for (const mem of allMemories) {
		let key = mem.topic_key;
		if (!key && mem.tags) {
			key = mem.tags.split(",")[0].trim();
		}
		if (!key) key = "general";

		if (!groups[key]) groups[key] = [];
		groups[key].push(mem);
	}

	let consolidatedGroups = 0;
	let deletedMemories = 0;

	for (const [topic, mems] of Object.entries(groups)) {
		if (mems.length > 3) {
			const prompt = `Estás consolidando y limpiando la base de conocimiento de un asistente de IA para el proyecto "${project}" sobre el tema "${topic}".
A continuación se muestran varias memorias individuales recopiladas a lo largo del tiempo.
Resume de forma experta y exhaustiva todos los aprendizajes clave, decisiones y hechos en una única memoria clara y coherente. No pierdas detalles técnicos importantes.

Memorias a consolidar:
${mems.map((m, i) => `[Memoria ${i + 1}: ${m.title}]\n${m.content}`).join("\n\n---\n\n")}

Devuelve únicamente el contenido consolidado en formato Markdown, listo para ser almacenado como un "Key Learning".`;

			try {
				const summary = await generate(model, prompt);
				if (summary && summary.trim().length > 50) {
					// Save new consolidated memory
					const title = `[Consolidado] Aprendizajes sobre ${topic}`;
					await saveMemory(
						dbService,
						project,
						"learning",
						title,
						summary.trim(),
						topic,
						undefined,
						topic,
						"review"
					);

					// Delete old memories
					for (const m of mems) {
						await deleteMemory(dbService, m.id);
						deletedMemories++;
					}
					consolidatedGroups++;
				}
			} catch (err) {
				log.error({ err, topic }, "Error consolidating memories");
			}
		}
	}

	return { consolidatedGroups, deletedMemories };
}
