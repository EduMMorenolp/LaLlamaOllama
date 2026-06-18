import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { BrainClient } from "../brain/client.js";

/**
 * List knowledge files in the workspace knowledge directory (flat list).
 */
export function listKnowledgeFiles(workspaceDir: string): Array<{ name: string; path: string; size: number; modified: string }> {
	const knowledgeDir = join(workspaceDir, "knowledge");
	if (!existsSync(knowledgeDir)) return [];
	try {
		const entries = readdirSync(knowledgeDir, { withFileTypes: true });
		const files: Array<{ name: string; path: string; size: number; modified: string }> = [];
		for (const entry of entries) {
			if (entry.isFile()) {
				const fullPath = join(knowledgeDir, entry.name);
				try {
					const stat = statSync(fullPath);
					files.push({
						name: entry.name,
						path: entry.name,
						size: stat.size,
						modified: stat.mtime.toISOString(),
					});
				} catch {
					// skip unreadable files
				}
			}
		}
		return files.sort((a, b) => b.modified.localeCompare(a.modified));
	} catch {
		return [];
	}
}

/**
 * List all knowledge files recursively, including subdirectories.
 */
export function listAllKnowledgeFiles(workspaceDir: string): Array<{ name: string; path: string; size: number; modified: string }> {
	const knowledgeDir = join(workspaceDir, "knowledge");
	if (!existsSync(knowledgeDir)) return [];
	const result: Array<{ name: string; path: string; size: number; modified: string }> = [];
	function walk(dir: string, relativeDir: string): void {
		try {
			const entries = readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = join(dir, entry.name);
				const relativePath = relativeDir ? ${relativeDir}/ : entry.name;
				if (entry.isDirectory()) {
					walk(fullPath, relativePath);
				} else if (entry.isFile()) {
					try {
						const st = statSync(fullPath);
						result.push({
							name: entry.name,
							path: relativePath,
							size: st.size,
							modified: st.mtime.toISOString(),
						});
					} catch {
						// skip unreadable files
					}
				}
			}
		} catch {
			// skip unreadable directories
		}
	}
	walk(knowledgeDir, "");
	return result.sort((a, b) => b.modified.localeCompare(a.modified));
}

/**
 * Read a knowledge file's content.
 * Returns null if the file does not exist or is outside the knowledge directory.
 */
export function readKnowledgeFile(workspaceDir: string, filePath: string): string | null {
	const knowledgeDir = resolve(join(workspaceDir, "knowledge"));
	const targetPath = resolve(join(knowledgeDir, filePath));
	if (!targetPath.startsWith(knowledgeDir)) return null;
	if (!existsSync(targetPath)) return null;
	try {
		return readFileSync(targetPath, "utf-8");
	} catch {
		return null;
	}
}

/**
 * Save content to a knowledge file. Creates intermediate directories if needed.
 * Returns the full path of the saved file.
 */
export function saveKnowledgeFile(workspaceDir: string, name: string, content: string): string {
	const knowledgeDir = join(workspaceDir, "knowledge");
	const sanitizedName = basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
	const fullPath = join(knowledgeDir, sanitizedName);
	if (!existsSync(knowledgeDir)) {
		mkdirSync(knowledgeDir, { recursive: true });
	}
	writeFileSync(fullPath, content, "utf-8");
	return fullPath;
}

/**
 * Delete a knowledge file by name.
 * Returns true if the file was deleted, false if not found.
 */
export function deleteKnowledgeFile(workspaceDir: string, name: string): boolean {
	const knowledgeDir = resolve(join(workspaceDir, "knowledge"));
	const targetPath = resolve(join(knowledgeDir, basename(name)));
	if (!targetPath.startsWith(knowledgeDir)) return false;
	if (!existsSync(targetPath)) return false;
	try {
		unlinkSync(targetPath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Chunk a file's content and index it into the MCP Brain.
 * Returns the number of chunks indexed.
 */
export async function chunkAndIndexFile(filePath: string, fileName: string, brain: BrainClient): Promise<number> {
	try {
		if (!existsSync(filePath)) return 0;
		const content = readFileSync(filePath, "utf-8");
		if (!content.trim()) return 0;

		// Simple chunking strategy: split by paragraphs or fixed-size chunks
		const maxChunkSize = 2000;
		const chunks: string[] = [];
		const paragraphs = content.split(/\n\n+/);

		let currentChunk = "";
		for (const paragraph of paragraphs) {
			const trimmed = paragraph.trim();
			if (!trimmed) continue;
			if ((currentChunk + "\n\n" + trimmed).length > maxChunkSize && currentChunk) {
				chunks.push(currentChunk.trim());
				currentChunk = trimmed;
			} else {
				currentChunk = currentChunk ? ${currentChunk}\n\n : trimmed;
			}
		}
		if (currentChunk.trim()) {
			chunks.push(currentChunk.trim());
		}

		let indexed = 0;
		for (let i = 0; i < chunks.length; i++) {
			const title = chunks.length > 1 ? ${fileName} (parte /) : fileName;
			const result = await brain.saveMemory("knowledge", title, chunks[i], "knowledge,file");
			if (result) indexed++;
		}
		return indexed;
	} catch {
		return 0;
	}
}

/**
 * Delete all brain chunks associated with a given file name.
 */
export async function deleteBrainChunksByFile(brain: BrainClient, fileName: string): Promise<void> {
	try {
		// Search for memories with the file name in the title
		const results = await brain.searchMemories(fileName, 100, "knowledge");
		for (const result of results) {
			if (result.title?.startsWith(fileName) || result.title === fileName) {
				await brain.deleteMemory(result.id).catch(() => {});
			}
		}
	} catch {
		// Best-effort cleanup
	}
}
