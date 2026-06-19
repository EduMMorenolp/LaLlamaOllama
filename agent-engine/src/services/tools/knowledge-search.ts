import { getRuntimeContext } from "../runtime.js";
import { toolRegistry } from "./registry.js";

export function registerKnowledgeSearchTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "knowledge_search",
				description: "Busca en la base de conocimiento del proyecto usando búsqueda semántica (RAG).",
				parameters: {
					type: "object",
					properties: {
						query: {
							type: "string",
							description: "Texto de búsqueda semántica (frases completas o palabras clave).",
						},
						limit: {
							type: "number",
							description: "Cantidad máxima de resultados (1-20, default: 5)",
						},
						type: {
							type: "string",
							description: "Filtrar por tipo: 'knowledge', 'feature', 'bug-fix', 'architecture', 'decision' (vacío = todos)",
						},
					},
					required: ["query"],
				},
			},
		},
		handler: async (args: Record<string, unknown>) => {
			const query = (args.query as string || "").trim();
			const limit = Math.min(Math.max((args.limit as number) || 5, 1), 20);
			const typeFilter = (args.type as string || "").trim();

			if (!query) {
				return "Error: Debes proporcionar un término de búsqueda.";
			}

			let brain;
			try {
				const ctx = getRuntimeContext();
				brain = ctx.brain;
			} catch {
				return "Error: El sistema de conocimiento no está disponible (Brain no conectado).";
			}

			try {
				const results = await brain.searchMemories(query, limit, typeFilter || undefined);

				if (!results || results.length === 0) {
					return `No se encontraron resultados en la base de conocimiento para "${query}".\n\nPuedes usar 'memorize' para guardar información nueva.`;
				}

				let output = `## Resultados en la base de conocimiento\n\n`;
				output += `Búsqueda: "${query}" | ${results.length} resultado(s)\n\n`;

				for (let i = 0; i < results.length; i++) {
					const r = results[i];
					const type = r.type ? `[${r.type}]` : "";
					const date = r.created_at
						? new Date(r.created_at).toLocaleDateString("es-ES")
						: "";

					output += `### ${i + 1}. ${type} ${r.title || "Sin título"}\n`;
					if (date) output += `Fecha: ${date}`;
					if (r.tags) output += ` | Tags: ${r.tags}`;
					output += `\n\n${r.content?.substring(0, 500)}${(r.content?.length || 0) > 500 ? "..." : ""}\n\n`;
					if (r.id) output += `ID: \`${r.id}\`\n`;
					output += `\n`;
				}

				output += `\n*Búsqueda semántica en MCP Brain*`;
				return output;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al buscar en la base de conocimiento: ${msg}`;
			}
		},
		enabled: true,
	});
}