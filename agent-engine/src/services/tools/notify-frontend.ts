import { getWsServer } from "./tool-bridge.js";
import { toolRegistry } from "./registry.js";

export function registerNotifyFrontendTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "notify_frontend",
				description: "Envía una notificación emergente al frontend (dashboard web). Aparece como un toast/notificación visual en la interfaz del usuario.",
				parameters: {
					type: "object",
					properties: {
						title: {
							type: "string",
							description: "Título de la notificación (corto, ej: 'Tarea completada', 'Archivo listo')",
						},
						message: {
							type: "string",
							description: "Mensaje detallado de la notificación",
						},
						level: {
							type: "string",
							description: "Nivel de la notificación: 'info' (default), 'success', 'warning', 'error'",
							enum: ["info", "success", "warning", "error"],
						},
					},
					required: ["title", "message"],
				},
			},
		},
		handler: async (args: Record<string, unknown>) => {
			const title = (args.title as string || "").trim();
			const message = (args.message as string || "").trim();
			const level = (args.level as string) || "info";

			if (!title || !message) {
				return "Error: Debes especificar un título y un mensaje.";
			}

			const ws = getWsServer();
			if (!ws) {
				return "Error: No hay conexión WebSocket activa con el frontend.";
			}

			try {
				ws.sendToAll("notification", {
					title,
					message,
					level,
					timestamp: new Date().toISOString(),
				});

				return `✅ Notificación enviada al frontend: "${title}"`;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al enviar notificación: ${msg}`;
			}
		},
		enabled: true,
	});
}
