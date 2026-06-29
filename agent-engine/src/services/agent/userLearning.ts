import { getRecentFeedback, getFeedbackStats } from "../db/feedback.js";
import { getUser, updateUserPreferences, updateUserStats } from "../db/users.js";
import type { BrainClient } from "../brain/client.js";
import type { AppConfig } from "../config.js";
import { callOllamaChatSimple } from "./createOllamaClient.js";
import { logger } from "../../utils/logger.js";

/* ─── Lightweight topic extraction ─────────────────────────────── */

const STOP_WORDS = new Set([
	"que", "de", "en", "la", "el", "lo", "un", "una", "las", "los",
	"del", "con", "por", "para", "como", "más", "pero", "es", "se",
	"no", "su", "le", "ya", "este", "entre", "porque", "era", "son",
	"han", "tiene", "tenía", "fue", "había", "todo", "muy", "sin",
	"sobre", "también", "me", "te", "mi", "tu", "al", "si", "nos",
	"les", "sus", "esto", "ese", "esa", "sido", "vez", "dos", "así",
]);

const TECHNICAL_KEYWORDS = [
	"python", "javascript", "typescript", "node", "react", "docker",
	"kubernetes", "sql", "api", "rest", "graphql", "linux", "bash",
	"git", "código", "función", "clase", "componente", "servicio",
	"base de datos", "servidor", "despliegue", "test", "testing",
	"debug", "deploy", "backend", "frontend", "fullstack", "devops",
	"ia", "machine learning", "inteligencia artificial", "algoritmo",
	"optimización", "rendimiento", "seguridad", "autenticación",
	"middleware", "endpoint", "query", "migración", "framework",
];

const FORMAL_MARKERS = ["agradezco", "solicito", "cordiales", "atte", "usted", "podría"];
const CASUAL_MARKERS = ["hola", "che", "dale", "genial", "bueno", "ok", "claro"];
const TECHNICAL_MARKERS = ["función", "código", "error", "implementar", "refactor", "clase", "interfaz"];

/* ─── Public helpers ───────────────────────────────────────────── */

export function extractTopics(text: string): string[] {
	const lower = text.toLowerCase();
	const found = TECHNICAL_KEYWORDS.filter((kw) => lower.includes(kw));
	// also extract capitalized noun-like words (potential topics)
	const words = lower.split(/[\s,.;!?()]+/);
	const significant = words.filter(
		(w) => w.length > 3 && !STOP_WORDS.has(w) && !found.includes(w)
	);

	// take top 5 most frequent significant words
	const freq = new Map<string, number>();
	for (const w of significant) {
		freq.set(w, (freq.get(w) || 0) + 1);
	}
	const topWords = [...freq.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([w]) => w);

	const all = [...new Set([...found, ...topWords])];
	return all.slice(0, 10);
}

export function analyzeSentiment(text: string): number {
	const lower = text.toLowerCase();

	const positive = [
		"gracias", "bueno", "excelente", "genial", "perfecto", "me gusta",
		"funciona", "maravilloso", "increíble", "fantástico", "bien", "sí",
		"claro", "dale", "me encanta", "súper", "útil", "gran", "ayuda",
	];
	const negative = [
		"mal", "error", "no funciona", "problema", "bug", "feo", "horrible",
		"terrible", "pésimo", "lento", "difícil", "no", "nunca", "nada",
		"molesta", "confuso", "incorrecto", "falla", "queja", "cansado",
	];

	let score = 0.5;
	const words = lower.split(/[\s,.;!?]+/);

	for (const w of words) {
		if (positive.includes(w)) score += 0.05;
		if (negative.includes(w)) score -= 0.05;
	}

	// Multi-word expressions
	for (const p of ["me gusta", "muy bueno", "está bien", "funciona perfecto"]) {
		if (lower.includes(p)) score += 0.08;
	}
	for (const n of ["no me gusta", "está mal", "no funciona", "no sirve"]) {
		if (lower.includes(n)) score -= 0.1;
	}

	return Math.max(0, Math.min(1, score));
}

export function detectCommunicationStyle(text: string): string {
	const lower = text.toLowerCase();
	const formalCount = FORMAL_MARKERS.filter((m) => lower.includes(m)).length;
	const casualCount = CASUAL_MARKERS.filter((m) => lower.includes(m)).length;
	const technicalCount = TECHNICAL_MARKERS.filter((m) => lower.includes(m)).length;

	// Count technical keywords
	const techKwCount = TECHNICAL_KEYWORDS.filter((kw) => lower.includes(kw)).length;
	const totalTech = technicalCount + techKwCount;

	if (totalTech > casualCount && totalTech > formalCount) return "técnico";
	if (casualCount > formalCount) return "casual";
	if (formalCount > casualCount) return "formal";
	return "neutral";
}

export function detectPersona(text: string): string | null {
	const lower = text.toLowerCase();
	if (/desarrollador|programador|developer|programo|codeo|backen|frontend|fullstack/.test(lower)) return "desarrollador";
	if (/estudiante|estudio|universidad|curso|carrera|aprendo/.test(lower)) return "estudiante";
	if (/escritor|escribo|redacto|artículo|blog|contenido/.test(lower)) return "escritor";
	if (/diseño|design|ui|ux|figma|interfaz|visual/.test(lower)) return "diseñador";
	if (/emprendo|negocio|startup|cliente|proyecto/.test(lower)) return "emprendedor";
	if (/sysadmin|admin|infra|servidor|red|devops|sre/.test(lower)) return "sysadmin";
	return null;
}

