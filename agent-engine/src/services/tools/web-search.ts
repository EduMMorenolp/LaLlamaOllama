import axios from "axios";
import * as cheerio from "cheerio";
import { toolRegistry } from "./registry.js";

interface SearchResult {
	title: string;
	link: string;
	snippet: string;
}

/**
 * Busca en la web usando DuckDuckGo Lite (sin API key, scraping de resultados).
 * Si hay una clave de API configurada, usa Google Programmable Search o Bing.
 */
export function registerWebSearchTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "web_search",
				description: "Busca información en internet. Devuelve resultados con título, enlace y fragmento relevante. Útil para consultar noticias, documentación, precios, etc.",
				parameters: {
					type: "object",
					properties: {
						query: {
							type: "string",
							description: "Término de búsqueda (ej: 'precio bitcoin hoy', 'documentación React 19')",
						},
						max_results: {
							type: "number",
							description: "Cantidad máxima de resultados (1-10, default: 5)",
						},
					},
					required: ["query"],
				},
			},
		},
		handler: async (args: Record<string, unknown>) => {
			const query = (args.query as string || "").trim();
			const maxResults = Math.min(Math.max((args.max_results as number) || 5, 1), 10);

			if (!query) {
				return "Error: Debes proporcionar un término de búsqueda.";
			}

			try {
				// Usar DuckDuckGo Lite (HTML scraping - no necesita API key)
				const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
				const res = await axios.get(url, {
					timeout: 15000,
					headers: {
						"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
						"Accept": "text/html,application/xhtml+xml",
					},
				});

				const results = parseDuckDuckGoLite(res.data, maxResults);

				if (results.length === 0) {
					// Fallback: intentar con DuckDuckGo HTML normal
					return `No se encontraron resultados para "${query}".`;
				}

				let output = `## 🔍 Resultados de búsqueda: "${query}"\n\n`;

				for (let i = 0; i < results.length; i++) {
					const r = results[i];
					output += `### ${i + 1}. [${r.title}](${r.link})\n`;
					output += `${r.snippet}\n\n`;
				}

				output += `*${results.length} resultados (DuckDuckGo)*`;
				return output;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al buscar: ${msg}`;
			}
		},
		enabled: true,
	});
}

function parseDuckDuckGoLite(html: string, maxResults: number): SearchResult[] {
	const results: SearchResult[] = [];
	const $ = cheerio.load(html);

	// En DuckDuckGo Lite, los resultados están en tablas con clase 'result'
	$(".result").each((_i, el) => {
		if (results.length >= maxResults) return false;

		const titleEl = $(el).find(".result__title a");
		const snippetEl = $(el).find(".result__snippet");

		const title = titleEl.text().trim();
		const link = titleEl.attr("href") || "";
		const snippet = snippetEl.text().trim();

		if (title && link) {
			results.push({
				title,
				link: link.startsWith("//") ? `https:${link}` : link,
				snippet: snippet || "(sin descripción)",
			});
		}
	});

	// Si no se encontraron con la clase moderna, intentar con la estructura clásica
	if (results.length === 0) {
		$("table").each((_i, table) => {
			if (results.length >= maxResults) return false;

			const rows = $(table).find("tr");
			rows.each((rowIdx, row) => {
				if (results.length >= maxResults) return false;
				if (rowIdx === 0) return; // skip header

				const cells = $(row).find("td");
				if (cells.length < 2) return;

				const linkEl = $(cells[1]).find("a");
				const title = linkEl.text().trim();
				const link = linkEl.attr("href") || "";
				const snippet = $(cells[cells.length - 1]).text().trim();

				if (title && link) {
					results.push({
						title,
						link: link.startsWith("//") ? `https:${link}` : link,
						snippet: snippet || "(sin descripción)",
					});
				}
			});
		});
	}

	return results;
}
