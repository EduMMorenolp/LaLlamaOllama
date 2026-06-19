import axios from "axios";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { toolRegistry } from "./registry.js";
import type { ToolContext } from "./types.js";

// RFC 1918 / private / reserved / link-local IP ranges to block for SSRF prevention
const PRIVATE_CIDRS = [
	{ prefix: "10.", prefixLen: 8 },        // 10.0.0.0/8
	{ prefix: "172.16.", prefixLen: 12 },    // 172.16.0.0/12 (172.16-31)
	{ prefix: "192.168.", prefixLen: 16 },   // 192.168.0.0/16
	{ prefix: "127.", prefixLen: 8 },        // 127.0.0.0/8 (loopback)
	{ prefix: "0.", prefixLen: 8 },          // 0.0.0.0/8
	{ prefix: "169.254.", prefixLen: 16 },   // 169.254.0.0/16 (link-local)
	{ prefix: "::1", prefixLen: 128 },       // IPv6 loopback
	{ prefix: "fe80:", prefixLen: 10 },      // IPv6 link-local
	{ prefix: "fc", prefixLen: 7 },          // IPv6 unique-local fc00::/7
	{ prefix: "fd", prefixLen: 7 },          // IPv6 unique-local fd00::/7
];

function isPrivateIp(ip: string): boolean {
	return PRIVATE_CIDRS.some((cidr) => ip.startsWith(cidr.prefix));
}

async function isPrivateHost(url: URL): Promise<boolean> {
	const hostname = url.hostname;
	if (hostname === "localhost" || hostname === "localhost.localdomain") return true;

	const ip = isIP(hostname);
	if (ip === 4 || ip === 6) {
		return isPrivateIp(hostname);
	}

	// Resolve DNS and check all resolved addresses
	try {
		const addresses = await lookup(hostname, { all: true });
		for (const addr of addresses) {
			const addrStr = typeof addr === "string" ? addr : addr.address;
			if (isPrivateIp(addrStr)) return true;
		}
	} catch {
		// If DNS fails, err on the side of caution and block
		return true;
	}
	return false;
}

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
					"Obtiene el contenido de una URL como texto.",
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
				const parsedUrl = new URL(url);
				if (!["http:", "https:"].includes(parsedUrl.protocol)) {
					return "Error: Only http and https URLs are allowed";
				}

				// SSRF protection: block private/internal hosts
				if (await isPrivateHost(parsedUrl)) {
					return "Error: Access to private or internal network addresses is not allowed";
				}

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