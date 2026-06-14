import { getCustomTool } from "../../db/custom-tools.js";
import { toolRegistry } from "../registry.js";
import { executeCustomTool } from "../custom-tool-handler.js";
import type { ToolContext } from "../types.js";

export function registerTestTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "test_tool",
				description: "Prueba una herramienta personalizada con parámetros de ejemplo.",
				parameters: {
					type: "object",
					properties: {
						name: {
							type: "string",
							description: "Nombre de la herramienta a probar",
						},
						params: {
							type: "object",
							description: "Objeto con los parámetros de prueba (key: value)",
						},
					},
					required: ["name"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
			const name = (args.name as string || "").trim();
			const testParams = (args.params as Record<string, unknown>) || {};

			if (!name) return "Error: El nombre de la herramienta es obligatorio.";

			const existing = getCustomTool(name);
			if (!existing) {
				// Podría ser una tool built-in
				if (toolRegistry.get(name)) {
					return `'${name}' es una herramienta integrada. Usa la herramienta directamente para probarla.`;
				}
				return `Error: La herramienta '${name}' no existe.`;
			}

			try {
				const handlerConfig = JSON.parse(existing.handler_config || "{}");

				const result = await executeCustomTool(
					existing.handler_type,
					handlerConfig,
					testParams,
					ctx,
				);

				return [
					`## 🧪 Test de herramienta: ${name}`,
					`**Tipo**: ${existing.handler_type}`,
					`**Parámetros**: ${JSON.stringify(testParams)}`,
					``,
					`### Resultado:`,
					``,
					result,
				].join("\n");
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al probar herramienta: ${msg}`;
			}
		},
		enabled: true,
	});
}
