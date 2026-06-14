import { upsertCustomTool } from "../../db/custom-tools.js";
import { toolRegistry } from "../registry.js";
import { executeCustomTool } from "../custom-tool-handler.js";
import type { ToolContext, ToolDefinition } from "../types.js";

export function registerImportTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "import_tool",
				description: "Importa herramientas personalizadas desde JSON (formato export_tool).",
				parameters: {
					type: "object",
					properties: {
						json_data: {
							type: "string",
							description: "JSON con la herramienta(s) a importar. Usa el formato de export_tool.",
						},
						overwrite: {
							type: "boolean",
							description: "Si true, sobrescribe herramientas existentes (default: false)",
						},
					},
					required: ["json_data"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, _ctx: ToolContext) => {
			const jsonData = (args.json_data as string || "").trim();
			const overwrite = args.overwrite === true;

			if (!jsonData) return "Error: Debes proporcionar json_data con el contenido a importar.";

			let parsed: Record<string, unknown>;
			try {
				parsed = JSON.parse(jsonData);
			} catch {
				return "Error: El JSON proporcionado no es válido.";
			}

			if (!parsed || typeof parsed !== "object") {
				return "Error: El JSON debe ser un objeto.";
			}

			const type = parsed.type as string;
			const toolsToImport: Array<Record<string, unknown>> = [];

			if (type === "custom_tool" && parsed.tool) {
				toolsToImport.push(parsed.tool as Record<string, unknown>);
			} else if (type === "custom_tool_collection" && Array.isArray(parsed.tools)) {
				toolsToImport.push(...(parsed.tools as Array<Record<string, unknown>>));
			} else {
				// Intentar detectar si es un array de tools o una tool individual
				if (Array.isArray(parsed)) {
					toolsToImport.push(...parsed);
				} else if (parsed.name && parsed.handler_type) {
					toolsToImport.push(parsed);
				} else {
					return "Error: Formato no reconocido. Usa export_tool para ver el formato esperado.";
				}
			}

			if (toolsToImport.length === 0) {
				return "No se encontraron herramientas para importar en el JSON.";
			}

			let imported = 0;
			let skipped = 0;
			let errors: string[] = [];

			for (const tool of toolsToImport) {
				const name = (tool.name as string || "").trim();
				const description = (tool.description as string || "").trim();
				const handlerType = tool.handler_type as string;
				const handlerConfig = tool.handler_config as Record<string, unknown>;
				const parameters = tool.parameters as Record<string, unknown>;

				// Validar
				if (!name || !description || !handlerType || !handlerConfig) {
					errors.push(`Tool inválida (faltan campos requeridos): ${JSON.stringify(tool)}`);
					continue;
				}

				if (!["bash", "http", "prompt"].includes(handlerType)) {
					errors.push(`'${name}': handler_type '${handlerType}' no válido`);
					continue;
				}

				if (!overwrite && !toolRegistry.isToolNameAvailable(name)) {
					skipped++;
					continue;
				}

				try {
					upsertCustomTool({
						name,
						description,
						parameters: parameters || {},
						handler_type: handlerType as "bash" | "prompt" | "http",
						handler_config: handlerConfig as Record<string, unknown>,
						created_by: "importado",
					});

					const toolDef: ToolDefinition = {
						spec: {
							type: "function",
							function: {
								name,
								description,
								parameters: parameters || {},
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
					imported++;
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err);
					errors.push(`'${name}': ${msg}`);
				}
			}

			let result = `## 📥 Importación completada\n\n`;
			result += `✅ Importadas: ${imported}\n`;
			if (skipped > 0) result += `⏭️ Omitidas (ya existen, usa overwrite=true para sobrescribir): ${skipped}\n`;
			if (errors.length > 0) {
				result += `❌ Errores: ${errors.length}\n`;
				result += `\nDetalles:\n`;
				for (const err of errors.slice(0, 5)) {
					result += `- ${err}\n`;
				}
			}

			return result;
		},
		enabled: true,
	});
}
