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
