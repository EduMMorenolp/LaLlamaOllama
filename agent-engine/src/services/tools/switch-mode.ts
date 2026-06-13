import { logger } from "../../utils/logger.js";
import { toolRegistry } from "./registry.js";

export function registerSwitchModeTool(): void {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "switch_mode",
				description: "Cambia el modo activo del agente. Úsala SOLO cuando el usuario te lo pida explícitamente. Ej: 'cambia al modo coach-personal', 'ponte en modo investigador'.",
				parameters: {
					type: "object",
					properties: {
						mode: {
							type: "string",
							description: "Nombre del modo al cual cambiar. Opciones disponibles según modos registrados en el sistema.",
						},
					},
					required: ["mode"],
				},
			},
		},
		handler: async (args: Record<string, unknown>) => {
			const modeName = (args.mode as string || "").trim().toLowerCase();
			if (!modeName) {
				return "Error: Debes especificar el nombre del modo al cual cambiar. Ej: 'asistente', 'coach-personal', 'investigador', 'evolutivo'.";
			}

			try {
				const { getMode, setActiveMode, incrementModeUsage } = await import("../db/modes.js");
				const mode = getMode(modeName);
				if (!mode) {
					const { listModes } = await import("../db/modes.js");
					const available = listModes().map(m => m.name).join(", ");
					return `Error: El modo "${modeName}" no existe. Modos disponibles: ${available}`;
				}

				setActiveMode(modeName);
				incrementModeUsage(modeName);

				await toolRegistry.applyModeTools(mode.tools);

				const { resetAllSessions } = await import("../agent/runAgentCore.js");
				resetAllSessions();

				try {
					const { getWsServer } = await import("./tool-bridge.js");
					const wsServer = getWsServer();
					if (wsServer) {
						wsServer.sendToAll("mode_changed", {
							mode: mode.name,
							label: mode.label,
							system_prompt: mode.system_prompt,
							tools: mode.tools,
							model: mode.model,
							temperature: mode.temperature,
							resetSession: true,
						});
					}
				} catch {
					// WS broadcast is optional
				}

				logger.info(`[SwitchMode] Changed to '${modeName}'`);
				return `✅ Modo cambiado a "${mode.label}" (${modeName}). Ahora tienes acceso a: ${mode.tools.join(", ")}. Las sesiones se han reiniciado para aplicar la nueva configuración.`;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				logger.error(`[SwitchMode] Error changing to '${modeName}': ${msg}`);
				return `Error al cambiar al modo "${modeName}": ${msg}`;
			}
		},
		enabled: true,
	});
}
