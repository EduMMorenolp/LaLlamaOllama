import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import type { BrainClient } from "../brain/client.js";
import { logger } from "../../utils/logger.js";

export interface KnowledgeFile {
	name: string;
	size: number;
	ext: string;
	modifiedAt: string;
	chunks: number;
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
			return {
				name,
				size: stat.size,
				ext: extname(name).toLowerCase(),
				modifiedAt: stat.mtime.toISOString(),
				chunks: 0,
			};
		});
}

export function saveKnowledgeFile(
	workspaceDir: string,
	name: string,
	content: string
): string {
	const dir = join(workspaceDir, "knowledge");
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	const filePath = join(dir, name);
	writeFileSync(filePath, content, "utf-8");
	return filePath;
}

export function deleteKnowledgeFile(
	workspaceDir: string,
	name: string
): boolean {
	const filePath = join(workspaceDir, "knowledge", name);
	if (!existsSync(filePath)) return false;
	unlinkSync(filePath);
	return true;
}

export function readKnowledgeFile(
	workspaceDir: string,
	name: string
): string | null {
	const filePath = join(workspaceDir, "knowledge", name);
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
