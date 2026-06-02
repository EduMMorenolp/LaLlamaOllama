import type { BrainClient } from "../memory/brain-client.js";
import { registerBashTool } from "./bash.js";
import { registerDelegateTool } from "./delegate.js";
import { registerGlobTool } from "./glob-search.js";
import { registerGrepTool } from "./grep-search.js";
import { registerMemoryTools } from "./memory.js";
import { registerReadFileTool } from "./read-file.js";
import { registerReadUrlTool } from "./read-url.js";
import { registerEditFileTool, registerWriteFileTool } from "./write-file.js";

/**
 * Register all available tools for the agent.
 */
export function registerAllTools(brain: BrainClient): void {
	registerBashTool();
	registerReadFileTool();
	registerWriteFileTool();
	registerEditFileTool();
	registerGlobTool();
	registerGrepTool();
	registerReadUrlTool();
	registerDelegateTool();
	registerMemoryTools(brain);

	// web_search se registra condicionalmente si hay API key configurada
}