/* ─── LLM-powered preference extraction ────────────────────────── */

interface LLMPreference {
	preference: string;
	value: string;
	confidence: "alta" | "media" | "baja";
}

async function extractPreferencesWithLLM(
	config: AppConfig,
	userMessage: string,
	assistantResponse: string
): Promise<LLMPreference[]> {
	try {
		const prompt = `Analiza el siguiente intercambio y extrae preferencias explícitas o implícitas del usuario. Responde SOLO con un array JSON (ej. [{"preference": "framework_frontend", "value": "React", "confidence": "alta"}]). Si no hay preferencias claras, responde [].
No incluyas explicaciones, solo el JSON.

MENSAJE DEL USUARIO: ${userMessage.substring(0, 2000)}
RESPUESTA DEL ASISTENTE: ${assistantResponse.substring(0, 500)}`;

		const messages = [
			{ role: "system" as const, content: "Eres un extractor de preferencias preciso. Identificas gustos, aversiones, tecnologías preferidas, estilos de trabajo y patrones de comunicación." },
			{ role: "user" as const, content: prompt },
		];

		const result = await callOllamaChatSimple(config, config.defaultModel, messages, [], { temperature: 0.2 });
		const raw = result.content.trim();

		// Extract JSON array from response (handle markdown fences)
		const jsonMatch = raw.match(/\[[\s\S]*?\]/);
		if (!jsonMatch) return [];

		const parsed = JSON.parse(jsonMatch[0]) as LLMPreference[];
		return Array.isArray(parsed) ? parsed.filter((p) => p.confidence !== "baja") : [];
	} catch (err) {
		logger.warn(`[UserLearning] LLM preference extraction failed: ${err}`);
		return [];
	}
}

/* ─── Main orchestrator ────────────────────────────────────────── */

export interface LearningResult {
	topics: string[];
	sentiment: number;
	style: string;
	persona: string | null;
}

export async function afterResponseLearning(
	userId: string,
	userMessage: string,
	assistantResponse: string,
	brain?: BrainClient,
	config?: AppConfig
): Promise<LearningResult> {
	const combined = `${userMessage} ${assistantResponse}`;

	const topics = extractTopics(combined);
	const sentiment = analyzeSentiment(userMessage);
	const style = detectCommunicationStyle(userMessage);
	const persona = detectPersona(userMessage);

	const user = getUser(userId);
	if (!user) return { topics, sentiment, style, persona };

	const currentCount = user.interaction_count || 0;
	const newCount = currentCount + 1;

	// Rolling average sentiment
	const currentAvg = user.average_sentiment ?? 0.5;
	const newAvg = currentCount === 0 ? sentiment : (currentAvg * currentCount + sentiment) / newCount;

	// Rolling topics (keep last 5 unique)
	let currentTopics: string[] = [];
	if (user.last_topics) {
		try { currentTopics = JSON.parse(user.last_topics); } catch { /* ignore */ }
	}
	const mergedTopics = [...new Set([...topics, ...currentTopics])].slice(0, 5);
	const lastTopicsJson = JSON.stringify(mergedTopics);

	updateUserStats(userId, {
		interaction_count: newCount,
		last_topics: lastTopicsJson,
		average_sentiment: Math.round(newAvg * 100) / 100,
	});

	// Update style if detected
	if (style !== "neutral" && style !== user.communication_style) {
		updateUserPreferences(userId, { communication_style: style });
	}

	// Adjust tone based on feedback patterns
	try {
		const stats = getFeedbackStats(userId);
		if (stats.total >= 3) {
			const ratio = stats.up / stats.total;
			let tone = user.tone_preference;
			if (ratio > 0.8 && stats.total >= 5) tone = tone || "warm";
			if (ratio < 0.3 && stats.total >= 5) tone = "neutral";
			if (tone && tone !== user.tone_preference) {
				updateUserPreferences(userId, { tone_preference: tone });
			}
		}
	} catch { /* optional */ }

	// Update persona
	if (persona && persona !== user.persona) {
		updateUserPreferences(userId, { persona });
	}

	// Save to mcp-brain for long-term memory
	if (brain && topics.length > 0) {
		const interestTitle = `Intereses detectados: ${topics.slice(0, 3).join(", ")}`;
		brain.saveMemory("user_profile", interestTitle, JSON.stringify({
			topics,
			sentiment,
			style,
			persona,
			interaction_count: newCount,
		}), "auto-learned,user-profile").catch(() => {});
	}

	// LLM-powered preference extraction (async, best-effort)
	if (brain && config) {
		extractPreferencesWithLLM(config, userMessage, assistantResponse).then((prefs) => {
			for (const p of prefs) {
				brain.saveMemory("user_profile", `Preferencia: ${p.preference}`, `${p.value} (confianza: ${p.confidence})`, "auto-learned,llm-extracted,user-preference").catch(() => {});
			}
		}).catch(() => {});
	}

	return { topics, sentiment, style, persona };
}
