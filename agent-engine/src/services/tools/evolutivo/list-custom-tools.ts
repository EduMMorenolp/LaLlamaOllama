import { listCustomTools, getCustomToolsCount } from "../../db/custom-tools.js";
import { toolRegistry } from "../registry.js";

export function registerListCustomTools() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "list_custom_tools",
				description: "Lista todas las herramientas personalizadas creadas por el usuario con sus tipos y configuraciones.",
				parameters: {
					type: "object",
					properties: {
						detailed: {
							type: "boolean",
							description: "Si es true, muestra la configuración completa de cada herramienta (default: false)",
						},
					},
				},
			},
		},
		handler: async (args: Record<string, unknown>) => {
			const detailed = args.detailed === true;

			try {
				const tools = listCustomTools();
				const totalBuiltin = toolRegistry.getToolCount() - tools.length;
				const totalCustom = getCustomToolsCount();

				if (tools.length === 0) {
					return [
						`## 🧬 Herramientas Personalizadas`,
						``,
						`No hay herramientas personalizadas aún.`,
						`Usa **create_tool** para crear la primera.`,
						``,
						`📊 **Built-in**: ${totalBuiltin} | **Custom**: 0 | **Total**: ${totalBuiltin}`,
					].join("\n");
				}

				let output = `## 🧬 Herramientas Personalizadas (${tools.length})\n\n`;

				for (let i = 0; i < tools.length; i++) {
					const t = tools[i];
					const config = JSON.parse(t.handler_config || "{}");
					const params = JSON.parse(t.parameters || "{}");
					const paramNames = params.properties ? Object.keys(params.properties).join(", ") : "(ninguno)";

					output += `### ${i + 1}. ${t.name}\n`;
					output += `**Descripción**: ${t.description}\n`;
					output += `**Tipo**: \`${t.handler_type}\`\n`;

					if (detailed) {
						if (t.handler_type === "bash") {
							output += `**Comando**: \`${config.command || ""}\`\n`;
						} else if (t.handler_type === "http") {
							output += `**URL**: ${config.url || ""}\n`;
							output += `**Método**: ${(config.method || "GET").toUpperCase()}\n`;
						} else if (t.handler_type === "prompt") {
							output += `**Prompt**: ${(config.prompt || "").substring(0, 200)}${((config.prompt || "").length > 200) ? "..." : ""}\n`;
						}
						output += `**Parámetros**: ${paramNames}\n`;
						output += `**Creada**: ${t.created_at}\n`;
					} else {
						output += `**Parámetros**: ${paramNames}\n`;
					}
					output += `\n`;
				}

				output += `📊 **Built-in**: ${totalBuiltin} | **Custom**: ${totalCustom} | **Total**: ${totalBuiltin + totalCustom}`;
				return output;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al listar herramientas: ${msg}`;
			}
		},
		enabled: true,
	});
}
