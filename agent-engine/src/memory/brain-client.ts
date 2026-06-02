import axios, { type AxiosInstance } from "axios";
import type { EnvConfig } from "../env.js";
import { logger } from "../utils/logger.js";

export interface MemoryEntry {
	id?: string;
	project: string;
	type: string;
	title: string;
	content: string;
	tags?: string;
	topic_key?: string;
}

export interface SearchResult {
	id: string;
	project: string;
	type: string;
	title: string;
	content: string;
	tags: string;
	topic_key: string;
	similarity?: number;
	created_at: string;
}

export interface SessionInfo {
	id: string;
	project: string;
	name: string;
	started_at: string;
	summary?: string;
}

export class BrainClient {
	private http: AxiosInstance;
	private project: string;

	constructor(config: EnvConfig, project = "lallamaollama") {
		this.http = axios.create({
			baseURL: config.brainUrl,
			timeout: 10000,
			headers: { "Content-Type": "application/json" },
		});
		this.project = project;
	}

	// ─── Memory Operations ────────────────────────────────────────────────

	async saveMemory(type: string, title: string, content: string, tags?: string): Promise<string> {
		try {
			const res = await this.http.post("/api/memory", {
				project: this.project,
				type,
				title,
				content,
				tags,
				agent: "agent-engine",
			});
			logger.tool(`[Brain] Memory saved: ${title}`);
			return res.data.id || "ok";
		} catch (err) {
			logger.error(`[Brain] Failed to save memory: ${err}`);
			return "";
		}
	}

	async searchMemories(query: string, limit = 10): Promise<SearchResult[]> {
		try {
			const res = await this.http.get("/api/memory/search", {
				params: { q: query, project: this.project, limit },
			});
			return res.data.results || [];
		} catch (err) {
			logger.warn(`[Brain] Search failed: ${err}`);
			return [];
		}
	}

	async getContext(limit = 15): Promise<string> {
		try {
			const res = await this.http.get("/api/memory/context", {
				params: { project: this.project, limit },
			});
			return res.data.context || "";
		} catch (err) {
			logger.warn(`[Brain] Context load failed: ${err}`);
			return "";
		}
	}

	// ─── Session Operations ───────────────────────────────────────────────

	async startSession(name: string): Promise<string> {
		try {
			const res = await this.http.post("/api/sessions", {
				project: this.project,
				name,
				agent: "agent-engine",
			});
			return res.data.id;
		} catch (err) {
			logger.warn(`[Brain] Start session failed: ${err}`);
			return "";
		}
	}

	async endSession(sessionId: string, summary: string): Promise<void> {
		try {
			await this.http.put(`/api/sessions/${sessionId}`, {
				summary,
				agent: "agent-engine",
			});
		} catch (err) {
			logger.warn(`[Brain] End session failed: ${err}`);
		}
	}

	async getDirectives(): Promise<string> {
		try {
			const res = await this.http.get("/api/directives", {
				params: { project: this.project },
			});
			return res.data.directives || "";
		} catch {
			logger.warn("[Brain] Get directives failed");
			return "";
		}
	}

	// ─── Stats ────────────────────────────────────────────────────────────

	async getStats(): Promise<Record<string, unknown>> {
		try {
			const res = await this.http.get("/api/memory/stats", {
				params: { project: this.project },
			});
			return res.data;
		} catch {
			return {};
		}
	}
}
