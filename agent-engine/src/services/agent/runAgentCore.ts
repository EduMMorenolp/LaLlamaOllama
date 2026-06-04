import OpenAI from "openai";
import type { BrainClient } from "../brain/client.js";
import type { ToolSpec as RegistryToolSpec } from "../tools/types.js";
import { toolRegistry } from "../tools/registry.js";
import { logger } from "../../utils/logger.js";
import { createClient, getDefaultModelConfig } from "./createClient.js";
import { buildSystemPrompt } from "./buildPrompt.js";
import type { AgentOptions, AgentResult, SessionState } from "./types.js";
import { getMessages } from "../db/messages.js";

const sessions = new Map<string, SessionState>();

function getSession(opts: AgentOptions): SessionState {
	const { chatId, config } = opts;
	if (!sessions.has(chatId)) {
		sessions.set(chatId, {
			messages: [],
			toolContext: {
				sessionId: chatId,
				workspaceDir: config.workspaceDir,
				chatId,
			},
		});
	}
	return sessions.get(chatId)!;
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
		const { getGeneralConfig } = await import("../db/experts.js");
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
			const { saveMessage } = await import("../db/messages.js");
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
			const { getGeneralConfig } = await import("../db/experts.js");
			const generalOverride = getGeneralConfig();
			if (generalOverride) {
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
			const response = await client.chat.completions.create({
				model: modelConfig.model,
				messages: session.messages,
				tools: openAiTools.length > 0 ? openAiTools : undefined,
				tool_choice: "auto",
				stream: false,
				max_tokens: 4096,
				temperature: generalTemperature,
			});

			const choice = response.choices[0];
			const message = choice.message;

			if (response.usage) {
				totalUsage.promptTokens += response.usage.prompt_tokens || 0;
				totalUsage.completionTokens += response.usage.completion_tokens || 0;
				totalUsage.totalTokens += response.usage.total_tokens || 0;
			}

			if (message.tool_calls && message.tool_calls.length > 0) {
				session.messages.push({
					role: "assistant",
					content: message.content || null,
					tool_calls: message.tool_calls.map((tc) => ({
						id: tc.id,
						type: "function",
						function: tc.function,
					})),
				} as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam);

				for (const tc of message.tool_calls) {
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

			finalContent = message.content || "";
			session.messages.push({ role: "assistant", content: finalContent });

			if (session.messages.length > 60) {
				const systemMsg = session.messages[0];
				session.messages = [systemMsg, ...session.messages.slice(-40)];
			}

			const latency = Date.now() - startTime;

			if (!opts.skipPersistUserMsg) {
				try {
					const { saveMessage } = await import("../db/messages.js");
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
