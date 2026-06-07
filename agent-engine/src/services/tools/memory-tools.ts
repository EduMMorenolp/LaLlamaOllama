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
					"Store an important piece of information, fact, decision, or discovery in persistent memory. Use this when you learn something important about the project that should be remembered across conversations.",
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
								"Type of memory: 'feature', 'bug-fix', 'architecture', 'decision', 'discovery', or 'note'",
							enum: ["feature", "bug-fix", "architecture", "decision", "discovery", "note"],
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
					"Search through persistent memories to find relevant information from past work. Use this when you need context about previous decisions, discoveries, or project knowledge.",
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
					"Retrieve the recent session context from the shared brain. Use this at the start of a new conversation to get up to speed on what has been happening.",
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
}
