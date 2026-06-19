import type OpenAI from "openai";
import { logger } from "../../utils/logger.js";
import type { BrainClient } from "../brain/client.js";
import { getGeneralConfig } from "../db/experts.js";
import { getMessages, saveMessage } from "../db/messages.js";
import { getUser, formatUserProfileForPrompt } from "../db/users.js";
import { getWorkspaceContext, formatWorkspaceForPrompt } from "../db/workspace.js";
import { toolRegistry } from "../tools/registry.js";
import type { ToolSpec as RegistryToolSpec } from "../tools/types.js";
import { buildSystemPrompt } from "./buildPrompt.js";
import { createClient, getDefaultModelConfig } from "./createClient.js";
import { summarizeMessages } from "./sessionSummary.js";
import { afterResponseLearning } from "./userLearning.js";
import type { AgentOptions, AgentResult, SessionState } from "./types.js";

const SESSION_TTL_MS = 120 * 60 * 1000; // 2 hours (was 30min)

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

/**
 * Resolve mode configuration: modeId > active mode > __general__ > defaults.
 * Returns { model, temperature, history_limit, system_prompt }.
 */
async function resolveModeConfig(opts: AgentOptions, chatId: string, _config: { defaultModel: string }): Promise<{
	model: string;
	temperature: number;
	historyLimit: number;
	systemPrompt: string | null;
}> {
	let model = _config.defaultModel;
	let temperature = 0.7;
	let historyLimit = 10;
	let systemPrompt: string | null = null;

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
			if (mode.model) model = mode.model;
			if (mode.temperature != null) temperature = mode.temperature;
			if (mode.history_limit != null) historyLimit = mode.history_limit;
			if (mode.system_prompt) {
				systemPrompt = mode.system_prompt;
				logger.agent(`[${chatId}] Using system prompt from mode '${mode.name}'`);
			}
		}
	} catch {
		// fallback a __general__
		try {
			const g = getGeneralConfig();
			if (g) {
				if (g.model) model = g.model;
				if (g.temperature != null) temperature = g.temperature;
				if (g.history_limit != null) historyLimit = g.history_limit;
				if (g.system_prompt) {
					systemPrompt = g.system_prompt;
				}
			}
		} catch {
			// use defaults
		}
	}

	if (opts.preferredModel && opts.preferredModel !== "default") {
		model = opts.preferredModel;
	}

	return { model, temperature, historyLimit, systemPrompt };
}

