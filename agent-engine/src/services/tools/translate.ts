import axios from "axios";
import { toolRegistry } from "./registry.js";

/**
 * Lista de idiomas soportados (código ISO → nombre)
 */
const LANGUAGES: Record<string, string> = {
	es: "Español",
	en: "Inglés",
	pt: "Portugués",
	fr: "Francés",
	de: "Alemán",
	it: "Italiano",
	ru: "Ruso",
	ja: "Japonés",
	zh: "Chino",
	ko: "Coreano",
	ar: "Árabe",
	hi: "Hindi",
	nl: "Neerlandés",
	pl: "Polaco",
	sv: "Sueco",
	da: "Danés",
	fi: "Finlandés",
	cs: "Checo",
	hu: "Húngaro",
	ro: "Rumano",
	tr: "Turco",
	el: "Griego",
	he: "Hebreo",
	th: "Tailandés",
	vi: "Vietnamita",
	id: "Indonesio",
	ms: "Malayo",
	nb: "Noruego",
	uk: "Ucraniano",
	ca: "Catalán",
	eu: "Euskera",
	gl: "Gallego",
};

/**
 * Intenta detectar el código de idioma desde una cadena.
 * Acepta: "es", "español", "spanish", "en", "inglés", "english", etc.
 */
function detectLangCode(input: string): string {
	const lower = input.toLowerCase().trim();
	// Si es código ISO directo
	if (LANGUAGES[lower]) return lower;

	// Buscar por nombre
	for (const [code, name] of Object.entries(LANGUAGES)) {
		if (name.toLowerCase() === lower) return code;
		if (name.toLowerCase().includes(lower)) return code;
	}

	// Inglés por defecto
	return "en";
}

export function registerTranslateTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "translate",
				description: "Traduce texto entre idiomas usando LibreTranslate. Soporta 30+ idiomas.",
				parameters: {
					type: "object",
					properties: {
						text: {
							type: "string",
							description: "Texto a traducir",
						},
						to: {
							type: "string",
							description: "Idioma destino (código ISO o nombre, ej: 'en', 'es', 'pt', 'fr')",
						},
						from: {
							type: "string",
							description: "Idioma origen (opcional, se auto-detecta). Código ISO o nombre.",
						},
					},
					required: ["text", "to"],
				},
			},
		},
		handler: async (args: Record<string, unknown>) => {
			const text = (args.text as string || "").trim();
			const toRaw = (args.to as string || "").trim();
			const fromRaw = args.from ? (args.from as string).trim() : "";

			if (!text) return "Error: No hay texto para traducir.";
			if (!toRaw) return "Error: Debes especificar el idioma destino.";

			const to = detectLangCode(toRaw);
			const from = fromRaw ? detectLangCode(fromRaw) : "auto";

			if (to === from && from !== "auto") {
				return "El idioma origen y destino son el mismo. No es necesaria traducción.";
			}

			const targetName = LANGUAGES[to] || to;
			const sourceName = from !== "auto" ? (LANGUAGES[from] || from) : "detectado automáticamente";

			try {
				// Try LibreTranslate public API
				const res = await axios.post<{ translatedText: string }>(
					"https://libretranslate.com/translate",
					{
						q: text,
						source: from,
						target: to,
						format: "text",
					},
					{
						timeout: 15000,
						headers: { "Content-Type": "application/json" },
					}
				);

				const translated = res.data.translatedText;

				if (!translated || translated === text) {
					return `No se pudo traducir (el texto ya parece estar en ${targetName} o el servicio no respondió).`;
				}

				return [
					`## 🌍 Traducción`,
					``,
					`**${sourceName}** → **${targetName}**`,
					``,
					`${translated}`,
				].join("\n");
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al traducir: ${msg}. Intenta de nuevo más tarde o verifica los idiomas.`;
			}
		},
		enabled: true,
	});
}
