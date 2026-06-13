import type OpenAI from "openai";
import { logger } from "../../utils/logger.js";
import type { BrainClient } from "../brain/client.js";
import { getGeneralConfig } from "../db/experts.js";
import { getMessages, saveMessage } from "../db/messages.js";
import { toolRegistry } from "../tools/registry.js";
import type { ToolSpec as RegistryToolSpec } from "../tools/types.js";
import { buildSystemPrompt } from "./buildPrompt.js";
import { createClient, getDefaultModelConfig } from "./createClient.js";
import type { AgentOptions, AgentResult, SessionState } from "./types.js";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface SessionEntry {
	state: SessionState;
	lastAccess: number;
}

const sessions = new Map<string, SessionEntry>();

function cleanupExpiredSessions(): void {
	const now = Date.now();
	for (const [id, entry] of sessions) {
		if (now - entry.lastAccess > SESSION_TTL_MS) {
			logger.agent(`[${id}] Session expired (TTL ${SESSION_TTL_MS / 1000}s)`);
			sessions.delete(id);
		}
	}
}

function getSession(opts: AgentOptions): SessionState {
	const { chatId, config } = opts;

	// Always cleanup if threshold is close
	if (sessions.size > 80) {
		cleanupExpiredSessions();
	}

	const existing = sessions.get(chatId);
	if (existing) {
		existing.lastAccess = Date.now();
		return existing.state;
	}

	const state: SessionState = {
		messages: [],
		toolContext: {
			sessionId: chatId,
			workspaceDir: config.workspaceDir,
			chatId,
		},
	};
	sessions.set(chatId, { state, lastAccess: Date.now() });

	return state;
}

