import { cancelRun, getRun } from "../db/runs.js";
import { toolRegistry } from "./registry.js";

export function registerCancelTaskTool(): void {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "cancel_task",
				description: "Cancela una tarea en cola o en ejecuci\u00f3n por su ID.",
				parameters: {
					type: "object",
					properties: {
						runId: {
							type: "number",
							description: "ID de la tarea a cancelar",
						},
					},
					required: ["runId"],
				},
			},
		},
		handler: async (args) => {
			const runId = parseInt(args.runId as string, 10);
			if (isNaN(runId)) {
				return JSON.stringify({ success: false, error: "Invalid runId" });
			}
			const run = getRun(runId);
			if (!run) {
				return JSON.stringify({ success: false, error: "Run " + runId + " not found" });
			}
			if (run.status !== "queued" && run.status !== "running") {
				return JSON.stringify({ success: false, error: "Cannot cancel task with status '" + run.status + "'" });
			}
			cancelRun(runId);
			return JSON.stringify({ success: true, runId, status: "cancelled" });
		},
		enabled: false,
	});
}
