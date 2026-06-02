import type OpenAI from "openai";
import type { ToolContext } from "../tools/types.js";

export interface SessionState {
	messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>;
	toolContext: ToolContext;
}
