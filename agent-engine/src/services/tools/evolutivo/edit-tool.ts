import { getCustomTool, upsertCustomTool } from "../../db/custom-tools.js";
import { toolRegistry } from "../registry.js";
import { executeCustomTool } from "../custom-tool-handler.js";
import type { ToolContext, ToolDefinition } from "../types.js";

export function registerEditTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "edit_tool",
				description: "Modifica una herramienta personalizada existente. Solo se actualizan los campos proporcionados.",
				parameters: {
					type: "object",
					properties: {
						name: {
							type: "string",
							description: "Nombre de la herramienta a modificar",
						},
						description: {
							type: "string",
							description: "Nueva descripción (opcional)",
						},
						handler_type: {
							type: "string",
							description: "Nuevo tipo de handler (opcional): 'bash', 'http', 'prompt'",
							enum: ["bash", "http", "prompt"],
						},
						handler_config: {
							type: "object",
							description: "Nueva configuración del handler (opcional). Se hace merge con la existente.",
						},
						parameters: {
							type: "object",
							description: "Nuevo schema de parámetros (opcional). Reemplaza completamente el anterior.",
						},
					},
					required: ["name"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, _ctx: ToolContext) => {
			const name = (args.name as string || "").trim();

			if (!name) return "Error: El nombre de la herramienta es obligatorio.";

			const existing = getCustomTool(name);
			if (!existing) {
				return `Error: La herramienta '${name}' no existe. Usa create_tool para crearla.`;
			}

			try {
				const description = (args.description as string || "").trim() || existing.description;
				const handlerType = (args.handler_type as string || "").trim() || existing.handler_type;
				const existingConfig = JSON.parse(existing.handler_config || "{}");
				const newConfig = args.handler_config as Record<string, unknown> | undefined;
				const handlerConfig = newConfig ? { ...existingConfig, ...newConfig } : existingConfig;
				const parameters = args.parameters
					? (args.parameters as Record<string, unknown>)
					: JSON.parse(existing.parameters || "{}");

				if (!["bash", "http", "prompt"].includes(handlerType)) {
					return "Error: handler_type debe ser 'bash', 'http' o 'prompt'.";
				}

				// Actualizar DB
				upsertCustomTool({
					name,
					description,
					parameters,
					handler_type: handlerType as "bash" | "prompt" | "http",
					handler_config: handlerConfig as Record<string, unknown>,
					created_by: existing.created_by,
				});

				// Re-registrar en el registry
				const toolDef: ToolDefinition = {
					spec: {
						type: "function",
						function: {
							name,
							description,
							parameters,
						},
					},
					handler: async (callArgs: Record<string, unknown>, ctx: ToolContext) => {
						return executeCustomTool(
							handlerType as "bash" | "prompt" | "http",
							handlerConfig as Record<string, unknown>,
							callArgs,
							ctx,
						);
					},
					enabled: true,
				};

				toolRegistry.registerCustomTool(name, toolDef);

				return `✅ Herramienta '${name}' actualizada exitosamente.`;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al editar herramienta: ${msg}`;
			}
		},
		enabled: true,
	});
}
