import { toolRegistry } from "./registry.js";
import { getAccessToken, createGoogleClients } from "../google/google-service.js";
import type { ToolContext } from "./types.js";
import type { AppConfig } from "../config.js";

let _config: AppConfig | null = null;

export function setCalendarConfig(config: AppConfig) {
	_config = config;
}

export function registerCalendarTools() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "calendar_list_events",
				description: "Lista eventos de Google Calendar en un rango de fechas.",
				parameters: {
					type: "object",
					properties: {
						time_min: {
							type: "string",
							description: "Fecha inicio ISO (default: ahora). Ej: 2025-01-01T00:00:00Z",
						},
						time_max: {
							type: "string",
							description: "Fecha fin ISO (default: +7 días). Ej: 2025-01-07T23:59:59Z",
						},
						max_results: {
							type: "number",
							description: "Máximo de eventos a retornar (default: 20)",
						},
						calendar_id: {
							type: "string",
							description: "ID del calendario (default: 'primary')",
						},
					},
					required: [],
				},
			},
		},
		handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
			if (!_config) return "Error: Calendar config not initialized.";
			const userId = ctx.userId || "default";
			try {
				const info = await getAccessToken(_config, userId);
				const gcal = createGoogleClients(info.accessToken).calendar;

				const timeMin = (args.time_min as string) || new Date().toISOString();
				const timeMax = (args.time_max as string) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
				const maxResults = (args.max_results as number) || 20;
				const calendarId = (args.calendar_id as string) || "primary";

				const res = await gcal.events.list({
					calendarId,
					timeMin,
					timeMax,
					maxResults,
					singleEvents: true,
					orderBy: "startTime",
				});

				const events = res.data.items || [];
				if (events.length === 0) return "No se encontraron eventos en el rango especificado.";

				let result = `## Eventos de Calendar (${events.length})\n\n`;
				for (const ev of events) {
					const start = ev.start?.dateTime || ev.start?.date || "?";
					const end = ev.end?.dateTime || ev.end?.date || "?";
					const status = ev.status === "cancelled" ? "❌ Cancelado" : "✅ Activo";
					result += `### ${ev.summary || "Sin título"} ${status}\n`;
					result += `- Inicio: ${start}\n`;
					result += `- Fin: ${end}\n`;
					if (ev.description) result += `- Descripción: ${ev.description.substring(0, 200)}\n`;
					if (ev.location) result += `- Ubicación: ${ev.location}\n`;
					if (ev.hangoutLink) result += `- Meet: ${ev.hangoutLink}\n`;
					result += "\n";
				}
				return result;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al listar eventos: ${msg}`;
			}
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "calendar_create_event",
				description: "Crea un evento en Google Calendar.",
				parameters: {
					type: "object",
					properties: {
						summary: {
							type: "string",
							description: "Título del evento",
						},
						start_time: {
							type: "string",
							description: "Fecha/hora inicio ISO. Ej: 2025-01-15T10:00:00-03:00",
						},
						end_time: {
							type: "string",
							description: "Fecha/hora fin ISO. Ej: 2025-01-15T11:00:00-03:00",
						},
						description: {
							type: "string",
							description: "Descripción del evento (opcional)",
						},
						location: {
							type: "string",
							description: "Ubicación física o Meet (opcional)",
						},
						attendees: {
							type: "string",
							description: "Lista de emails separados por coma (opcional)",
						},
						calendar_id: {
							type: "string",
							description: "ID del calendario (default: 'primary')",
						},
					},
					required: ["summary", "start_time", "end_time"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
			if (!_config) return "Error: Calendar config not initialized.";
			const userId = ctx.userId || "default";
			try {
				const info = await getAccessToken(_config, userId);
				const gcal = createGoogleClients(info.accessToken).calendar;

				const attendees: Array<{ email: string }> = (args.attendees as string || "")
					.split(",")
					.map((e: string) => e.trim())
					.filter(Boolean)
					.map((email: string) => ({ email }));

				const event = {
					summary: args.summary as string,
					description: args.description as string || undefined,
					location: args.location as string || undefined,
					start: { dateTime: args.start_time as string, timeZone: "America/Argentina/Buenos_Aires" },
					end: { dateTime: args.end_time as string, timeZone: "America/Argentina/Buenos_Aires" },
					...(attendees.length > 0 ? { attendees } : {}),
				};

				const calendarId = (args.calendar_id as string) || "primary";
				const res = await gcal.events.insert({ calendarId, requestBody: event });
				const created = res.data;

				return `Evento creado: "${created.summary}"\nID: ${created.id}\nLink: ${created.htmlLink || "N/A"}`;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al crear evento: ${msg}`;
			}
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "calendar_update_event",
				description: "Actualiza un evento existente en Google Calendar.",
				parameters: {
					type: "object",
					properties: {
						event_id: {
							type: "string",
							description: "ID del evento a actualizar",
						},
						summary: {
							type: "string",
							description: "Nuevo título (opcional)",
						},
						start_time: {
							type: "string",
							description: "Nueva fecha/hora inicio ISO (opcional)",
						},
						end_time: {
							type: "string",
							description: "Nueva fecha/hora fin ISO (opcional)",
						},
						description: {
							type: "string",
							description: "Nueva descripción (opcional)",
						},
						calendar_id: {
							type: "string",
							description: "ID del calendario (default: 'primary')",
						},
					},
					required: ["event_id"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
			if (!_config) return "Error: Calendar config not initialized.";
			const userId = ctx.userId || "default";
			try {
				const info = await getAccessToken(_config, userId);
				const gcal = createGoogleClients(info.accessToken).calendar;
				const calendarId = (args.calendar_id as string) || "primary";
				const eventId = args.event_id as string;

				const body: Record<string, unknown> = {};
				if (args.summary) body.summary = args.summary;
				if (args.description) body.description = args.description;
				if (args.start_time) body.start = { dateTime: args.start_time, timeZone: "America/Argentina/Buenos_Aires" };
				if (args.end_time) body.end = { dateTime: args.end_time, timeZone: "America/Argentina/Buenos_Aires" };

				const res = await gcal.events.patch({ calendarId, eventId, requestBody: body });
				return `Evento actualizado: "${res.data.summary}" (${eventId})`;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al actualizar evento: ${msg}`;
			}
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "calendar_delete_event",
				description: "Elimina un evento de Google Calendar.",
				parameters: {
					type: "object",
					properties: {
						event_id: {
							type: "string",
							description: "ID del evento a eliminar",
						},
						calendar_id: {
							type: "string",
							description: "ID del calendario (default: 'primary')",
						},
					},
					required: ["event_id"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
			if (!_config) return "Error: Calendar config not initialized.";
			const userId = ctx.userId || "default";
			try {
				const info = await getAccessToken(_config, userId);
				const gcal = createGoogleClients(info.accessToken).calendar;
				const calendarId = (args.calendar_id as string) || "primary";
				const eventId = args.event_id as string;

				await gcal.events.delete({ calendarId, eventId });
				return `Evento "${eventId}" eliminado correctamente.`;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al eliminar evento: ${msg}`;
			}
		},
		enabled: true,
	});
}
