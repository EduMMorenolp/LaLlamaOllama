import axios from "axios";
import { toolRegistry } from "./registry.js";
import type { ToolContext } from "./types.js";

// Strip HTML tags and clean up the content for readability
function htmlToText(html: string): string {
	// Remove script and style tags and their content
	let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
	text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
	text = text.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "");
	// Remove all HTML tags
	text = text.replace(/<[^>]+>/g, " ");
	// Decode common entities
	text = text.replace(/&nbsp;/g, " ");
	text = text.replace(/&amp;/g, "&");
	text = text.replace(/&lt;/g, "<");
	text = text.replace(/&gt;/g, ">");
	text = text.replace(/&quot;/g, '"');
	text = text.replace(/&#39;/g, "'");
	text = text.replace(/&[a-z]+;/g, " ");
	// Remove excessive whitespace
	text = text.replace(/\s+/g, " ");
	// Remove excessive newlines
	text = text.replace(/\n\s*\n\s*\n/g, "\n\n");
	return text.trim();
}

export function registerReadUrlTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "read_url",
				description:
					"Fetch the content of a URL and return it as text. Useful for reading web pages, API responses, and documentation.",
				parameters: {
					type: "object",
					properties: {
						url: {
							type: "string",
							description: "The URL to fetch",
						},
						max_length: {
							type: "number",
							description: "Maximum characters to return (default: 10000)",
						},
					},
					required: ["url"],
				},
			},
		},
		handler: async (args: Record<string, unknown>, _ctx: ToolContext) => {
			const url = args.url as string;
			const maxLength = (args.max_length as number) || 10000;

			if (!url) return "Error: url is required";

			try {
				new URL(url);

				const res = await axios.get(url, {
					timeout: 15000,
					headers: {
						"User-Agent":
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
						Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
						"Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
					},
					responseType: "text",
					maxRedirects: 5,
				});

				let content: string;
				if (typeof res.data === "string") {
					content = res.data;
				} else {
					content = JSON.stringify(res.data, null, 2);
				}

				// Detect if content is HTML and clean it
				const isHtml =
					typeof content === "string" &&
					(content.trim().startsWith("<!") ||
						content.trim().startsWith("<html") ||
						content.includes("<script") ||
						content.includes("<div"));
				if (isHtml) {
					content = htmlToText(content);
					// If the cleaned text is too short, the HTML stripping might have removed everything
					// In that case, keep the original but note it's HTML
					if (content.length < 50) {
						content = `[HTML content - could not parse meaningfully]\nRaw: ${res.data.substring(0, maxLength)}`;
					}
				}

				if (content.length > maxLength) {
					content = content.substring(0, maxLength) + "\n... [truncated]";
				}

				return `Content from ${url}:\n${content}`;
			} catch (err: unknown) {
				if (err instanceof Error) {
					return `Error fetching URL: ${err.message}`;
				}
				return `Error fetching URL: ${String(err)}`;
			}
		},
		enabled: true,
	});
}
