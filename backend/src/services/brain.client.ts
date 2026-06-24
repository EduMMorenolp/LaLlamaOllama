import axios, { type AxiosInstance } from "axios";
import logger from "../utils/logger.js";

const log = logger.child({ component: "brain-client" });

export interface BrainMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string | null;
	toolCalls?: Array<Record<string, unknown>>;
	toolCallId?: string;
	name?: string;
	tokenCount?: number;
}

export interface HistoryMessage {
	id: string;
	sessionId: string;
	role: string;
	content: string | null;
	toolCalls: Array<Record<string, unknown>> | null;
	toolCallId: string | null;
	name: string | null;
	tokenCount: number;
	createdAt: number;
}

export class BrainClient {
	private readonly api: AxiosInstance;
	private readonly baseUrl: string;

	constructor(baseUrl?: string) {
		this.baseUrl = baseUrl || process.env.BRAIN_URL || "http://brain:3015";
		this.api = axios.create({
			baseURL: this.baseUrl,
			timeout: 5000,
			headers: { "Content-Type": "application/json" },
		});
		log.info({ baseUrl: this.baseUrl }, "BrainClient initialized");
	}

	async appendMessage(
		sessionId: string,
		msg: BrainMessage,
	): Promise<{ id: string } | null> {
		try {
			const res = await this.api.post("/api/conversation/append", {
				sessionId,
				role: msg.role,
				content: msg.content,
				toolCalls: msg.toolCalls,
				toolCallId: msg.toolCallId,
				name: msg.name,
				tokenCount: msg.tokenCount || 0,
			});
			return res.data;
		} catch (error) {
			log.warn({ err: error, sessionId }, "Brain appendMessage failed");
			return null;
		}
	}

	async getHistory(
		sessionId: string,
		limit: number = 50,
		offset: number = 0,
	): Promise<{ messages: HistoryMessage[]; total: number } | null> {
		try {
			const res = await this.api.get("/api/conversation/history", {
				params: { session_id: sessionId, limit, offset },
			});
			return res.data;
		} catch (error) {
			log.warn({ err: error, sessionId }, "Brain getHistory failed");
			return null;
		}
	}

	async summarizeHistory(
		sessionId: string,
		model?: string,
		maxMessages?: number,
		keepRecent?: number,
	): Promise<{
		summary: string;
		keptCount: number;
		totalCount: number;
	} | null> {
		try {
			const res = await this.api.post("/api/conversation/summarize", {
				sessionId,
				model: model || process.env.DEFAULT_MODEL || "qwen3.5:4b",
				maxMessages: maxMessages || 20,
				keepRecent: keepRecent || 5,
			});
			return res.data;
		} catch (error) {
			log.warn({ err: error, sessionId }, "Brain summarizeHistory failed");
			return null;
		}
	}

	async deleteSession(sessionId: string): Promise<boolean> {
		try {
			await this.api.delete(`/api/conversation/${sessionId}`);
			return true;
		} catch (error) {
			log.warn({ err: error, sessionId }, "Brain deleteSession failed");
			return false;
		}
	}
}
