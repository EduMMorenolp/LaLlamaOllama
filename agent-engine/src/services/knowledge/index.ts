import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync, lstatSync } from "node:fs";
import { join, extname, relative, basename } from "node:path";
import type { BrainClient } from "../brain/client.js";
import { logger } from "../../utils/logger.js";

export interface KnowledgeFile {
	name: string;
	relativePath: string;
	size: number;
	ext: string;
	modifiedAt: string;
	chunks: number;
}

function scanDirRecursive(dir: string, baseDir: string): KnowledgeFile[] {
	const entries = readdirSync(dir);
	const files: KnowledgeFile[] = [];

	for (const entry of entries) {
		if (entry.startsWith(".")) continue;
		const fullPath = join(dir, entry);
		const stat = lstatSync(fullPath);

		if (stat.isDirectory()) {
			files.push(...scanDirRecursive(fullPath, baseDir));
		} else {
			const relPath = relative(baseDir, fullPath);
			files.push({
				name: entry,
				relativePath: relPath.replace(/\\/g, "/"),
				size: stat.size,
				ext: extname(entry).toLowerCase(),
				modifiedAt: stat.mtime.toISOString(),
				chunks: 0,
			});
		}
	}

	return files;
}

export function listAllKnowledgeFiles(workspaceDir: string): KnowledgeFile[] {
	const dir = join(workspaceDir, "knowledge");
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
		return [];
	}

	return scanDirRecursive(dir, dir);
}

export function listKnowledgeFiles(workspaceDir: string): KnowledgeFile[] {
	const dir = join(workspaceDir, "knowledge");
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
		return [];
	}

	return readdirSync(dir)
		.filter((f) => !f.startsWith("."))
		.map((name) => {
			const fullPath = join(dir, name);
			const stat = statSync(fullPath);
			if (!stat.isFile()) return null;
			return {
				name,
				relativePath: name,
				size: stat.size,
				ext: extname(name).toLowerCase(),
				modifiedAt: stat.mtime.toISOString(),
				chunks: 0,
			};
		})
		.filter((f): f is KnowledgeFile => f !== null);
}

export function saveKnowledgeFile(
	workspaceDir: string,
	relativePath: string,
	content: string
): string {
	const dir = join(workspaceDir, "knowledge");
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	const filePath = join(dir, relativePath);
	mkdirSync(join(filePath, ".."), { recursive: true });
	writeFileSync(filePath, content, "utf-8");
	return filePath;
}

export function deleteKnowledgeFile(
	workspaceDir: string,
	relativePath: string
): boolean {
	const filePath = join(workspaceDir, "knowledge", relativePath);
	if (!existsSync(filePath)) return false;
	unlinkSync(filePath);
	return true;
}

export function readKnowledgeFile(
	workspaceDir: string,
	relativePath: string
): string | null {
	const filePath = join(workspaceDir, "knowledge", relativePath);
	if (!existsSync(filePath)) return null;
	try {
		return readFileSync(filePath, "utf-8");
	} catch {
		return null;
	}
}

export function chunkText(text: string, maxChunkSize = 1000): string[] {
	const paragraphs = text.split(/\n\s*\n/);
	const chunks: string[] = [];
	let current = "";

	for (const para of paragraphs) {
		const trimmed = para.trim();
		if (!trimmed) continue;

		if (current.length + trimmed.length > maxChunkSize && current.length > 0) {
			chunks.push(current.trim());
			current = "";
		}

		if (trimmed.length > maxChunkSize) {
			if (current.trim()) {
				chunks.push(current.trim());
				current = "";
			}
			for (let i = 0; i < trimmed.length; i += maxChunkSize) {
				chunks.push(trimmed.slice(i, i + maxChunkSize).trim());
			}
		} else {
			current += (current ? "\n\n" : "") + trimmed;
		}
	}

	if (current.trim()) {
		chunks.push(current.trim());
	}

	return chunks;
}

export async function chunkAndIndexFile(
	filePath: string,
	fileName: string,
	brain: BrainClient
): Promise<number> {
	const content = readFileSync(filePath, "utf-8");
	const chunks = chunkText(content);

	let indexed = 0;
	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		const title = `${fileName} — parte ${i + 1}/${chunks.length}`;
		const tags = `knowledge,${fileName},chunk-${i + 1}`;
		try {
			const result = await brain.saveMemory("knowledge", title, chunk, tags);
			if (result) indexed++;
		} catch (err) {
			logger.error(`[Knowledge] Failed to index chunk ${i + 1} of ${fileName}: ${err}`);
		}
	}

	return indexed;
}

export async function deleteBrainChunksByFile(
	brain: BrainClient,
	fileName: string
): Promise<number> {
	try {
		const searchResults = await brain.searchMemories(fileName, 200);
		const toDelete = searchResults.filter(
			(r) => r.tags && r.tags.includes(`knowledge,${fileName}`)
		);
		let deleted = 0;
		for (const mem of toDelete) {
			try {
				await brain.deleteMemory(mem.id);
				deleted++;
			} catch {
				// skip individual failures
			}
		}
		if (deleted > 0) {
			logger.info(`[Knowledge] Deleted ${deleted} brain chunks for: ${fileName}`);
		}
		return deleted;
	} catch (err) {
		logger.error(`[Knowledge] Failed to delete brain chunks for ${fileName}: ${err}`);
		return 0;
	}
}
