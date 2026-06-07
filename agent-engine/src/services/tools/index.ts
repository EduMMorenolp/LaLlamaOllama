import type { BrainClient } from "../brain/client.js";
import { registerBashTool } from "./bash.js";
import { registerDelegateTool } from "./delegate.js";
import { registerGlobTool } from "./glob-search.js";
import { registerGrepTool } from "./grep-search.js";
import { registerMemoryTools } from "./memory-tools.js";
import { registerReadFileTool } from "./read-file.js";
import { registerReadUrlTool } from "./read-url.js";
import { registerEditFileTool, registerWriteFileTool } from "./write-file.js";

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
}

export { toolRegistry } from "./registry.js";
export type { ToolContext, ToolDefinition, ToolHandler, ToolSpec } from "./types.js";
