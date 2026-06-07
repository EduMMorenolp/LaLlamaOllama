import type OpenAI from "openai";

// ─── Sesión de agente ────────────────────────────────────────────────

export interface ToolContext {
	sessionId: string;
	workspaceDir: string;
	chatId?: string;
}

export interface SessionState {
	messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>;
	toolContext: ToolContext;
}

// ─── Opciones y resultado del agente ─────────────────────────────────

export interface AgentOptions {
	chatId: string;
	userText: string;
	attachments?: Array<{ name: string; type: string; data: string }>;
	config: import("./config.js").AppConfig;
	brain: import("./brain/client.js").BrainClient;
	onChunk?: (text: string) => void;
	onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
	onToolResult?: (toolName: string, result: string) => void;
}

export interface AgentResult {
	text: string;
	model: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	latencyMs: number;
}

// ─── Memoria (mcp-brain) ─────────────────────────────────────────────

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

// ─── Ejecución ───────────────────────────────────────────────────────

export interface ExecutionEntry {
	timestamp: number;
	chatId: string;
	userText: string;
	agentText: string;
	model: string;
	toolCalls: number;
	latencyMs: number;
	tokensUsed: number;
}
