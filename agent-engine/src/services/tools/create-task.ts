import * as crypto from "node:crypto";
import { toolRegistry } from "./registry.js";
import { getRuntimeContext } from "../runtime.js";
import { runAgentCore } from "../agent/runAgentCore.js";

export function registerCreateTaskTool(): void {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "create_task",
				description: "Crea y ejecuta una nueva tarea. El agente procesará el texto de la tarea y devolverá un resultado.",
				parameters: {
					type: "object",
					properties: {
						text: {
							type: "string",
							description: "Texto descriptivo de la tarea a ejecutar",
						},
					},
					required: ["text"],
				},
			},
		},
		handler: async (args) => {
			const text = (args.text as string || "").trim();
			if (!text) {
				return JSON.stringify({ success: false, error: "El texto de la tarea no puede estar vacío." });
			}
			const subChatId = `task-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
			try {
				const { config, brain } = getRuntimeContext();
				const result = await runAgentCore({
					chatId: subChatId,
					userText: text,
					config,
					brain,
					origin: "tool",
					skipPersistUserMsg: false,
				});
				return JSON.stringify({
					success: true,
					status: "completed",
					result: result.text,
					latencyMs: result.latencyMs,
					model: result.model,
				});
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return JSON.stringify({ success: false, error: msg });
			}
		},
		enabled: false,
	});
}
