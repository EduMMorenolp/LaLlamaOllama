/**
 * Tipos compartidos para API responses y componentes
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface StatusResponse {
	gpuMemoryTotal?: number;
	gpuMemoryUsed?: number;
	gpuMemoryAvailable?: number;
	vramFreeMb?: number;
	vramTotalMb?: number;
	vramUsedMb?: number;
	models?: LoadedModel[];
	loadedModels?: LoadedModel[];
	recentLogs?: AccessLogEntry[];
	brainRunning?: boolean;
	ollamaRunning?: boolean;
	uptime?: string;
	diskSpace?: { free: number; total: number; used: number };
	ngrokInfo?: { active: boolean; url: string };
	hardware?: { available?: number; free?: number; total?: number; used?: number; vram?: VramInfo };
	auth?: {
		ollamaAuthEnabled?: boolean;
		mcpAuthEnabled?: boolean;
	};
	[key: string]: any;
}

export interface AccessLogEntry {
	ip: string;
	action: string;
	timestamp: string;
	status: "Success" | "Failed";
}

export interface OllamaModel {
	name: string;
	model: string;
	modified_at: string;
	size: number;
	digest: string;
	details?: {
		parameter_size?: string;
		quantization_level?: string;
	};
	[key: string]: any;
}

export interface LoadedModel {
	name: string;
	size_vram?: number;
	percentage?: number;
	[key: string]: any;
}

export type PullProgressData = Record<string, any>;

export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
	[key: string]: any;
}

export interface EngineStats extends Record<string, any> {
	totalTokensSession?: number;
	totalTimeSession?: number;
	[key: string]: any;
}

export interface VramInfo {
	total: number;
	used: number;
	free: number;
	available?: number;
}

export interface ChatCompletionOptions {
	temperature?: number;
	num_ctx?: number;
	top_p?: number;
	top_k?: number;
	[key: string]: any;
}
