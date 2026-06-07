import { upsertCustomTool } from "../../db/custom-tools.js";
import { toolRegistry } from "../registry.js";
import { executeCustomTool } from "../custom-tool-handler.js";
import type { ToolContext } from "../types.js";
import type { ToolDefinition } from "../types.js";

export function registerCreateTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "create_tool",
				description: "Crea una nueva herramienta personalizada. Se almacena en DB y queda disponible para todos los modos. Tipos: 'bash' (comando shell), 'http' (request API), 'prompt' (plantilla de prompt para el agente).",
				parameters: {
					type: "object",
					properties: {
						name: {
							type: "string",
							description: "Nombre único de la herramienta (snake_case, ej: 'saludar', 'analizar_codigo')",
						},
						description: {
							type: "string",
							description: "Descripción clara de qué hace la herramienta (el agente la usará para decidir cuándo llamarla)",
						},
						handler_type: {
							type: "string",
							description: "Tipo de handler: 'bash' (ejecuta comando), 'http' (llamada API), 'prompt' (genera prompt para el agente)",
							enum: ["bash", "http", "prompt"],
						},
						handler_config: {
							type: "object",
							description: "Config del handler según tipo. bash: {command, timeout?, workdir?}. http: {url, method?, headers?, body?}. prompt: {prompt}",
							properties: {
								command: { type: "string", description: "[bash] Comando a ejecutar. Usa {{param}} para parámetros" },
								url: { type: "string", description: "[http] URL de la API. Usa {{param}} para parámetros" },
								method: { type: "string", description: "[http] Método HTTP: GET, POST, PUT, DELETE (default: GET)" },
								prompt: { type: "string", description: "[prompt] Plantilla de prompt. Usa {{param}} para parámetros" },
							},
						},
						parameters: {
							type: "object",
							description: "Schema JSON de los parámetros que acepta la herramienta",
							properties: {
								type: { type: "string", enum: ["object"] },
								properties: { type: "object", description: "Mapa de nombre→{type,description} para cada parámetro" },
								required: { type: "array", items: { type: "string" }, description: "Lista de parámetros requeridos" },
							},
						},
					},
					required: ["name", "description", "handler_type", "handler_config"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, _ctx: ToolContext) => {
			const name = (args.name as string || "").trim();
			const description = (args.description as string || "").trim();
			const handlerType = args.handler_type as string;
			const handlerConfig = args.handler_config as Record<string, unknown> || {};
			const parameters = (args.parameters as Record<string, unknown>) || { type: "object", properties: {} };

			// Validaciones
			if (!name) return "Error: El nombre de la herramienta es obligatorio.";
			if (!/^[a-z][a-z0-9_]*$/.test(name)) {
				return "Error: El nombre debe empezar con minúscula y solo contener letras, números y guiones bajos (snake_case).";
			}
			if (name.length > 50) return "Error: El nombre no puede exceder 50 caracteres.";
			if (!description) return "Error: La descripción es obligatoria.";
			if (!["bash", "http", "prompt"].includes(handlerType)) {
				return "Error: handler_type debe ser 'bash', 'http' o 'prompt'.";
			}
			if (!toolRegistry.isToolNameAvailable(name)) {
				return `Error: Ya existe una herramienta llamada '${name}'. Usa edit_tool para modificarla.`;
			}

			// Validar handler_config según tipo
			if (handlerType === "bash" && !handlerConfig.command) {
				return "Error: Para tipo 'bash' debes especificar handler_config.command.";
			}
			if (handlerType === "http" && !handlerConfig.url) {
				return "Error: Para tipo 'http' debes especificar handler_config.url.";
			}
			if (handlerType === "prompt" && !handlerConfig.prompt) {
				return "Error: Para tipo 'prompt' debes especificar handler_config.prompt.";
			}

			try {
				// Guardar en DB
				upsertCustomTool({
					name,
					description,
					parameters: parameters as Record<string, unknown>,
					handler_type: handlerType as "bash" | "prompt" | "http",
					handler_config: handlerConfig as Record<string, unknown>,
					created_by: "evolutivo",
				});

				// Registrar en el registry en caliente
				const toolDef: ToolDefinition = {
					spec: {
						type: "function",
						function: {
							name,
							description,
							parameters: parameters as Record<string, unknown>,
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

				return `✅ Herramienta '${name}' creada exitosamente.\n\nDescripción: ${description}\nTipo: ${handlerType}\n\nTodos los modos pueden ahora incluir '${name}' en su lista de herramientas.`;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al crear herramienta: ${msg}`;
			}
		},
		enabled: true,
	});
}
