import { getCustomTool, listCustomTools } from "../../db/custom-tools.js";
import { toolRegistry } from "../registry.js";

export function registerExportTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "export_tool",
				description: "Exporta herramientas personalizadas como JSON.",
				parameters: {
					type: "object",
					properties: {
						name: {
							type: "string",
							description: "Nombre de la herramienta a exportar (opcional, exporta todas si vacío)",
						},
					},
				},
			},
		},
		handler: async (args: Record<string, unknown>) => {
			const name = (args.name as string || "").trim();

			try {
				if (name) {
					const tool = getCustomTool(name);
					if (!tool) {
						return `Error: La herramienta '${name}' no existe.`;
					}

					const exportData = {
						version: "1.0",
						type: "custom_tool",
						tool: {
							name: tool.name,
							description: tool.description,
							parameters: JSON.parse(tool.parameters || "{}"),
							handler_type: tool.handler_type,
							handler_config: JSON.parse(tool.handler_config || "{}"),
						},
					};

					return [
						`## 📦 Exportar: ${name}`,
						``,
						"```json",
						JSON.stringify(exportData, null, 2),
						"```",
						``,
						"Guarda este JSON. Puedes importarlo con **import_tool** en otra instancia.",
					].join("\n");
				}

				// Exportar todas
				const tools = listCustomTools();
				if (tools.length === 0) {
					return "No hay herramientas personalizadas para exportar.";
				}

				const exportData = {
					version: "1.0",
					type: "custom_tool_collection",
					tools: tools.map((t) => ({
						name: t.name,
						description: t.description,
						parameters: JSON.parse(t.parameters || "{}"),
						handler_type: t.handler_type,
						handler_config: JSON.parse(t.handler_config || "{}"),
					})),
				};

				const totalBuiltin = toolRegistry.getToolCount() - tools.length;

				return [
					`## 📦 Exportar todas las herramientas (${tools.length})`,
					``,
					"```json",
					JSON.stringify(exportData, null, 2),
					"```",
					``,
					`📊 Built-in: ${totalBuiltin} | Custom exportadas: ${tools.length}`,
				].join("\n");
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al exportar: ${msg}`;
			}
		},
		enabled: true,
	});
}
