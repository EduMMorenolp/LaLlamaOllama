import { deleteCustomTool, getCustomTool } from "../../db/custom-tools.js";
import { toolRegistry } from "../registry.js";

export function registerDeleteTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "delete_tool",
				description: "Elimina permanentemente una herramienta personalizada.",
				parameters: {
					type: "object",
					properties: {
						name: {
							type: "string",
							description: "Nombre de la herramienta a eliminar",
						},
						confirm: {
							type: "boolean",
							description: "Confirmación explícita. Debe ser true para eliminar.",
						},
					},
					required: ["name", "confirm"],
				},
			},
		},
		handler: async (args: Record<string, unknown>) => {
			const name = (args.name as string || "").trim();
			const confirm = args.confirm === true;

			if (!name) return "Error: El nombre de la herramienta es obligatorio.";
			if (!confirm) {
				return "⚠️ Confirmación requerida: pasa confirm=true para eliminar esta herramienta.";
			}

			const existing = getCustomTool(name);
			if (!existing) {
				return `Error: La herramienta '${name}' no existe.`;
			}

			try {
				// Remover del registry
				toolRegistry.unregisterCustomTool(name);

				// Eliminar de DB
				deleteCustomTool(name);

				return `✅ Herramienta '${name}' eliminada permanentemente.`;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al eliminar herramienta: ${msg}`;
			}
		},
		enabled: true,
	});
}
