import { cancelRun, createRun, getRun, listRunsByFilters, updateRun } from "../db/runs.js";
import { toolRegistry } from "./registry.js";

export function registerTaskTools(): void {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "task_create",
				description: "Crea una nueva tarea de usuario con detalles opcionales. La tarea queda en cola para ejecución.",
				parameters: {
					type: "object",
					properties: {
						text: { type: "string", description: "Título o descripción breve de la tarea" },
						priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Prioridad (default: medium)" },
						tags: { type: "string", description: "Tags separados por coma (ej: 'python, bugs, frontend')" },
						dueDate: { type: "string", description: "Fecha de vencimiento ISO (ej: '2026-07-15')" },
						description: { type: "string", description: "Descripción detallada de la tarea" },
						scheduledAt: { type: "string", description: "Fecha/hora programada ISO (ej: '2026-07-10T14:00:00')" },
					},
					required: ["text"],
				},
			},
		},
		handler: async (args) => {
			const text = (args.text as string || "").trim();
			if (!text) return JSON.stringify({ success: false, error: "El texto de la tarea es requerido." });

			try {
				const id = createRun({
					chatId: "agent",
					userText: text,
					origin: "agent",
					status: "queued",
					priority: (args.priority as string) || "medium",
					tags: args.tags as string,
					dueDate: args.dueDate as string,
					description: args.description as string,
					scheduledAt: args.scheduledAt as string,
				});
				return JSON.stringify({ success: true, id, status: "queued", text });
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return JSON.stringify({ success: false, error: msg });
			}
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "task_list",
				description: "Lista las tareas del usuario. Puedes filtrar por estado, prioridad o límite de resultados.",
				parameters: {
					type: "object",
					properties: {
						status: {
							type: "string",
							enum: ["queued", "running", "completed", "failed", "cancelled", "backlog", "scheduled"],
							description: "Filtrar por estado",
						},
						priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Filtrar por prioridad" },
						limit: { type: "number", description: "Máximo de resultados (default: 20)" },
					},
				},
			},
		},
		handler: async (args) => {
			try {
				const limit = parseInt(args.limit as string, 10) || 20;
				const runs = listRunsByFilters({ status: args.status as string, limit });
				return JSON.stringify({ success: true, tasks: runs });
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return JSON.stringify({ success: false, error: msg });
			}
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "task_get",
				description: "Obtiene los detalles completos de una tarea por su ID.",
				parameters: {
					type: "object",
					properties: {
						id: { type: "number", description: "ID numérico de la tarea" },
					},
					required: ["id"],
				},
			},
		},
		handler: async (args) => {
			const id = parseInt(args.id as string, 10);
			if (isNaN(id)) return JSON.stringify({ success: false, error: "ID inválido." });

			try {
				const task = getRun(id);
				if (!task) return JSON.stringify({ success: false, error: `Tarea con ID ${id} no encontrada.` });
				return JSON.stringify({ success: true, task });
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return JSON.stringify({ success: false, error: msg });
			}
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "task_update",
				description: "Actualiza propiedades de una tarea existente: estado, prioridad, tags, descripción, fecha, etc.",
				parameters: {
					type: "object",
					properties: {
						id: { type: "number", description: "ID de la tarea a actualizar" },
						status: {
							type: "string",
							enum: ["queued", "running", "completed", "failed", "cancelled", "backlog", "scheduled"],
							description: "Nuevo estado",
						},
						priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Nueva prioridad" },
						tags: { type: "string", description: "Tags separados por coma" },
						dueDate: { type: "string", description: "Nueva fecha de vencimiento ISO" },
						description: { type: "string", description: "Nueva descripción detallada" },
						text: { type: "string", description: "Nuevo título de la tarea" },
					},
					required: ["id"],
				},
			},
		},
		handler: async (args) => {
			const id = parseInt(args.id as string, 10);
			if (isNaN(id)) return JSON.stringify({ success: false, error: "ID inválido." });

			try {
				const existing = getRun(id);
				if (!existing) return JSON.stringify({ success: false, error: `Tarea con ID ${id} no encontrada.` });

				updateRun(id, {
					status: args.status as string,
					priority: args.priority as string,
					tags: args.tags as string,
					dueDate: args.dueDate as string,
					description: args.description as string,
					userText: args.text as string,
				});
				return JSON.stringify({ success: true, id });
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return JSON.stringify({ success: false, error: msg });
			}
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "task_delete",
				description: "Elimina/cancela una tarea por su ID. La marca como cancelada en el sistema.",
				parameters: {
					type: "object",
					properties: {
						id: { type: "number", description: "ID de la tarea a eliminar" },
					},
					required: ["id"],
				},
			},
		},
		handler: async (args) => {
			const id = parseInt(args.id as string, 10);
			if (isNaN(id)) return JSON.stringify({ success: false, error: "ID inválido." });

			try {
				const existing = getRun(id);
				if (!existing) return JSON.stringify({ success: false, error: `Tarea con ID ${id} no encontrada.` });

				cancelRun(id);
				return JSON.stringify({ success: true, id, status: "cancelled" });
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return JSON.stringify({ success: false, error: msg });
			}
		},
		enabled: true,
	});
}
