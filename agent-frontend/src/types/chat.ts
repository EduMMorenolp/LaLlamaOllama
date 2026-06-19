export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	model?: string;
}

export interface ChatMessage {
	role: "user" | "assistant" | "tool" | "system";
	content: string;
	timestamp: Date;
	usage?: TokenUsage;
}

export interface ToolCallInfo {
	toolName: string;
	args: Record<string, unknown>;
	result?: string;
	status: "pending" | "done" | "error";
}

export interface ChatEntry {
	id: string;
	userId: string;
	title: string;
	origin: string;
	expertName: string | null;
	pinned: number;
	created_at: string;
	updated_at: string;
	lastMessage?: string;
	messageCount?: number;
}
