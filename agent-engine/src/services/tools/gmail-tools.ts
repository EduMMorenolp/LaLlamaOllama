import { toolRegistry } from "./registry.js";
import { getAccessToken, createGoogleClients } from "../google/google-service.js";
import type { ToolContext } from "./types.js";
import type { AppConfig } from "../config.js";

let _config: AppConfig | null = null;

export function setGmailConfig(config: AppConfig) {
	_config = config;
}

export function registerGmailTools() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "gmail_list",
				description: "Lista correos electrónicos de la bandeja de entrada de Gmail.",
				parameters: {
					type: "object",
					properties: {
						max_results: {
							type: "number",
							description: "Máximo de correos a retornar (default: 10, max: 50)",
						},
						query: {
							type: "string",
							description: "Filtro de búsqueda (sintaxis Gmail). Ej: 'is:unread', 'from:user@example.com'",
						},
						label_ids: {
							type: "string",
							description: "Labels separados por coma (default: INBOX). Ej: INBOX,SENT",
						},
					},
					required: [],
				},
			},
		},
		handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
			if (!_config) return "Error: Gmail config not initialized.";
			const userId = ctx.userId || "default";
			try {
				const info = await getAccessToken(_config, userId);
				const gmail = createGoogleClients(info.accessToken).gmail;

				const maxResults = Math.min((args.max_results as number) || 10, 50);
				const labelIds = (args.label_ids as string || "INBOX").split(",").map((l: string) => l.trim()).filter(Boolean);
				const q = (args.query as string) || undefined;

				const res = await gmail.users.messages.list({
					userId: "me",
					maxResults,
					labelIds,
					q,
				});

				const messages = res.data.messages || [];
				if (messages.length === 0) return "No se encontraron correos.";

				let result = `## Correos en Gmail (${messages.length})\n\n`;
				for (const msg of messages.slice(0, 10)) {
					const detail = await gmail.users.messages.get({
						userId: "me",
						id: msg.id!,
						format: "metadata",
						metadataHeaders: ["From", "To", "Subject", "Date"],
					});
					const headers = detail.data.payload?.headers || [];
					const getHdr = (name: string) => headers.find((h) => h.name === name)?.value || "?";
					const subject = getHdr("Subject");
					const from = getHdr("From");
					const date = getHdr("Date");
					const snippet = (detail.data.snippet || "").substring(0, 150);

					result += `### 📧 ${subject}\n`;
					result += `- De: ${from}\n`;
					result += `- Fecha: ${date}\n`;
					result += `- Extracto: ${snippet}...\n`;
					result += `- ID: ${msg.id}\n\n`;
				}
				return result;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al listar correos: ${msg}`;
			}
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "gmail_send",
				description: "Envía un correo electrónico vía Gmail.",
				parameters: {
					type: "object",
					properties: {
						to: {
							type: "string",
							description: "Destinatario(s) separados por coma",
						},
						subject: {
							type: "string",
							description: "Asunto del correo",
						},
						body: {
							type: "string",
							description: "Cuerpo del mensaje (texto plano o HTML)",
						},
						cc: {
							type: "string",
							description: "CC separados por coma (opcional)",
						},
						bcc: {
							type: "string",
							description: "BCC separados por coma (opcional)",
						},
						is_html: {
							type: "boolean",
							description: "Si el body es HTML (default: false)",
						},
					},
					required: ["to", "subject", "body"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
			if (!_config) return "Error: Gmail config not initialized.";
			const userId = ctx.userId || "default";
			try {
				const info = await getAccessToken(_config, userId);
				const gmail = createGoogleClients(info.accessToken).gmail;

				const to = (args.to as string || "").split(",").map((e: string) => e.trim()).filter(Boolean);
				const cc = (args.cc as string || "").split(",").map((e: string) => e.trim()).filter(Boolean);
				const bcc = (args.bcc as string || "").split(",").map((e: string) => e.trim()).filter(Boolean);
				const subject = args.subject as string;
				const body = args.body as string;
				const isHtml = !!args.is_html;

				const contentType = isHtml ? "text/html; charset=utf-8" : "text/plain; charset=utf-8";
				let rawMsg = `To: ${to.join(", ")}\r\nSubject: ${subject}\r\n`;
				rawMsg += `MIME-Version: 1.0\r\nContent-Type: ${contentType}\r\n`;
				if (cc.length > 0) rawMsg += `Cc: ${cc.join(", ")}\r\n`;
				rawMsg += `\r\n${body}`;

				const encoded = Buffer.from(rawMsg, "utf-8").toString("base64url");

				await gmail.users.messages.send({
					userId: "me",
					requestBody: { raw: encoded },
				});

				return `Correo enviado correctamente a: ${to.join(", ")}`;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al enviar correo: ${msg}`;
			}
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "gmail_search",
				description: "Busca correos en Gmail usando la sintaxis de búsqueda de Gmail.",
				parameters: {
					type: "object",
					properties: {
						query: {
							type: "string",
							description: "Query de búsqueda. Ej: 'from:user@example.com after:2024/01/01 has:attachment'",
						},
						max_results: {
							type: "number",
							description: "Máximo de resultados (default: 10)",
						},
					},
					required: ["query"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
			if (!_config) return "Error: Gmail config not initialized.";
			const userId = ctx.userId || "default";
			try {
				const info = await getAccessToken(_config, userId);
				const gmail = createGoogleClients(info.accessToken).gmail;

				const q = args.query as string;
				const maxResults = Math.min((args.max_results as number) || 10, 50);

				const res = await gmail.users.messages.list({
					userId: "me",
					q,
					maxResults,
				});

				const messages = res.data.messages || [];
				if (messages.length === 0) return `No se encontraron correos para: "${q}"`;

				let result = `## Resultados de búsqueda: "${q}" (${messages.length})\n\n`;
				for (const msg of messages.slice(0, 10)) {
					const detail = await gmail.users.messages.get({
						userId: "me",
						id: msg.id!,
						format: "metadata",
						metadataHeaders: ["From", "Subject", "Date"],
					});
					const headers = detail.data.payload?.headers || [];
					const getHdr = (name: string) => headers.find((h) => h.name === name)?.value || "?";
					result += `- ${getHdr("Subject")} | De: ${getHdr("From")} | ${getHdr("Date")} | ID: ${msg.id}\n`;
				}
				return result;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al buscar correos: ${msg}`;
			}
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "gmail_get",
				description: "Obtiene el contenido completo de un correo de Gmail por ID.",
				parameters: {
					type: "object",
					properties: {
						message_id: {
							type: "string",
							description: "ID del mensaje a obtener",
						},
					},
					required: ["message_id"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
			if (!_config) return "Error: Gmail config not initialized.";
			const userId = ctx.userId || "default";
			try {
				const info = await getAccessToken(_config, userId);
				const gmail = createGoogleClients(info.accessToken).gmail;

				const messageId = args.message_id as string;
				const detail = await gmail.users.messages.get({
					userId: "me",
					id: messageId,
					format: "full",
				});

				const headers = detail.data.payload?.headers || [];
				const getHdr = (name: string) => headers.find((h) => h.name === name)?.value || "?";

				let bodyText = "";
				const parts = detail.data.payload?.parts || [detail.data.payload!];
				const extractText = (part: { mimeType?: string | null; body?: { data?: string | null } }) => {
					if ((part.mimeType === "text/plain" || part.mimeType?.startsWith("text/")) && part.body?.data) {
						bodyText += Buffer.from(part.body.data, "base64url").toString("utf-8") + "\n";
					}
				};
				for (const p of parts) {
					if (p.parts) {
						for (const sp of p.parts) extractText(sp);
					}
					extractText(p);
				}

				let result = `## Correo: ${getHdr("Subject")}\n`;
				result += `- De: ${getHdr("From")}\n`;
				result += `- Para: ${getHdr("To")}\n`;
				result += `- Fecha: ${getHdr("Date")}\n`;
				if (getHdr("Cc")) result += `- CC: ${getHdr("Cc")}\n`;
				result += `\n### Cuerpo\n\n${bodyText || "(sin contenido de texto)"}`;

				return result.substring(0, 5000);
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al obtener correo: ${msg}`;
			}
		},
		enabled: true,
	});

	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "gmail_trash",
				description: "Mueve un correo a la papelera de Gmail.",
				parameters: {
					type: "object",
					properties: {
						message_id: {
							type: "string",
							description: "ID del mensaje a eliminar",
						},
					},
					required: ["message_id"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
			if (!_config) return "Error: Gmail config not initialized.";
			const userId = ctx.userId || "default";
			try {
				const info = await getAccessToken(_config, userId);
				const gmail = createGoogleClients(info.accessToken).gmail;

				const messageId = args.message_id as string;
				await gmail.users.messages.trash({ userId: "me", id: messageId });
				return `Correo ${messageId} movido a la papelera.`;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al eliminar correo: ${msg}`;
			}
		},
		enabled: true,
	});
}
