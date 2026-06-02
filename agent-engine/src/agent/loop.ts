import type OpenAI from "openai";
import type { EnvConfig } from "../env.js";
import type { BrainClient } from "../memory/brain-client.js";
import type { ToolSpec as RegistryToolSpec } from "../tools/registry.js";
import { type ToolContext, toolRegistry } from "../tools/registry.js";
import { logger } from "../utils/logger.js";
import { createClient, getDefaultModelConfig, type ModelConfig } from "./models.js";
import { buildSystemPrompt } from "./prompt.js";

// ─── Types ────────────────────────────────────────────────────────────

export interface AgentOptions {
	chatId: string;
	userText: string;
	attachments?: Array<{ name: string; type: string; data: string }>;
	env: EnvConfig;
	brain: BrainClient;
	onChunk?: (text: string) => void;
	onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
	onToolResult?: (toolName: string, result: string) => void;
}

export interface AgentResult {
	text: string;
	model: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	latencyMs: number;
}

// ─── Session state ────────────────────────────────────────────────────

interface SessionState {
	messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>;
	toolContext: ToolContext;
}

const sessions = new Map<string, SessionState>();

function getSession(chatId: string, env: EnvConfig): SessionState {
	if (!sessions.has(chatId)) {
		sessions.set(chatId, {
			messages: [],
			toolContext: {
				sessionId: chatId,
				workspaceDir: env.workspaceDir,
				chatId,
			},
		});
	}
	return sessions.get(chatId)!;
}

// ─── Main Agent Loop ──────────────────────────────────────────────────

export async function runAgent(opts: AgentOptions): Promise<AgentResult> {
	const { chatId, userText, env, brain, onChunk, onToolCall, onToolResult } = opts;
	const startTime = Date.now();

	// 1. Get or create session state
	const session = getSession(chatId, env);

	// 2. Load context from mcp-brain on first message
	if (session.messages.length === 0) {
		logger.agent(`[${chatId}] New session, loading brain context...`);
		const [directives, context] = await Promise.all([
			brain.getDirectives().catch(() => ""),
			brain.getContext(10).catch(() => ""),
		]);

		const modelConfig = getDefaultModelConfig(env);
		const tools = toolRegistry.getSpecs();
		const systemPrompt = buildSystemPrompt(env, tools, directives, context, modelConfig.model);

		session.messages.push({
			role: "system",
			content: systemPrompt,
		});
	}

	// 3. Add user message
	const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: "text", text: userText }];

	// Handle image attachments
	if (opts.attachments && opts.attachments.length > 0) {
		for (const att of opts.attachments) {
			if (att.type.startsWith("image/")) {
				userContent.push({
					type: "image_url",
					image_url: { url: att.data, detail: "auto" },
				});
			} else if (att.type.startsWith("text/") || att.type === "application/json") {
				try {
					const base64Content = att.data.split(",")[1] || "";
					const decoded = Buffer.from(base64Content, "base64").toString("utf-8");
					userContent.push({
						type: "text",
						text: `\n\n--- Attached file: ${att.name} ---\n${decoded}\n--- End file ---`,
					});
				} catch {
					userContent.push({
						type: "text",
						text: `\n\n[Could not read attachment: ${att.name}]`,
					});
				}
			}
		}
	}

	session.messages.push({ role: "user", content: userContent });

	// 4. Get model config and client
	const modelConfig = getDefaultModelConfig(env);
	const client = createClient(modelConfig);

	// 5. Convert our tool specs to OpenAI format
	const openAiTools = toolRegistry.getSpecs().map((t: RegistryToolSpec) => ({
		type: "function" as const,
		function: {
			name: t.function.name,
			description: t.function.description,
			parameters: t.function.parameters as Record<string, unknown>,
		},
	}));

	// 6. Agent loop: LLM calls + tool execution
	let finalContent = "";
	const totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
	const maxIterations = 10;

	for (let iteration = 0; iteration < maxIterations; iteration++) {
		logger.agent(`[${chatId}] LLM call #${iteration + 1} (model: ${modelConfig.model})`);

		// Compact context if too long
		const totalChars = session.messages.reduce(
			(sum, m) => sum + (typeof m.content === "string" ? m.content.length : 200),
			0
		);
		if (totalChars > 80000) {
			// Remove early messages but keep system prompt
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
				temperature: 0.3,
			});

			const choice = response.choices[0];
			const message = choice.message;

			// Track usage
			if (response.usage) {
				totalUsage.promptTokens += response.usage.prompt_tokens || 0;
				totalUsage.completionTokens += response.usage.completion_tokens || 0;
				totalUsage.totalTokens += response.usage.total_tokens || 0;
			}

			// Check for tool calls
			if (message.tool_calls && message.tool_calls.length > 0) {
				// Add assistant message with tool calls
				session.messages.push({
					role: "assistant",
					content: message.content || null,
					tool_calls: message.tool_calls.map((tc) => ({
						id: tc.id,
						type: "function",
						function: tc.function,
					})),
				} as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam);

				// Process each tool call
				for (const tc of message.tool_calls) {
					const toolName = tc.function.name;
					let args: Record<string, unknown>;
					try {
						args = JSON.parse(tc.function.arguments);
					} catch {
						args = {};
					}

					onToolCall?.(toolName, args);
					logger.tool(`[${chatId}] Tool call: ${toolName}`, args);

					let result: string;
					try {
						result = await toolRegistry.execute(toolName, args, session.toolContext);
					} catch (err) {
						result = `Error: ${err instanceof Error ? err.message : String(err)}`;
					}

					onToolResult?.(toolName, result);

					// Add tool result message
					session.messages.push({
						role: "tool",
						tool_call_id: tc.id,
						content: result,
					});
				}

				// Continue loop for next LLM call
				continue;
			}

			// No tool calls - this is the final response
			finalContent = message.content || "";
			session.messages.push({ role: "assistant", content: finalContent });

			// Limit history length
			if (session.messages.length > 60) {
				const systemMsg = session.messages[0];
				session.messages = [systemMsg, ...session.messages.slice(-40)];
			}

			const latency = Date.now() - startTime;
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

			return {
				text: `Lo siento, encontré un error al procesar tu solicitud:\n\n${errorMsg}`,
				model: modelConfig.model,
				latencyMs: latency,
			};
		}
	}

	// Max iterations reached
	const latency = Date.now() - startTime;
	finalContent =
		finalContent ||
		"He llegado al límite de iteraciones. La tarea puede ser demasiado compleja o requiere muchos pasos. Considera dividirla en partes más pequeñas.";
	session.messages.push({ role: "assistant", content: finalContent });

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

/**
 * Reset a session (clear history)
 */
export function resetSession(chatId: string): void {
	sessions.delete(chatId);
	logger.agent(`[${chatId}] Session reset`);
}