export async function runAgentCore(opts: AgentOptions): Promise<AgentResult> {
	const { chatId, userText, config, brain, onToolCall, onToolResult, onStatus, onTyping } = opts;
	const startTime = Date.now();

	onTyping?.(true);

	const session = getSession(opts);

	const userId = opts.origin === "telegram"
		? `telegram-${opts.telegramChatId || chatId}`
		: chatId;

	const modeConfig = await resolveModeConfig(opts, chatId, config);
	const { model: generalModel, temperature: generalTemperature, historyLimit: generalHistoryLimit, systemPrompt: modeSystemPrompt } = modeConfig;

	if (!opts.skipPersistUserMsg) {
		try {
			saveMessage({
				userId,
				chatId,
				role: "user",
				content: userText,
				origin: opts.origin || "web",
			});
		} catch {
			// DB might not be available, continue without persistence
		}
		// Also persist to mcp-brain conversation history
		brain.appendConversationMessage(chatId, "user", userText).catch(() => {});
	}

	if (session.messages.length === 0) {
		logger.agent(`[${chatId}] New session, loading brain context...`);
		const [directives, brainProfile] = await Promise.all([
			brain.getDirectives().catch(() => ""),
			brain.getUserProfile().catch(() => "")
		]);

		// Enrich with local DB profile
		let dbProfile = "";
		const dbUser = getUser(userId);
		if (dbUser) {
			dbProfile = formatUserProfileForPrompt(dbUser);
		}

		let systemPrompt: string;
		if (modeSystemPrompt) {
			systemPrompt = modeSystemPrompt;
		} else {
			const generalOverride = getGeneralConfig();
			if (generalOverride?.system_prompt) {
				systemPrompt = generalOverride.system_prompt;
			} else {
				systemPrompt = buildSystemPrompt(config, generalModel);
			}
		}

		// Consolidar toda la informaci�n de sistema en UN solo mensaje system
		// para que el LLM tenga contexto completo sin fragmentaci�n
		const assembly: string[] = [systemPrompt];

		if (directives) {
			assembly.push(`<project_directives>\n${directives}\n</project_directives>`);
		}

		// Combine brain profile + local DB profile
		let fullProfile = "";
		if (brainProfile) fullProfile += `Lo que sabes sobre este usuario/proyecto:\n${brainProfile}\n`;
		if (dbProfile) fullProfile += `\nPerfil almacenado:\n${dbProfile}`;
		if (fullProfile) {
			assembly.push(`<user_profile>\n${fullProfile}\n</user_profile>`);
		}

		// Inform about available tools (only active/enabled ones)
		const enabledTools = toolRegistry.getSpecs();
		if (enabledTools.length > 0) {
			const toolList = enabledTools.map((t) => `- ${t.function.name}`).join("\n");
			assembly.push(`<available_tools>\nHerramientas disponibles:\n${toolList}\n</available_tools>`);
		}

		// Workspace context
		try {
			const wsCtx = getWorkspaceContext(userId);
			if (wsCtx) {
				const wsText = formatWorkspaceForPrompt(wsCtx);
				if (wsText) {
					assembly.push(`<workspace_context>\n${wsText}\n</workspace_context>`);
				}
			}
		} catch { /* optional */ }

		if (session.summary) {
			assembly.push(`<session_summary>\nResumen de la conversaci�n anterior:\n${session.summary}\n</session_summary>`);
		}

		if (opts.origin === "scheduler") {
			assembly.push(`<context>\nEsta consulta proviene de una tarea programada autom�ticamente. No esperes respuesta del usuario; completa la tarea y reporta los resultados sin solicitar confirmaci�n.\n</context>`);
		}

		session.messages.push({
			role: "system",
			content: assembly.join("\n\n"),
		});

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

		// Also load any conversation history from mcp-brain that might not be in local SQLite
		try {
			const localCount = session.messages.length;
			brain.getConversationHistory(chatId, generalHistoryLimit).then((brainMessages) => {
				if (brainMessages.length > localCount) {
					const existingKeys = new Set(session.messages.map((m) => typeof m.content === "string" ? m.content.substring(0, 100) : ""));
					for (const bm of brainMessages) {
						const key = (bm.content || "").substring(0, 100);
						if (!key || existingKeys.has(key)) continue;
						if (bm.role === "system") continue;
						existingKeys.add(key);
						session.messages.push({
							role: bm.role as OpenAI.Chat.Completions.ChatCompletionMessageParam["role"],
							content: bm.content,
						} as OpenAI.Chat.Completions.ChatCompletionMessageParam);
					}
					logger.agent(`[${chatId}] Loaded ${brainMessages.length} messages from brain history`);
				}
			}).catch(() => {});
		} catch {
			// brain history is optional
		}
	}

	// -- Build user content with attachment support -----------------------
	// Supports:
	//   - Text-only messages  ? content: string
	//   - Messages with images ? content: ChatCompletionContentPart[] (multi-modal)
	//   - Text documents       ? inline text in the content parts
	//   - Audio transcripts    ? inline text
	const hasImages = opts.attachments?.some((a) => a.type.startsWith("image/")) ?? false;

	// Enviar im�genes como multi-modal siempre que el backend proxy lo soporte.
	// El backend (puerto 3016) ahora convierte autom�ticamente image_url a Ollama images[].
	// Si el modelo de Ollama no soporta visi�n, Ollama ignorar� las im�genes silenciosamente.
	const shouldUseMultiModal = hasImages;

	let userContent: string | OpenAI.Chat.Completions.ChatCompletionContentPart[] = userText;

	if (opts.attachments && opts.attachments.length > 0) {
		const textParts: string[] = [];
		const imageParts: OpenAI.Chat.Completions.ChatCompletionContentPartImage[] = [];

		for (const att of opts.attachments) {
			if (att.type.startsWith("image/") && att.data) {
				if (shouldUseMultiModal) {
					// Modelo con visi�n ? enviar como image_url multi-modal
					imageParts.push({
						type: "image_url",
						image_url: { url: att.data, detail: "auto" },
					});
				} else {
					// Modelo sin visi�n ? solo mencionar como texto
					textParts.push(`\n[Imagen adjunta: ${att.name}]`);
				}
			} else if (att.type.startsWith("text/") || att.type === "application/json") {
				// Documento de texto ? decodificar base64 a texto
				try {
					const base64Content = att.data.split(",")[1] || att.data || "";
					const decoded = Buffer.from(base64Content, "base64").toString("utf-8");
					if (decoded.trim()) {
						textParts.push(`\n--- ${att.name} ---\n${decoded}\n---`);
					} else {
						textParts.push(`\n[${att.name}: archivo vac�o]`);
					}
				} catch {
					textParts.push(`\n[No se pudo leer: ${att.name}]`);
				}
			} else if (att.type.startsWith("audio/")) {
				// Audio ? metadata (la transcripci�n ya viene como text/plain aparte)
				textParts.push(`\n[Mensaje de audio: ${att.name}]`);
			} else {
				// Otros tipos (video, binarios, etc.) ? metadata
				textParts.push(`\n[Archivo adjunto: ${att.name} (${att.type})]`);
			}
		}

		if (shouldUseMultiModal) {
			// -- Caso multi-modal: texto + im�genes (solo modelos con visi�n) --
			const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

			// Texto del usuario + documentos de texto como primer content part
			let combinedText = userText || "�Qu� hay en esta imagen?";
			if (textParts.length > 0) {
				combinedText += `\n\n--- Documentos adjuntos ---${textParts.join("\n")}`;
			}
			parts.push({ type: "text", text: combinedText });

			// Agregar todas las im�genes
			parts.push(...imageParts);

			userContent = parts;
		} else if (textParts.length > 0) {
			// -- Solo texto (modelo sin visi�n o sin im�genes) --
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

	// Determine if this is a subsequent turn (existing history beyond current user message)
	let isNewTurn = session.messages.length > 2;

	let finalContent = "";
	const totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
	const maxIterations = 10;

	for (let iteration = 0; iteration < maxIterations; iteration++) {
		logger.agent(`[${chatId}] LLM call #${iteration + 1} (model: ${modelConfig.model})`);

		const totalChars = session.messages.reduce(
			(sum, m) => sum + (typeof m.content === "string" ? m.content.length : 200),
			0
		);
		if (totalChars > 30000) {
			const systemMsg = session.messages[0];
			const msgsToSummarize = session.messages.slice(1, -11);
			const recentMsgs = session.messages.slice(-11);
			if (msgsToSummarize.length >= 4) {
				try {
					const newSummary = await summarizeMessages(client, modelConfig.model, msgsToSummarize as Array<{ role: string; content: string }>);
					session.summary = session.summary
						? `${session.summary}\n\n${newSummary}`
						: newSummary;
					logger.agent(`[${chatId}] Context summarized via LLM (${msgsToSummarize.length} msgs, ${newSummary.length} chars, reduced from ~${Math.ceil(msgsToSummarize.reduce((s,m) => s + (typeof m.content === "string" ? m.content.length : 200), 0) / 4)} est. tokens)`);
				} catch {
					session.messages = [systemMsg, ...recentMsgs];
					logger.agent(`[${chatId}] Summary LLM failed, truncated to ${session.messages.length} messages`);
				}
			}
			session.messages = [systemMsg, ...recentMsgs];
			logger.agent(`[${chatId}] Context compacted to ${session.messages.length} messages (${totalChars} chars, ~${Math.ceil(totalChars / 4)} est. tokens, summary: ${session.summary?.length || 0} chars)`);
		}

		const messagesForLLM = (isNewTurn && iteration === 0)
			? [session.messages[session.messages.length - 1]]
			: session.messages;

		try {
			const stream = await client.chat.completions.create({
				model: modelConfig.model,
				messages: messagesForLLM,
				user: (isNewTurn && iteration === 0) ? chatId : undefined,
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

			// After first iteration, restore full context for tool call handling
			if (isNewTurn && iteration === 0) {
				isNewTurn = false;
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
					onStatus?.(`?? Usando herramienta: ${toolName}`);
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
				const msgsToSummarize = session.messages.slice(1, -30);
				const recentMsgs = session.messages.slice(-30);
				if (msgsToSummarize.length >= 4) {
					summarizeMessages(client, modelConfig.model, msgsToSummarize as Array<{ role: string; content: string }>)
						.then((newSummary) => {
							session.summary = session.summary
								? `${session.summary}\n\n${newSummary}`
								: newSummary;
						})
						.catch(() => {});
				}
				session.messages = [systemMsg, ...recentMsgs];
			}

			const latency = Date.now() - startTime;

			try {
				saveMessage({
					userId,
					chatId,
					role: "assistant",
					content: finalContent,
					origin: opts.origin || "web",
				});
			} catch {
				// DB might not be available
			}
			// Persist assistant response to mcp-brain conversation history
			brain.appendConversationMessage(chatId, "assistant", finalContent, totalUsage.completionTokens).catch(() => {});

			onTyping?.(false);
			logger.agent(`[${chatId}] Response complete (${latency}ms)`);

			afterResponseLearning(userId, userText, finalContent, brain).catch(() => {});
			// Trigger summarization on brain if session has too many messages
			if (session.messages.length > 15) {
				brain.summarizeConversation(chatId).catch(() => {});
			}

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
				text: `Lo siento, encontr� un error al procesar tu solicitud:\n\n${errorMsg}`,
				model: modelConfig.model,
				latencyMs: latency,
			};
		}
	}

	const latency = Date.now() - startTime;
	finalContent =
		finalContent || "He llegado al l�mite de iteraciones. Considera dividir la tarea en partes m�s peque�as.";
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

	try {
		saveMessage({
			userId,
			chatId,
			role: "assistant",
			content: finalContent,
			origin: opts.origin || "web",
		});
	} catch {
		// DB might not be available
	}
	brain.appendConversationMessage(chatId, "assistant", finalContent, totalUsage.completionTokens).catch(() => {});

	afterResponseLearning(userId, userText, finalContent, brain).catch(() => {});
	if (session.messages.length > 15) {
		brain.summarizeConversation(chatId).catch(() => {});
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
