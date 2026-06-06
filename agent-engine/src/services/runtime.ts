import type { AppConfig } from "./config.js";
import type { BrainClient } from "./brain/client.js";
import type { DockerInfo } from "./docker-info.js";

export interface RuntimeContext {
	config: AppConfig;
	brain: BrainClient;
	dockerInfo: DockerInfo;
}

let runtimeContext: RuntimeContext | null = null;

export function setRuntimeContext(config: AppConfig, brain: BrainClient, dockerInfo: DockerInfo): void {
	runtimeContext = { config, brain, dockerInfo };
}

export function updateDockerInfo(dockerInfo: DockerInfo): void {
	if (runtimeContext) {
		runtimeContext.dockerInfo = dockerInfo;
		runtimeContext.config.dockerInfo = dockerInfo;
	}
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

export function getDockerInfo(): DockerInfo {
	if (!runtimeContext) {
		throw new Error("Agent runtime context is not initialized");
	}
	return runtimeContext.dockerInfo;
}
