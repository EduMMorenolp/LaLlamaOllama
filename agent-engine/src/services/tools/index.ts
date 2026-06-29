import type { BrainClient } from "../brain/client.js";
import type { AppConfig } from "../config.js";
import { registerBashTool } from "./bash.js";
import { registerCalcTool } from "./calc.js";
import { registerContextTools } from "./context-tools.js";
import { registerDelegateTool } from "./delegate.js";
import { registerEvolutivoTools } from "./evolutivo/index.js";
import { registerGlobTool } from "./glob-search.js";
import { registerGrepTool } from "./grep-search.js";
import { registerKnowledgeSearchTool } from "./knowledge-search.js";
import { registerMemoryTools } from "./memory-tools.js";
import { registerNotifyFrontendTool } from "./notify-frontend.js";
import { registerNotifyTelegramTool } from "./notify-telegram.js";
import { registerTranscribeAudioTool } from "./transcribe-audio.js";
import { registerReadFileTool } from "./read-file.js";
import { registerReadUrlTool } from "./read-url.js";
import { registerTranslateTool } from "./translate.js";
import { registerWeatherTool } from "./weather.js";
import { registerWebSearchTool } from "./web-search.js";
import { registerEditFileTool, registerWriteFileTool } from "./write-file.js";
import { registerCreateTaskTool } from "./create-task.js";
import { registerCancelTaskTool } from "./cancel-task.js";
import { registerScheduleTaskTool } from "./schedule-task.js";
import { registerSwitchModeTool } from "./switch-mode.js";
import { registerSkillsTools } from "./skills-tools.js";
import { registerTaskTools } from "./task-tools.js";

export function registerAllTools(brain: BrainClient, config?: AppConfig): void {
	registerBashTool();
	registerReadFileTool();
	registerWriteFileTool();
	registerEditFileTool();
	registerGlobTool();
	registerGrepTool();
	registerReadUrlTool();
	registerDelegateTool();
	registerMemoryTools(brain);
	registerContextTools(brain);

	registerWeatherTool();
	registerWebSearchTool();
	registerCalcTool();
	registerTranslateTool();
	registerNotifyFrontendTool();
	registerNotifyTelegramTool();
	registerTranscribeAudioTool();
	registerKnowledgeSearchTool();

	// Modo Evolutivo meta-tools
	registerCreateTaskTool();
	registerCancelTaskTool();
	registerScheduleTaskTool();
	registerSwitchModeTool();

	registerEvolutivoTools();
	registerTaskTools();

	// Skills system (procedural memory)
	if (config) {
		registerSkillsTools(config);
	}
}

export { toolRegistry } from "./registry.js";
export { setWsServer } from "./tool-bridge.js";
export type { ToolContext, ToolDefinition, ToolHandler, ToolSpec } from "./types.js";