export async function runAgentCore(opts: AgentOptions): Promise<AgentResult> {
	const { chatId, userText, config, brain, onToolCall, onToolResult, onStatus, onTyping } = opts;
	const startTime = Date.now();

	onTyping?.(true);

	const session = getSession(opts);

	let generalModel = config.defaultModel;
	let generalTemperature = 0.7;
	let generalHistoryLimit = 10;

	// Preferir modo específico (modeId) > modo activo > __general__ > defaults
	try {
		const { getActiveMode, getMode } = await import("../db/modes.js");
		let mode = null;
		if (opts.modeId) {
			mode = getMode(opts.modeId);
		}
		if (!mode) {
			mode = getActiveMode();
		}
		if (mode) {
			if (mode.model) generalModel = mode.model;
			if (mode.temperature != null) generalTemperature = mode.temperature;
			if (mode.history_limit != null) generalHistoryLimit = mode.history_limit;
		}
	} catch {
		// fallback a __general__
		try {
			const g = getGeneralConfig();
			if (g) {
				if (g.model) generalModel = g.model;
				if (g.temperature != null) generalTemperature = g.temperature;
				if (g.history_limit != null) generalHistoryLimit = g.history_limit;
			}
		} catch {
			// use defaults
		}
	}

	if (opts.preferredModel && opts.preferredModel !== "default") {
		generalModel = opts.preferredModel;
	}

	if (!opts.skipPersistUserMsg) {
		try {
			saveMessage({
				userId: opts.origin === "telegram" ? `telegram-${opts.telegramChatId || chatId}` : chatId,
				chatId,
				role: "user",
				content: userText,
				origin: opts.origin || "web",
			});
		} catch {
			// DB might not be available, continue without persistence
		}
	}

	if (session.messages.length === 0) {
		logger.agent(`[${chatId}] New session, loading brain context...`);
		const directives = await brain.getDirectives().catch(() => "");

		let systemPrompt: string;
		try {
			// Prioridad: modeId específico > modo activo > __general__ > built-in
			const { getActiveMode, getMode } = await import("../db/modes.js");
			let mode = null;
			if (opts.modeId) {
				mode = getMode(opts.modeId);
			}
			if (!mode) {
				mode = getActiveMode();
			}
			if (mode?.system_prompt) {
				systemPrompt = mode.system_prompt;
				logger.agent(`[${chatId}] Using system prompt from mode '${mode.name}'`);
			} else {
				const generalOverride = getGeneralConfig();
				if (generalOverride?.system_prompt) {
					systemPrompt = generalOverride.system_prompt;
				} else {
					systemPrompt = buildSystemPrompt(config, generalModel);
				}
			}
		} catch {
			systemPrompt = buildSystemPrompt(config, generalModel);
		}

		session.messages.push({
			role: "system",
			content: systemPrompt,
		});

		if (directives) {
			session.messages.push({
				role: "system",
				content: `## Directivas del proyecto\n${directives}`,
			});
		}

		// Inform about available tools and modes
		const toolNames = toolRegistry.getToolNames();
		if (toolNames.length > 0) {
			let toolsBlock = `<available_tools>\nPuedes usar estas herramientas cuando el usuario lo solicite:\n${toolNames.map((n: string) => `- ${n}`).join("\n")}\n</available_tools>`;

			try {
				const { listModes } = await import("../db/modes.js");
				const allModes = listModes();
				const activeModeName = (await import("../db/modes.js").then(m => m.getActiveMode())).name;
				if (allModes.length > 0) {
					const modesLines = allModes
						.filter(m => m.name !== "__general__")
						.map(m => {
							const isActive = m.name === activeModeName ? " [ACTIVO]" : "";
							return `  - ${m.name}${isActive}: ${m.tools.join(", ")}`;
						})
						.join("\n");
					toolsBlock += `\n\n<available_modes>\nModos disponibles en el sistema:\n${modesLines}\n\nSi el usuario te pide hacer algo que requiere herramientas que NO tienes en tu modo actual, indícale qué otro modo tiene esa capacidad. Si el usuario te pide explícitamente cambiar de modo, usa la herramienta switch_mode.\n</available_modes>`;
				}
			} catch {
				// modes DB not available, skip
			}

			session.messages.push({
				role: "system",
				content: `## Herramientas y modos\n${toolsBlock}\n\nResponde siempre en español.`,
			});
		}

		if (opts.origin === "scheduler") {
			session.messages.push({
				role: "system",
				content: "## Contexto\nEsta consulta proviene de una tarea programada automáticamente. No esperes respuesta del usuario; completa la tarea y reporta los resultados sin solicitar confirmación.",
			});
		}

		try {
			const recentMessages = getMessages(chatId, generalHistoryLimit);
			for (const stored of recentMessages) {
				if (stored.role === "system") continue;
				if (!opts.skipPersistUserMsg && stored.role === "user" && stored.content === userText) {
					continue;
				}
				session.messages.push({
					role: stored.role as OpenAI.Chat.Completions.ChatCompletionMessageParam["role"],
					content: stored.content,
				} as OpenAI.Chat.Completions.ChatCompletionMessageParam);
			}
		} catch {
			// cached context is optional
		}
	}

	// ── Build user content with attachment support ───────────────────────
	// Supports:
	//   - Text-only messages  → content: string
	//   - Messages with images → content: ChatCompletionContentPart[] (multi-modal)
	//   - Text documents       → inline text in the content parts
	//   - Audio transcripts    → inline text
	const hasImages = opts.attachments?.some((a) => a.type.startsWith("image/")) ?? false;

	// Enviar imágenes como multi-modal siempre que el backend proxy lo soporte.
	// El backend (puerto 3016) ahora convierte automáticamente image_url a Ollama images[].
	// Si el modelo de Ollama no soporta visión, Ollama ignorará las imágenes silenciosamente.
	const shouldUseMultiModal = hasImages;

	let userContent: string | OpenAI.Chat.Completions.ChatCompletionContentPart[] = userText;

	if (opts.attachments && opts.attachments.length > 0) {
		const textParts: string[] = [];
		const imageParts: OpenAI.Chat.Completions.ChatCompletionContentPartImage[] = [];

		for (const att of opts.attachments) {
			if (att.type.startsWith("image/") && att.data) {
				if (shouldUseMultiModal) {
					// Modelo con visión → enviar como image_url multi-modal
					imageParts.push({
						type: "image_url",
						image_url: { url: att.data, detail: "auto" },
					});
				} else {
					// Modelo sin visión → solo mencionar como texto
					textParts.push(`\n[Imagen adjunta: ${att.name}]`);
				}
			} else if (att.type.startsWith("text/") || att.type === "application/json") {
				// Documento de texto → decodificar base64 a texto
				try {
					const base64Content = att.data.split(",")[1] || att.data || "";
					const decoded = Buffer.from(base64Content, "base64").toString("utf-8");
					if (decoded.trim()) {
						textParts.push(`\n--- ${att.name} ---\n${decoded}\n---`);
					} else {
						textParts.push(`\n[${att.name}: archivo vacío]`);
					}
				} catch {
					textParts.push(`\n[No se pudo leer: ${att.name}]`);
				}
			} else if (att.type.startsWith("audio/")) {
				// Audio → metadata (la transcripción ya viene como text/plain aparte)
				textParts.push(`\n[Mensaje de audio: ${att.name}]`);
			} else {
				// Otros tipos (video, binarios, etc.) → metadata
				textParts.push(`\n[Archivo adjunto: ${att.name} (${att.type})]`);
			}
		}

		if (shouldUseMultiModal) {
			// ── Caso multi-modal: texto + imágenes (solo modelos con visión) ──
			const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

			// Texto del usuario + documentos de texto como primer content part
			let combinedText = userText || "¿Qué hay en esta imagen?";
			if (textParts.length > 0) {
				combinedText += `\n\n--- Documentos adjuntos ---${textParts.join("\n")}`;
			}
			parts.push({ type: "text", text: combinedText });

			// Agregar todas las imágenes
			parts.push(...imageParts);

			userContent = parts;
		} else if (textParts.length > 0) {
			// ── Solo texto (modelo sin visión o sin imágenes) ──
			userContent = `${userText || ""}\n\n--- Archivos adjuntos ---${textParts.join("\n")}`;
		}
	}
	// Prepend quoted message if present (reply feature)
	if (opts.quotedMessage) {
		const quote = opts.quotedMessage;
		const roleLabel = quote.role === "user" ? "Usuario" : "Asistente";
		const prefix =
			"> Respondiendo al siguiente mensaje de **" +
			roleLabel +
			"**:\n> " +
			quote.content.replace(/\n/g, "\n> ") +
			"\n\n---\n\n";

		if (typeof userContent === "string") {
			userContent = prefix + userContent;
		} else if (Array.isArray(userContent)) {
			// Prepend quoted message to the first text part
			if (userContent.length > 0 && userContent[0].type === "text") {
				(userContent[0] as OpenAI.Chat.Completions.ChatCompletionContentPartText).text =
					prefix + (userContent[0] as OpenAI.Chat.Completions.ChatCompletionContentPartText).text;
			} else {
				userContent.unshift({ type: "text", text: prefix });
			}
		}
	}

	session.messages.push({ role: "user", content: userContent });

	const modelConfig = getDefaultModelConfig(config);
	modelConfig.model = generalModel;
	const client = createClient(modelConfig);

	const openAiTools = toolRegistry.getSpecs().map((t: RegistryToolSpec) => ({
		type: "function" as const,
		function: {
			name: t.function.name,
			description: t.function.description,
			parameters: t.function.parameters as Record<string, unknown>,
		},
	}));

	let finalContent = "";
	const totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
	const maxIterations = 10;

	for (let iteration = 0; iteration < maxIterations; iteration++) {
		logger.agent(`[${chatId}] LLM call #${iteration + 1} (model: ${modelConfig.model})`);

		const totalChars = session.messages.reduce(
			(sum, m) => sum + (typeof m.content === "string" ? m.content.length : 200),
			0
		);
		if (totalChars > 80000) {
			const systemMsg = session.messages[0];
			const recentMsgs = session.messages.slice(-20);
			session.messages = [systemMsg, ...recentMsgs];
			logger.agent(`[${chatId}] Context compacted to ${session.messages.length} messages`);
		}

		try {
			const stream = await client.chat.completions.create({
				model: modelConfig.model,
				messages: session.messages,
				tools: openAiTools.length > 0 ? openAiTools : undefined,
				tool_choice: "auto",
				stream: true,
				max_tokens: 4096,
				temperature: generalTemperature,
			});

			let fullContent = "";
			const toolCallDeltas: Array<{
				index: number;
				id?: string;
				type?: string;
				function?: { name?: string; arguments?: string };
			}> = [];

			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta;
				if (!delta) continue;

				// Content streaming
				if (delta.content) {
					fullContent += delta.content;
					opts.onChunk?.(delta.content);
				}

				// Tool call accumulation from deltas
				if (delta.tool_calls) {
					for (const tc of delta.tool_calls) {
						const idx = tc.index ?? 0;
						if (!toolCallDeltas[idx]) {
							toolCallDeltas[idx] = { index: idx, id: tc.id, type: tc.type, function: {} };
						}
						if (tc.id) toolCallDeltas[idx].id = tc.id;
						if (tc.type) toolCallDeltas[idx].type = tc.type;
						if (tc.function?.name) {
							toolCallDeltas[idx].function = {
								...toolCallDeltas[idx].function,
								name: (toolCallDeltas[idx].function?.name || "") + tc.function.name,
							};
						}
						if (tc.function?.arguments) {
							toolCallDeltas[idx].function = {
								...toolCallDeltas[idx].function,
								arguments: (toolCallDeltas[idx].function?.arguments || "") + tc.function.arguments,
							};
						}
					}
				}

				// Usage (last chunk)
				if (chunk.usage) {
					totalUsage.promptTokens += chunk.usage.prompt_tokens || 0;
					totalUsage.completionTokens += chunk.usage.completion_tokens || 0;
					totalUsage.totalTokens += chunk.usage.total_tokens || 0;
				}
			}

			// After streaming: determine if tool calls or content
			const hasToolCalls = toolCallDeltas.some((tc) => tc.function?.name);

			if (hasToolCalls) {
				// Build assistant message with tool calls for context
				const toolCalls = toolCallDeltas.map((tc) => ({
					id: tc.id || `call_${Date.now()}_${tc.index}`,
					type: "function" as const,
					function: {
						name: tc.function?.name || "",
						arguments: tc.function?.arguments || "{}",
					},
				}));

				session.messages.push({
					role: "assistant",
					content: fullContent || null,
					tool_calls: toolCalls,
				} as unknown as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam);

				for (const tc of toolCalls) {
					const toolName = tc.function.name;
					let args: Record<string, unknown>;
					try {
						args = JSON.parse(tc.function.arguments);
					} catch {
						args = {};
					}

					onToolCall?.(toolName, args);
					onStatus?.(`🧰 Usando herramienta: ${toolName}`);
					logger.tool(`[${chatId}] Tool call: ${toolName}`, args);

					let result: string;
					try {
						result = await toolRegistry.execute(toolName, args, session.toolContext);
					} catch (err) {
						result = `Error: ${err instanceof Error ? err.message : String(err)}`;
					}

					onToolResult?.(toolName, result);

					// Index successful read_url results to Brain
					if (toolName === "read_url" && !result.startsWith("Error")) {
						const url = (args.url as string) || "";
						if (url) {
							brain
								.saveMemory("knowledge", `URL: ${url}`, result.substring(0, 5000), "url,web,read_url")
								.catch(() => {});
						}
					}

					session.messages.push({
						role: "tool",
						tool_call_id: tc.id,
						content: result,
					});
				}
				continue;
			}

			finalContent = fullContent;
			session.messages.push({ role: "assistant", content: finalContent });

			if (session.messages.length > 60) {
				const systemMsg = session.messages[0];
				session.messages = [systemMsg, ...session.messages.slice(-40)];
			}

			const latency = Date.now() - startTime;

			if (!opts.skipPersistUserMsg) {
				try {
					saveMessage({
						userId: opts.origin === "telegram" ? `telegram-${opts.telegramChatId || chatId}` : chatId,
						chatId,
						role: "assistant",
						content: finalContent,
						origin: opts.origin || "web",
					});
				} catch {
					// DB might not be available
				}
			}

			onTyping?.(false);
			logger.agent(`[${chatId}] Response complete (${latency}ms)`);

			// Estimate token usage if model didn't provide it (e.g. Ollama)
			if (!totalUsage.promptTokens && !totalUsage.completionTokens) {
				const charCount = session.messages.reduce((sum, m) => {
					if (typeof m.content === "string") return sum + m.content.length;
					return sum + 200;
				}, 0);
				totalUsage.promptTokens = Math.max(1, Math.ceil(charCount / 4));
				totalUsage.completionTokens = Math.max(1, Math.ceil((finalContent?.length || 0) / 4));
				totalUsage.totalTokens = totalUsage.promptTokens + totalUsage.completionTokens;
			}

			return {
				text: finalContent,
				model: modelConfig.model,
				usage: {
					promptTokens: totalUsage.promptTokens,
					completionTokens: totalUsage.completionTokens,
					totalTokens: totalUsage.totalTokens,
				},
				latencyMs: latency,
			};
		} catch (err: unknown) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger.error(`[${chatId}] LLM call failed: ${errorMsg}`);
			const latency = Date.now() - startTime;

			onTyping?.(false);
			return {
				text: `Lo siento, encontré un error al procesar tu solicitud:\n\n${errorMsg}`,
				model: modelConfig.model,
				latencyMs: latency,
			};
		}
	}

	const latency = Date.now() - startTime;
	finalContent =
		finalContent || "He llegado al límite de iteraciones. Considera dividir la tarea en partes más pequeñas.";
	session.messages.push({ role: "assistant", content: finalContent });
	onTyping?.(false);

	// Estimate token usage if model didn't provide it
	if (!totalUsage.promptTokens && !totalUsage.completionTokens) {
		const charCount = session.messages.reduce((sum, m) => {
			if (typeof m.content === "string") return sum + m.content.length;
			return sum + 200;
		}, 0);
		totalUsage.promptTokens = Math.max(1, Math.ceil(charCount / 4));
		totalUsage.completionTokens = Math.max(1, Math.ceil((finalContent?.length || 0) / 4));
		totalUsage.totalTokens = totalUsage.promptTokens + totalUsage.completionTokens;
	}

	return {
		text: finalContent,
		model: modelConfig.model,
		usage: {
			promptTokens: totalUsage.promptTokens,
			completionTokens: totalUsage.completionTokens,
			totalTokens: totalUsage.totalTokens,
		},
		latencyMs: latency,
	};
}

export function resetSession(chatId: string): void {
	sessions.delete(chatId);
	logger.agent(`[${chatId}] Session reset`);
}

export function getActiveSessions(): string[] {
	return Array.from(sessions.keys());
}

export function resetAllSessions(): void {
	sessions.clear();
	logger.agent(`[sessions] All sessions cleared`);
}

export function pushSessionMessages(chatId: string, messages: Array<{ role: string; content: string }>): void {
	const entry = sessions.get(chatId);
	if (!entry) return;
	const existingContents = new Set(
		entry.state.messages.map((m) => (typeof m.content === "string" ? m.content.substring(0, 200) : ""))
	);
	for (const m of messages) {
		if (m.role === "system") continue;
		const key = m.content.substring(0, 200);
		if (existingContents.has(key)) continue;
		entry.state.messages.push({
			role: m.role as "user" | "assistant",
			content: m.content,
		});
		existingContents.add(key);
	}
}
