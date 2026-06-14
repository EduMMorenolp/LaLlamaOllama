import { createScheduledTask } from "../db/scheduled-tasks.js";
import { toolRegistry } from "./registry.js";

export function registerScheduleTaskTool(): void {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "schedule_task",
				description: "Programa una tarea recurrente con cron.",
				parameters: {
					type: "object",
					properties: {
						name: {
							type: "string",
							description: "Nombre descriptivo corto (ej: 'recordatorio diario')",
						},
						cron_expression: {
							type: "string",
							description: "Expresión cron de 5 campos: minuto hora día-del-mes mes día-de-la-semana. Pregunta al usuario la frecuencia.",
						},
						task_text: {
							type: "string",
							description: "Texto de la tarea a ejecutar cuando se active el cron.",
						},
						mode_id: {
							type: "string",
							description: "ID del modo para ejecutar la tarea (opcional, usa el activo por defecto)",
						},
					},
					required: ["name", "cron_expression", "task_text"],
				},
			},
		},
		handler: async (args) => {
			const name = (args.name as string || "").trim();
			const cron_expression = (args.cron_expression as string || "").trim();
			const task_text = (args.task_text as string || "").trim();
			const mode_id = args.mode_id as string;

			if (!name) {
				return JSON.stringify({ success: false, error: "El nombre de la tarea es requerido." });
			}
			if (!cron_expression) {
				return JSON.stringify({ success: false, error: "La expresión cron es requerida." });
			}
			if (!task_text) {
				return JSON.stringify({ success: false, error: "El texto de la tarea es requerido." });
			}

			// Validar expresión cron (5 campos)
			const cronParts = cron_expression.split(/\s+/);
			if (cronParts.length !== 5) {
				return JSON.stringify({
					success: false,
					error: `Expresión cron inválida: debe tener 5 campos (minuto hora día-mes mes día-semana), se recibieron ${cronParts.length}. Ej: '0 9 * * 1'`,
				});
			}

			try {
				const id = createScheduledTask({ name, cron_expression, task_text, mode_id: mode_id || undefined });
				return JSON.stringify({ success: true, id, name, cron_expression, task_text, status: "scheduled" });
			} catch (err) {
				return JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) });
			}
		},
		enabled: false,
	});
}
