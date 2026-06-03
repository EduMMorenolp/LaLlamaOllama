import type { AppConfig } from "./config.js";
import type { BrainClient } from "./brain/client.js";

export interface RuntimeContext {
	config: AppConfig;
	brain: BrainClient;
}

let runtimeContext: RuntimeContext | null = null;

export function setRuntimeContext(config: AppConfig, brain: BrainClient): void {
	runtimeContext = { config, brain };
}

export function getRuntimeContext(): RuntimeContext {
	if (!runtimeContext) {
		throw new Error("Agent runtime context is not initialized");
	}

	return runtimeContext;
}

export function hasRuntimeContext(): boolean {
	return runtimeContext !== null;
}
