import type OpenAI from "openai";
import type { AppConfig } from "../config.js";
import type { BrainClient } from "../brain/client.js";
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
