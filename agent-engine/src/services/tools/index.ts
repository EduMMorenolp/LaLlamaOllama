import type { BrainClient } from "../brain/client.js";
import { registerBashTool } from "./bash.js";
import { registerCalcTool } from "./calc.js";
import { registerDelegateTool } from "./delegate.js";
import { registerEvolutivoTools } from "./evolutivo/index.js";
import { registerGlobTool } from "./glob-search.js";
import { registerGrepTool } from "./grep-search.js";
import { registerKnowledgeSearchTool } from "./knowledge-search.js";
import { registerMemoryTools } from "./memory-tools.js";
import { registerNotifyFrontendTool } from "./notify-frontend.js";
import { registerNotifyTelegramTool } from "./notify-telegram.js";
import { registerReadFileTool } from "./read-file.js";
import { registerReadUrlTool } from "./read-url.js";
import { registerTranslateTool } from "./translate.js";
import { registerWeatherTool } from "./weather.js";
import { registerWebSearchTool } from "./web-search.js";
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

	// Nuevas tools
	registerWeatherTool();
	registerWebSearchTool();
	registerCalcTool();
	registerTranslateTool();
	registerNotifyFrontendTool();
	registerNotifyTelegramTool();
	registerKnowledgeSearchTool();

	// Modo Evolutivo meta-tools
	registerEvolutivoTools();
}

export { toolRegistry } from "./registry.js";
export { setWsServer } from "./tool-bridge.js";
export type { ToolContext, ToolDefinition, ToolHandler, ToolSpec } from "./types.js";
