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
	/** Called with status messages (e.g. for Telegram sending ⏳ indicators) */
	onStatus?: (text: string) => void;
	/** Called with typing indicator state */
	onTyping?: (isTyping: boolean) => void;
	/** Origin of the message (web | telegram) */
	origin?: "web" | "telegram";
	/** Telegram chat ID for direct replies */
	telegramChatId?: number;
	/** If true, skip persisting the user message to DB (already done by the channel) */
	skipPersistUserMsg?: boolean;
	/** Quoted/replied message context */
	quotedMessage?: { content: string; role: string; timestamp?: string };
	/** Callback for auto-suggestions */
	onSuggestions?: (suggestions: string[]) => void;
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
}
