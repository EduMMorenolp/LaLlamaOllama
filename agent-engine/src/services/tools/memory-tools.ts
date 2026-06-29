import type { BrainClient } from "../brain/client.js";
import { toolRegistry } from "./registry.js";
import type { ToolContext } from "./types.js";

export function registerMemoryTools(brain: BrainClient) {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "memorize",
				description:
					"Guarda información importante en la memoria persistente.",
				parameters: {
					type: "object",
					properties: {
						title: {
							type: "string",
							description: "A short, descriptive title for this memory",
						},
						content: {
							type: "string",
							description: "The detailed content to remember. Include what, why, and where context.",
						},
						type: {
							type: "string",
							description:
								"Type: 'feature', 'bug-fix', 'architecture', 'decision', 'discovery', 'user_profile', or 'note'",
							enum: ["feature", "bug-fix", "architecture", "decision", "discovery", "user_profile", "note"],
						},
						tags: {
							type: "string",
							description: "Optional comma-separated tags for categorization",
						},
					},
					required: ["title", "content", "type"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, _ctx: ToolContext) => {
			const title = args.title as string;
			const content = args.content as string;
			const type = (args.type as string) || "note";
			const tags = args.tags as string | undefined;

			if (!title || !content) return "Error: title and content are required";

			const existing = await brain.searchMemories(title, 5, type);
			const duplicate = existing.find(
				(m) => m.title.toLowerCase().includes(title.toLowerCase()) || title.toLowerCase().includes(m.title.toLowerCase())
			);
			if (duplicate) {
				return `Ya existe una memoria similar: "${duplicate.title}". Usa update_memory si deseas modificarla.`;
			}

			await brain.saveMemory(type, title, content, tags);
			return `Memorized: "${title}"`;
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "recall",
				description:
					"Busca información relevante en la memoria persistente.",
				parameters: {
					type: "object",
					properties: {
						query: {
							type: "string",
							description: "The search query to find relevant memories",
						},
						limit: {
							type: "number",
							description: "Maximum number of results to return (default: 10)",
						},
					},
					required: ["query"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, _ctx: ToolContext) => {
			const query = args.query as string;
			const limit = (args.limit as number) || 10;

			if (!query) return "Error: query is required";

			const results = await brain.searchMemories(query, limit);

			if (results.length === 0) {
				return "No relevant memories found.";
			}

			return results
				.map(
					(r, i) =>
						`[${i + 1}] ${r.title} (${r.type})\n${r.content.substring(0, 500)}${r.content.length > 500 ? "..." : ""}`
				)
				.join("\n\n");
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "get_context",
				description:
					"Obtiene el contexto reciente de la sesión desde el brain compartido.",
				parameters: {
					type: "object",
					properties: {
						limit: {
							type: "number",
							description: "Maximum number of recent memories to retrieve (default: 10)",
						},
					},
				},
			},
		},
		handler: async (args: Record<string, unknown>, _ctx: ToolContext) => {
			const limit = (args.limit as number) || 10;
			const context = await brain.getContext(limit);
			return context || "No recent context available.";
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "update_memory",
				description: "Actualiza una memoria existente (título, contenido, tipo o tags).",
				parameters: {
					type: "object",
					properties: {
						id: { type: "string", description: "ID de la memoria a actualizar" },
						title: { type: "string", description: "Nuevo título (opcional)" },
						content: { type: "string", description: "Nuevo contenido (opcional)" },
						type: { type: "string", description: "Nuevo tipo (opcional): knowledge, feature, bug-fix, architecture, decision, discovery, note, learning, configuration, prompt, user_profile", enum: ["knowledge", "feature", "bug-fix", "architecture", "decision", "discovery", "note", "learning", "configuration", "prompt", "user_profile"] },
						tags: { type: "string", description: "Nuevos tags separados por coma (opcional)" },
					},
					required: ["id"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, _ctx: ToolContext) => {
			const id = args.id as string;
			if (!id) return "Error: id is required";
			const data: Record<string, unknown> = {};
			if (args.title) data.title = args.title;
			if (args.content) data.content = args.content;
			if (args.type) data.type = args.type;
			if (args.tags) data.tags = args.tags;
			const ok = await brain.updateMemory(id, data);
			return ok ? `Memoria "${id}" actualizada` : "Error: no se pudo actualizar la memoria";
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "delete_memory",
				description: "Elimina una memoria del cerebro por su ID.",
				parameters: {
					type: "object",
					properties: {
						id: { type: "string", description: "ID de la memoria a eliminar" },
					},
					required: ["id"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, _ctx: ToolContext) => {
			const id = args.id as string;
			if (!id) return "Error: id is required";
			const ok = await brain.deleteMemory(id);
			return ok ? `Memoria "${id}" eliminada` : "Error: no se pudo eliminar la memoria";
		},
		enabled: true,
	});
}
