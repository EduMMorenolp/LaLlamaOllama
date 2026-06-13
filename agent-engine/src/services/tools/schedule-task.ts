import { createScheduledTask } from "../db/scheduled-tasks.js";
import { toolRegistry } from "./registry.js";

export function registerScheduleTaskTool(): void {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "schedule_task",
				description: "Programa una tarea para ejecución automática y recurrente usando una expresión cron. Úsala cuando el usuario pida recordatorios programados, tareas diarias/semanales/mensuales, o notificaciones periódicas. Para tareas de una sola ejecución usa create_task.",
				parameters: {
					type: "object",
					properties: {
						name: {
							type: "string",
							description: "Nombre descriptivo corto de la tarea programada (ej: 'recordatorio diario', 'notificacion operativa')",
						},
						cron_expression: {
							type: "string",
							description: "Expresión cron de 5 campos: minuto hora día-del-mes mes día-de-la-semana. Ej: '0 9 * * 1' (lunes 9am), '*/30 * * * *' (cada 30 min), '0 */2 * * *' (cada 2 horas), '0 8 * * 1-5' (lunes a viernes 8am). Pregunta al usuario la frecuencia si no la especifica.",
						},
						task_text: {
							type: "string",
							description: "Texto de la tarea a ejecutar cuando se active el cron. Describe QUÉ debe hacer el agente en esa ejecución.",
						},
						mode_id: {
							type: "string",
							description: "ID del modo a usar para ejecutar la tarea (opcional, usa el modo activo por defecto)",
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
