// WebSocket message types for agent-engine

export interface WsMessage {
	type: WsMessageType;
	payload: Record<string, unknown>;
}

export type WsMessageType =
	// Client ? Server
	| "user_message"
	| "cancel"
	| "get_status"
	| "list_tools"
	| "toggle_tool"
	// Expert management
	| "list_experts"
	| "expert_update"
	// User management
	| "list_users"
	| "user_register"
	| "user_update"
	| "user_delete"
	| "identify"
	// Chat management
	| "list_chats"
	| "chat_update"
	| "switch_chat"
	// Model management
	| "list_models"
	| "model_update"
	// Tasks
	| "list_tasks"
	// Favorites / Saved messages
	| "task_created"
	| "save_message"
	| "unsave_message"
	| "list_saved_messages"
	| "is_message_saved"
	| "message_saved"
	| "message_unsaved"
	| "saved_messages_list"
	| "message_saved_status"
	// Auto suggestions
	| "suggestions"
	// Session history
	| "list_sessions"
	| "list_sessions_result"
	// Telegram settings
	| "telegram_update"
	| "telegram_get_status"
	// General config
	| "get_general_config"
	| "general_config_update"
	| "general_config"
	// Docker info
	| "get_docker_info"
	// Ollama models
	| "list_ollama_models"
	// Server ? Client
	| "assistant_chunk"
	| "assistant_done"
	| "tool_call"
	| "tool_result"
	| "status"
	| "telegram_status"
	| "error"
	| "tools_list"
	| "action_log"
	| "ollama_models"
	| "telegram_message"
	| "docker_info";

export interface UserMessagePayload {
	chatId: string;
	text: string;
	attachments?: Array<{ name: string; type: string; data: string }>;
}

export interface AssistantChunkPayload {
	chatId: string;
	text: string;
}

export interface AssistantDonePayload {
	chatId: string;
	text: string;
	model: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	latencyMs: number;
}

export interface ToolCallPayload {
	chatId: string;
	toolName: string;
	args: Record<string, unknown>;
}

export interface ToolResultPayload {
	chatId: string;
	toolName: string;
	result: string;
}

export interface ErrorPayload {
	chatId: string;
	message: string;
	code?: string;
}

export function createMessage(type: WsMessageType, payload: Record<string, unknown>): string {
	return JSON.stringify({ type, payload });
}

