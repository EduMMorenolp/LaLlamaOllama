import axios from "axios";
import { toolRegistry } from "./registry.js";
import type { ToolContext } from "./types.js";

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
						"User-Agent": "LaLlamaOllama-Agent-Engine/1.0",
						Accept: "text/html,text/plain,application/json,*/*",
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
