import type { DatabaseService } from "../../database/connection.js";
import { cosineSimilarity, embed } from "../llm/index.js";
import { getGlobalSetting } from "../settings/index.js";
import type { Memory } from "../types.js";

// Embedding cache with 5-minute TTL
interface EmbeddingCacheEntry {
	vector: number[];
	timestamp: number;
}

const embeddingCache = new Map<string, EmbeddingCacheEntry>();
const EMBEDDING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Periodically clean expired entries
setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of embeddingCache.entries()) {
		if (now - entry.timestamp > EMBEDDING_CACHE_TTL) {
			embeddingCache.delete(key);
		}
	}
}, 60 * 1000); // Clean every minute

async function getEmbeddingWithCache(text: string): Promise<number[]> {
	const now = Date.now();
	const cached = embeddingCache.get(text);
	if (cached && (now - cached.timestamp) < EMBEDDING_CACHE_TTL) {
		return cached.vector;
	}
	const emb = await embed(text);
	if (emb && emb.length > 0) {
		const vector = emb[0];
		embeddingCache.set(text, { vector, timestamp: now });
		return vector;
	}
	return [];
}

const searchHistory = new Map<string, number[]>();

export async function searchMemories(
	dbService: DatabaseService,
	query: string,
	project: string,
	mode: "lexical" | "semantic" | "hybrid" = "hybrid",
	limit: number = 10
): Promise<Memory[]> {
	const db = dbService.getDb();
	const now = Date.now();

	// Delegation Triggers Tracking
	const historyKey = `${project}:${query.trim().toLowerCase()}`;
	const timestamps = searchHistory.get(historyKey) || [];
	const recentTimestamps = timestamps.filter((t) => now - t < 5 * 60 * 1000); // last 5 mins
	recentTimestamps.push(now);
	searchHistory.set(historyKey, recentTimestamps);

	const thresholdStr = await getGlobalSetting(dbService, "delegation_threshold", "3");
	const threshold = parseInt(thresholdStr, 10) || 3;

	let warningMemory: Memory | null = null;
	if (recentTimestamps.length > threshold) {
		warningMemory = {
			id: "WARNING_DELEGATION",
			project,
			type: "system_alert",
			title: "⚠️ Advertencia del Sistema: Búsqueda Repetitiva Estancada",
			content: `Has consultado la misma información ("${query}") más de ${threshold} veces en los últimos 5 minutos sin registrar avances. 
DIRECTIVA DE DELEGACIÓN: Detén la búsqueda actual. Evalúa cambiar de fase SDD (ej. de implementación a exploración o revisión), sintetiza lo que sabes hasta ahora con mem_session_summary, o pide aclaración al usuario.`,
			tags: "system,alert,delegation",
			phase: "review",
			createdAt: now,
			updatedAt: now,
		};
	}

	let results: Memory[] = [];

	if (mode === "lexical") {
		const rows = await db.all(
			`SELECT m.id, m.project, m.type, m.title, m.content, m.tags, m.phase, m.agent, m.createdAt, m.updatedAt 
             FROM memories_fts f 
             JOIN memories m ON f.id = m.id 
             WHERE f.memories_fts MATCH ? AND m.project = ? 
             ORDER BY rank LIMIT ?`,
			[`"${query}"*`, project, limit]
		);
		results = rows as Memory[];
	} else if (mode === "semantic" || mode === "hybrid") {
		let queryVector: number[] = [];
		try {
			queryVector = await getEmbeddingWithCache(query);
		} catch (err) {
			console.error("[MemoryService] Semantic search failed. Falling back to lexical.", err);
			if (mode === "hybrid") return searchMemories(dbService, query, project, "lexical", limit);
			return [];
		}

		if (queryVector.length > 0) {
			const allRows = await db.all(
				`SELECT id, project, type, title, content, tags, vector, phase, agent, createdAt, updatedAt 
                 FROM memories WHERE project = ? AND vector IS NOT NULL`,
				[project]
			);

			const semanticResults = allRows.map(
				(row: {
					id: string;
					project: string;
					type: string;
					title: string;
					content: string;
					tags: string;
					vector: string;
					phase: string | null;
					agent: string | null;
					createdAt: number;
					updatedAt: number;
				}) => {
					const vec: number[] = JSON.parse(row.vector);
					const score = cosineSimilarity(queryVector, vec);
					return { ...row, vector: undefined, score } as Memory;
				}
			);

			semanticResults.sort((a, b) => (b.score || 0) - (a.score || 0));
			results = semanticResults.slice(0, limit);
		}
	}

	if (warningMemory) {
		return [warningMemory, ...results];
	}

	return results;
}
