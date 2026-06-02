import { type ToolContext, toolRegistry } from "./registry.js";

/**
 * La herramienta de delegación permite al agent-engine delegar sub-tareas
 * a agentes OpenCode existentes (orchestrator, backend-dev, frontend-dev, etc.)
 * usando el sistema de task() del orquestador.
 *
 * En el contexto actual, la delegación se implementa como una recomendación
 * al usuario, ya que la ejecución cruzada requiere integración con OpenCode.
 */
export function registerDelegateTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "delegate",
				description:
					"Recommend delegating a sub-task to a specialized agent. Use when a task is better handled by a domain-specific agent (backend-dev, frontend-dev, docker-ops, etc.) or requires a fresh perspective.",
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
			const agent = args.agent as string;
			const task = args.task as string;
			const reason = args.reason as string;

			return [
				`## Delegation Recommendation`,
				`**Agent**: ${agent}`,
				`**Task**: ${task}`,
				`**Reason**: ${reason}`,
				``,
				`To execute: Use the OpenCode task() function to delegate this to the ${agent} agent.`,
				`Example: \`task(${agent}, objective="${task.replace(/"/g, "'")}")\``,
			].join("\n");
		},
		enabled: true,
	});
}
