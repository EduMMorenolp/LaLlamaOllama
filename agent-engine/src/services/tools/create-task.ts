import { toolRegistry } from "./registry.js";
import { submitAgentRun } from "../orchestrator/index.js";

export function registerCreateTaskTool(): void {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "create_task",
				description: "Crea y ejecuta una nueva tarea. El agente procesar\u00e1 el texto de la tarea y devolver\u00e1 un resultado.",
				parameters: {
					type: "object",
					properties: {
						text: {
							type: "string",
							description: "Texto descriptivo de la tarea a ejecutar",
						},
						chatId: {
							type: "string",
							description: "ID del chat (opcional, por defecto 'web')",
						},
					},
					required: ["text"],
				},
			},
		},
		handler: async (args) => {
			const text = args.text as string;
			const chatId = (args.chatId as string) || "web";
			try {
				const result = await submitAgentRun({ chatId, userText: text, origin: "tool" });
				return JSON.stringify({
					success: true,
					runId: result.runId,
					status: "completed",
					result: result.text,
					latencyMs: result.latencyMs,
				});
			} catch (err) {
				return JSON.stringify({
					success: false,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		},
		enabled: false, // disabled by default, enabled by mode
	});
}
