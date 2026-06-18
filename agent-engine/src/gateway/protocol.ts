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
	| "user_feedback"
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
	| "new_task"
	| "cancel_task"
	| "start_task"
	| "move_to_backlog"
	| "update_task_properties"
	// Scheduled tasks
	| "list_scheduled_tasks"
	| "create_scheduled_task"
	| "update_scheduled_task"
	| "delete_scheduled_task"
	| "toggle_scheduled_task"
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
	// Mode management
	| "list_modes"
	| "get_active_mode"
	| "set_active_mode"
	| "mode_update"
	| "mode_changed"
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
	| "notification"
	| "status"
	| "telegram_status"
	| "error"
	| "tools_list"
	| "action_log"
	| "ollama_models"
	| "telegram_message"
	| "docker_info"
	// Task events
	| "task_created"
	| "task_status"
	| "task_completed"
	| "task_failed"
	| "task_cancelled"
	| "task_updated"
	| "scheduled_tasks_list";


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

