import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "../../utils/logger.js";
import type { Skill, SkillListEntry, SkillMetadata, SkillProposal } from "./types.js";

const SKILLS_DIR_ENV = process.env.SKILLS_DIR || "";
const DEFAULT_SKILLS_DIR = ".lallama/skills";
const PROPOSALS_DIR = "proposals";
const SKILL_FILENAME = "SKILL.md";
const MAX_FILE_SIZE = 15 * 1024;

export class SkillsService {
	private skillsDir: string;

	constructor(workspaceDir: string) {
		this.skillsDir = SKILLS_DIR_ENV || path.join(workspaceDir, DEFAULT_SKILLS_DIR);
	}

	private ensureDir(dir: string): void {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
			logger.info(`[Skills] Created directory: ${dir}`);
		}
	}

	private proposalsDir(): string {
		const d = path.join(this.skillsDir, PROPOSALS_DIR);
		this.ensureDir(d);
		return d;
	}

	private skillPath(name: string): string {
		const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, "_");
		return path.join(this.skillsDir, sanitized, SKILL_FILENAME);
	}

	private parseSkill(filePath: string): Skill | null {
		try {
			const raw = fs.readFileSync(filePath, "utf-8");
			const metaMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
			if (!metaMatch) return null;

			const metaRaw = metaMatch[1];
			const content = metaMatch[2].trim();

			const metadata: SkillMetadata = {
				name: "",
				description: "",
				version: "1.0.0",
			};

			for (const line of metaRaw.split("\n")) {
				const colonIdx = line.indexOf(":");
				if (colonIdx === -1) continue;
				const key = line.slice(0, colonIdx).trim();
				const val = line.slice(colonIdx + 1).trim();

				switch (key) {
					case "name": metadata.name = val; break;
					case "description": metadata.description = val; break;
					case "version": metadata.version = val; break;
					case "category": metadata.category = val; break;
					case "platforms":
						metadata.platforms = val.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
						break;
					case "tags":
						metadata.tags = val.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
						break;
					case "author": metadata.author = val; break;
				}
			}

			if (!metadata.name) return null;

			return {
				metadata,
				content,
				path: filePath,
				filename: SKILL_FILENAME,
				size: raw.length,
			};
		} catch {
			return null;
		}
	}

	list(): SkillListEntry[] {
		this.ensureDir(this.skillsDir);
		const entries: SkillListEntry[] = [];

		try {
			const items = fs.readdirSync(this.skillsDir, { withFileTypes: true });
			for (const item of items) {
				if (!item.isDirectory()) continue;
				if (item.name === PROPOSALS_DIR) continue;
				const skillFile = path.join(this.skillsDir, item.name, SKILL_FILENAME);
				if (!fs.existsSync(skillFile)) continue;

				const skill = this.parseSkill(skillFile);
				if (skill) {
					entries.push({
						name: skill.metadata.name,
						description: skill.metadata.description,
						category: skill.metadata.category,
						version: skill.metadata.version,
					});
				}
			}
		} catch (err) {
			logger.warn(`[Skills] List error: ${err}`);
		}

		return entries;
	}

	view(name: string): Skill | null {
		const filePath = this.skillPath(name);
		if (!fs.existsSync(filePath)) return null;
		return this.parseSkill(filePath);
	}

	create(metadata: SkillMetadata, content: string): boolean {
		if (!metadata.name) return false;

		const dir = path.join(this.skillsDir, metadata.name);
		this.ensureDir(dir);
		const filePath = path.join(dir, SKILL_FILENAME);

		const formatted = this.formatSkillFile(metadata, content);
		if (formatted.length > MAX_FILE_SIZE) {
			logger.warn(`[Skills] Skill "${metadata.name}" exceeds ${MAX_FILE_SIZE} bytes`);
			return false;
		}

		fs.writeFileSync(filePath, formatted, "utf-8");
		logger.info(`[Skills] Created skill: ${metadata.name}`);
		return true;
	}

	patch(name: string, updates: Partial<SkillMetadata>, content?: string): boolean {
		const existing = this.view(name);
		if (!existing) return false;

		const mergedMeta = { ...existing.metadata, ...updates, updated_at: new Date().toISOString() };
		const mergedContent = content ?? existing.content;

		const dir = path.join(this.skillsDir, name);
		this.ensureDir(dir);
		const filePath = path.join(dir, SKILL_FILENAME);

		const formatted = this.formatSkillFile(mergedMeta, mergedContent);
		if (formatted.length > MAX_FILE_SIZE) {
			logger.warn(`[Skills] Skill "${name}" exceeds ${MAX_FILE_SIZE} bytes after patch`);
			return false;
		}

		fs.writeFileSync(filePath, formatted, "utf-8");
		logger.info(`[Skills] Patched skill: ${name}`);
		return true;
	}

	delete(name: string): boolean {
		const dir = path.join(this.skillsDir, name);
		if (!fs.existsSync(dir)) return false;

		try {
			fs.rmSync(dir, { recursive: true, force: true });
			logger.info(`[Skills] Deleted skill: ${name}`);
			return true;
		} catch (err) {
			logger.warn(`[Skills] Delete error: ${err}`);
			return false;
		}
	}

	createProposal(proposal: SkillProposal): boolean {
		const proposalsDir = this.proposalsDir();
		const filename = `${proposal.metadata.name.replace(/[^a-zA-Z0-9._-]/g, "_")}_${Date.now()}.json`;
		const filePath = path.join(proposalsDir, filename);

		try {
			fs.writeFileSync(filePath, JSON.stringify(proposal, null, 2), "utf-8");
			logger.info(`[Skills] Created proposal: ${proposal.metadata.name}`);
			return true;
		} catch (err) {
			logger.warn(`[Skills] Proposal error: ${err}`);
			return false;
		}
	}

	listProposals(): SkillProposal[] {
		const proposalsDir = this.proposalsDir();
		const proposals: SkillProposal[] = [];

		try {
			const files = fs.readdirSync(proposalsDir);
			for (const file of files) {
				if (!file.endsWith(".json")) continue;
				try {
					const raw = fs.readFileSync(path.join(proposalsDir, file), "utf-8");
					proposals.push(JSON.parse(raw));
				} catch { /* skip malformed */ }
			}
		} catch { /* no proposals dir */ }

		return proposals;
	}

	getSkillsDir(): string {
		return this.skillsDir;
	}

	private formatSkillFile(metadata: SkillMetadata, content: string): string {
		const lines = ["---"];
		lines.push(`name: ${metadata.name}`);
		lines.push(`description: ${metadata.description}`);
		lines.push(`version: ${metadata.version}`);
		if (metadata.category) lines.push(`category: ${metadata.category}`);
		if (metadata.platforms?.length) lines.push(`platforms: [${metadata.platforms.join(", ")}]`);
		if (metadata.tags?.length) lines.push(`tags: [${metadata.tags.join(", ")}]`);
		if (metadata.author) lines.push(`author: ${metadata.author}`);
		if (metadata.created_at) lines.push(`created_at: ${metadata.created_at}`);
		if (metadata.updated_at) lines.push(`updated_at: ${metadata.updated_at}`);
		if (metadata.requires_env?.length) {
			lines.push("requires_env:");
			for (const env of metadata.requires_env) lines.push(`  - ${env}`);
		}
		if (metadata.requires_toolsets?.length) {
			lines.push("requires_toolsets:");
			for (const ts of metadata.requires_toolsets) lines.push(`  - ${ts}`);
		}
		if (metadata.config?.length) {
			lines.push("config:");
			for (const c of metadata.config) {
				lines.push(`  - key: ${c.key}`);
				lines.push(`    description: "${c.description}"`);
				lines.push(`    default: "${c.default}"`);
			}
		}
		lines.push("---");
		lines.push("");
		lines.push(content.trim());
		return lines.join("\n");
	}
}
