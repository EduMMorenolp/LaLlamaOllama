import axios, { type AxiosInstance } from "axios";
import { logger } from "../../utils/logger.js";
import type { AppConfig } from "../config.js";
import type { SearchResult } from "../types.js";

export class BrainClient {
	private http: AxiosInstance;
	private project: string;

	constructor(config: AppConfig, project = "lallamaollama") {
		this.http = axios.create({
			baseURL: config.brainUrl,
			timeout: 30000,
			headers: {
				"Content-Type": "application/json",
				...(config.apiKey ? { "X-API-Key": config.apiKey } : {}),
			},
		});
		this.project = project;
	}

	async saveMemory(
		type: string,
		title: string,
		content: string,
		tags?: string,
		agent = "agent-engine"
	): Promise<string> {
		try {
			const res = await this.http.post("/api/memory", {
				project: this.project,
				type,
				title,
				content,
				tags,
				agent,
			});
			logger.tool(`[Brain] Memory saved: ${title}`);
			return res.data.id || "ok";
		} catch (err) {
			logger.error(`[Brain] Failed to save memory: ${err}`);
			return "";
		}
	}

	async searchMemories(query: string, limit = 10, typeFilter?: string): Promise<SearchResult[]> {
		try {
			const res = await this.http.get("/api/memory/search", {
				params: { q: query, project: this.project, limit, ...(typeFilter ? { type: typeFilter } : {}) },
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

	async getDirectives(): Promise<string> {
		try {
			const res = await this.http.get("/api/directives", {
				params: { project: this.project },
			});
			return res.data.content || "";
		} catch {
			logger.warn("[Brain] Get directives failed");
			return "";
		}
	}

	async getMemory(id: string): Promise<Record<string, unknown> | null> {
		try {
			const res = await this.http.get(`/api/memory/${encodeURIComponent(id)}`, { timeout: 10000 });
			return res.data;
		} catch {
			return null;
		}
	}

	async updateMemory(id: string, data: { title?: string; content?: string; tags?: string; phase?: string }): Promise<boolean> {
		try {
			await this.http.put(`/api/memory/${encodeURIComponent(id)}`, data, { timeout: 10000 });
			return true;
		} catch {
			return false;
		}
	}

	async deleteMemory(id: string): Promise<boolean> {
		try {
			await this.http.delete(`/api/memory/${encodeURIComponent(id)}`, { timeout: 10000 });
			return true;
		} catch {
			return false;
		}
	}

	async getTimeline(limit = 100, type?: string): Promise<Record<string, unknown>[]> {
		try {
			const res = await this.http.get("/api/memory/timeline", {
				params: { project: this.project, limit, ...(type ? { type } : {}) },
				timeout: 10000,
			});
			return res.data || [];
		} catch {
			return [];
		}
	}

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
