import { toolRegistry } from "./registry.js";
import type { ToolContext } from "./types.js";

export function registerDelegateTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "delegate",
				description:
					"Recomienda delegar una sub-tarea a un agente especializado. Úsala cuando una tarea requiera un dominio específico o una perspectiva diferente.",
				parameters: {
					type: "object",
					properties: {
						agent: {
							type: "string",
							description:
								"The recommended agent type: 'backend-dev', 'frontend-dev', 'docker-ops', 'documentation', 'qa-verification', 'mcp-brain', 'explore', or 'general'",
							enum: [
								"backend-dev",
								"frontend-dev",
								"docker-ops",
								"documentation",
								"qa-verification",
								"mcp-brain",
								"explore",
								"general",
							],
						},
						task: {
							type: "string",
							description: "Detailed description of the task to delegate",
						},
						reason: {
							type: "string",
							description: "Why this task should be delegated to this specific agent",
						},
					},
					required: ["agent", "task", "reason"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, _ctx: ToolContext) => {
			const agent = (args.agent as string) || "general";
			const task = (args.task as string) || "";
			const reason = (args.reason as string) || "";

			const safeTask = task.replace(/"/g, "'");

			return [
				`## Delegation Recommendation`,
				`**Agent**: ${agent}`,
				`**Task**: ${task}`,
				`**Reason**: ${reason}`,
				``,
				`To execute: Use the OpenCode task() function to delegate this to the ${agent} agent.`,
				safeTask ? `Example: \`task(${agent}, objective="${safeTask}")\`` : "",
			]
				.filter(Boolean)
				.join("\n");
		},
		enabled: true,
	});
}
