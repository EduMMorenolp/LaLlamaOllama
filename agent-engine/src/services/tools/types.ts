export interface ToolSpec {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	};
}

export interface ToolContext {
	sessionId: string;
	workspaceDir: string;
	chatId?: string;
	userId?: string;
}

export type ToolHandler = (args: Record<string, unknown>, context: ToolContext) => Promise<string>;

export interface ToolDefinition {
	spec: ToolSpec;
	handler: ToolHandler;
	enabled: boolean;
}
