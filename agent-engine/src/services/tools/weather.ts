import axios from "axios";
import { toolRegistry } from "./registry.js";

interface GeoResult {
	lat: string;
	lon: string;
	name: string;
	country: string;
	admin1?: string;
}

interface WeatherResponse {
	current: {
		temperature_2m: number;
		relative_humidity_2m: number;
		apparent_temperature: number;
		precipitation: number;
		weather_code: number;
		wind_speed_10m: number;
	};
	current_units: Record<string, string>;
	daily: {
		time: string[];
		temperature_2m_max: number[];
		temperature_2m_min: number[];
		precipitation_sum: number[];
		weather_code: number[];
	};
}

const WEATHER_CODES: Record<number, string> = {
	0: "Despejado",
	1: "Mayormente despejado",
	2: "Parcialmente nublado",
	3: "Nublado",
	45: "Niebla",
	48: "Niebla con escarcha",
	51: "Llovizna ligera",
	53: "Llovizna moderada",
	55: "Llovizna densa",
	56: "Llovizna helada ligera",
	57: "Llovizna helada densa",
	61: "Lluvia ligera",
	63: "Lluvia moderada",
	65: "Lluvia intensa",
	66: "Lluvia helada ligera",
	67: "Lluvia helada intensa",
	71: "Nieve ligera",
	73: "Nieve moderada",
	75: "Nieve intensa",
	77: "Granos de nieve",
	80: "Chubascos ligeros",
	81: "Chubascos moderados",
	82: "Chubascos intensos",
	85: "Chubascos de nieve ligeros",
	86: "Chubascos de nieve intensos",
	95: "Tormenta eléctrica",
	96: "Tormenta con granizo ligero",
	99: "Tormenta con granizo intenso",
};

const WMO_EMOJIS: Record<number, string> = {
	0: "☀️",
	1: "🌤️",
	2: "⛅",
	3: "☁️",
	45: "🌫️",
	48: "🌫️",
	51: "🌦️",
	53: "🌦️",
	55: "🌦️",
	56: "🌧️",
	57: "🌧️",
	61: "🌧️",
	63: "🌧️",
	65: "🌧️",
	66: "🌧️",
	67: "🌧️",
	71: "🌨️",
	73: "🌨️",
	75: "🌨️",
	77: "🌨️",
	80: "🌦️",
	81: "🌦️",
	82: "🌦️",
	85: "🌨️",
	86: "🌨️",
	95: "⛈️",
	96: "⛈️",
	99: "⛈️",
};

function getWeatherEmoji(code: number): string {
	return WMO_EMOJIS[code] || "🌡️";
}

function getWeatherDesc(code: number): string {
	return WEATHER_CODES[code] || `Código ${code}`;
}

export function registerWeatherTool() {
	toolRegistry.register({
		spec: {
			type: "function",
			function: {
				name: "weather",
				description: "Obtiene el clima actual y pronóstico para una ciudad usando Open-Meteo.",
				parameters: {
					type: "object",
					properties: {
						location: {
							type: "string",
							description: "Nombre de la ciudad o ubicación (ej: 'Buenos Aires', 'London', 'New York')",
						},
						days: {
							type: "number",
							description: "Cantidad de días de pronóstico (1-7, default: 3)",
						},
					},
					required: ["location"],
				},
			},
		},
		handler: async (args: Record<string, unknown>) => {
			const location = (args.location as string || "").trim();
			const days = Math.min(Math.max((args.days as number) || 3, 1), 7);

			if (!location) {
				return "Error: Debes especificar una ubicación (ciudad, país).";
			}

			try {
				// 1. Geocoding
				const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=5&language=es&format=json`;
				const geoRes = await axios.get<{ results?: GeoResult[] }>(geoUrl, { timeout: 10000 });
				const geoResults = geoRes.data.results;

				if (!geoResults || geoResults.length === 0) {
					return `No se encontró la ubicación "${location}". Intenta con otro nombre o agrega el país (ej: "Paris, Francia").`;
				}

				const geo = geoResults[0];
				const locationLabel = [geo.name, geo.admin1, geo.country].filter(Boolean).join(", ");

				// 2. Weather
				const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=${days}`;
				const weatherRes = await axios.get<WeatherResponse>(weatherUrl, { timeout: 10000 });
				const w = weatherRes.data;

				if (!w.current || !w.daily) {
					return `No se pudieron obtener datos climáticos para ${locationLabel}.`;
				}

				const current = w.current;
				const daily = w.daily;
				const unit = w.current_units;

				// Current weather
				const emoji = getWeatherEmoji(current.weather_code);
				const desc = getWeatherDesc(current.weather_code);

				let result = `## ${emoji} Clima en ${locationLabel}\n\n`;
				result += `### 🌡️ Actual\n`;
				result += `- Temperatura: ${current.temperature_2m}${unit.temperature_2m}\n`;
				result += `- Sensación térmica: ${current.apparent_temperature}${unit.temperature_2m}\n`;
				result += `- Humedad: ${current.relative_humidity_2m}${unit.relative_humidity_2m}\n`;
				result += `- Viento: ${current.wind_speed_10m} ${unit.wind_speed_10m}\n`;
				result += `- Precipitación: ${current.precipitation} ${unit.precipitation}\n`;
				result += `- Estado: ${desc}\n\n`;

				// Daily forecast
				result += `### 📅 Pronóstico (${days} días)\n\n`;
				result += `| Día | Estado | Máx | Mín | Lluvia |\n`;
				result += `|-----|--------|-----|-----|--------|\n`;

				for (let i = 0; i < daily.time.length; i++) {
					const dayEmoji = getWeatherEmoji(daily.weather_code[i]);
					const dayDesc = getWeatherDesc(daily.weather_code[i]);
					const date = new Date(daily.time[i] + "T12:00:00").toLocaleDateString("es-ES", {
						weekday: "short",
						day: "numeric",
						month: "short",
					});
					result += `| ${date} | ${dayEmoji} ${dayDesc} | ${daily.temperature_2m_max[i]}${unit.temperature_2m} | ${daily.temperature_2m_min[i]}${unit.temperature_2m} | ${daily.precipitation_sum[i]}${unit.precipitation_sum || "mm"} |\n`;
				}

				result += `\n*Fuente: Open-Meteo.com (gratuito)*`;
				return result;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				return `Error al obtener el clima: ${msg}`;
			}
		},
		enabled: true,
	});
}
