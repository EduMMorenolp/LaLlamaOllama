import type OpenAI from "openai";
import type { BrainClient } from "../brain/client.js";
import type { AppConfig } from "../config.js";
import type { ToolContext } from "../tools/types.js";

export interface AgentOptions {
	chatId: string;
	userText: string;
	attachments?: Array<{ name: string; type: string; data: string }>;
	config: AppConfig;
	brain: BrainClient;
	onChunk?: (text: string) => void;
	onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
	onToolResult?: (toolName: string, result: string) => void;
	/** Called with status messages (e.g. for Telegram sending â³ indicators) */
	onStatus?: (text: string) => void;
	/** Called with typing indicator state */
	onTyping?: (isTyping: boolean) => void;
	/** Origin of the message (web | telegram) */
	origin?: string;
	/** Telegram chat ID for direct replies */
	telegramChatId?: number;
	/** If true, skip persisting the user message to DB (already done by the channel) */
	skipPersistUserMsg?: boolean;
	/** Quoted/replied message context */
	quotedMessage?: { content: string; role: string; timestamp?: string };
	/** Callback for auto-suggestions */
	onSuggestions?: (suggestions: string[]) => void;
	/** Specific mode ID to use (overrides active mode) */
	modeId?: string;
	/** Preferred model selected for this run */
	preferredModel?: string;
	/** LLM options (e.g. num_ctx) passed from frontend */
	options?: Record<string, unknown>;
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

export interface SessionState {
	messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>;
	toolContext: ToolContext;
	summary?: string;
	consecutiveFallbacks?: number;
}

