import OpenAI from "openai";
import type { BrainClient } from "../brain/client.js";
import type { ToolSpec as RegistryToolSpec } from "../tools/types.js";
import { toolRegistry } from "../tools/registry.js";
import { logger } from "../../utils/logger.js";
import { createClient, getDefaultModelConfig } from "./createClient.js";
import { buildSystemPrompt } from "./buildPrompt.js";
import type { AgentOptions, AgentResult, SessionState } from "./types.js";
import { getMessages, saveMessage } from "../db/messages.js";
import { getGeneralConfig } from "../db/experts.js";

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
	onStatus?.("Procesando tu solicitud...");

	const session = getSession(opts);

	let generalModel = config.defaultModel;
	let generalTemperature = 0.7;
	let generalHistoryLimit = 10;
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
			const generalOverride = getGeneralConfig();
			if (generalOverride?.system_prompt) {
				systemPrompt = generalOverride.system_prompt;
			} else {
				systemPrompt = buildSystemPrompt(config, generalModel);
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

		// Inform about available tools
		const toolNames = toolRegistry.getToolNames();
		if (toolNames.length > 0) {
			session.messages.push({
				role: "system",
				content: `## Herramientas disponibles\nPuedes usar estas herramientas cuando el usuario lo solicite:\n${toolNames.map((n: string) => `- ${n}`).join("\n")}\n\nResponde siempre en español.`,
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

	let userContent = userText;

	if (opts.attachments && opts.attachments.length > 0) {
		const attachmentText: string[] = [];
		for (const att of opts.attachments) {
			if (att.type.startsWith("image/")) {
				attachmentText.push(`[Imagen adjunta: ${att.name}]`);
				continue;
			}

			if (att.type.startsWith("text/") || att.type === "application/json") {
				try {
					const base64Content = att.data.split(",")[1] || "";
					const decoded = Buffer.from(base64Content, "base64").toString("utf-8");
					attachmentText.push(`\n\n--- Attached file: ${att.name} ---\n${decoded}\n--- End file ---`);
				} catch {
					attachmentText.push(`\n\n[Could not read attachment: ${att.name}]`);
				}
			}
		}

		if (attachmentText.length > 0) {
			userContent += `\n\n=== ARCHIVOS ADJUNTOS ===${attachmentText.join("\n")}`;
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

	onStatus?.("Iniciando razonamiento...");

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
	finalContent = finalContent || "He llegado al límite de iteraciones. Considera dividir la tarea en partes más pequeñas.";
	session.messages.push({ role: "assistant", content: finalContent });
	onTyping?.(false);

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

export function pushSessionMessages(
	chatId: string,
	messages: Array<{ role: string; content: string }>
): void {
	const entry = sessions.get(chatId);
	if (!entry) return;
	const existingContents = new Set(
		entry.state.messages.map((m) =>
			typeof m.content === "string" ? m.content.substring(0, 200) : ""
		)
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
