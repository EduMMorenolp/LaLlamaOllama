import { createScheduledTask } from "../db/scheduled-tasks.js";
import { toolRegistry } from "./registry.js";

export function registerScheduleTaskTool(): void {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "schedule_task",
				description: "Programa una tarea para ejecuci\u00f3n autom\u00e1tica recurrente usando una expresi\u00f3n cron.",
				parameters: {
					type: "object",
					properties: {
						name: {
							type: "string",
							description: "Nombre descriptivo de la tarea programada",
						},
						cron_expression: {
							type: "string",
							description: "Expresi\u00f3n cron (ej: '0 9 * * 1' para cada lunes a las 9am, '*/5 * * * *' para cada 5 minutos)",
						},
						task_text: {
							type: "string",
							description: "Texto de la tarea a ejecutar cuando se active el cron",
						},
						mode_id: {
							type: "string",
							description: "ID del modo a usar (opcional, usa el modo activo por defecto)",
						},
					},
					required: ["name", "cron_expression", "task_text"],
				},
			},
		},
		handler: async (args) => {
			const name = args.name as string;
			const cron_expression = args.cron_expression as string;
			const task_text = args.task_text as string;
			const mode_id = args.mode_id as string;
			if (!name || !cron_expression || !task_text) {
				return JSON.stringify({ success: false, error: "Missing required fields" });
			}
			try {
				const id = createScheduledTask({ name, cron_expression, task_text, mode_id });
				return JSON.stringify({ success: true, id, name, cron_expression, task_text, status: "scheduled" });
			} catch (err) {
				return JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) });
			}
		},
		enabled: false,
	});
}
