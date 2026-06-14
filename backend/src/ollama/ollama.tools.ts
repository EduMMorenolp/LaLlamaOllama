import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { AuthService } from "../auth/auth.service.js";
import type { OllamaService } from "./ollama.service.js";
import logger from "../utils/logger.js";

const log = logger.child({ component: "mcp-tools" });

const InferenceOptionsSchema = z.object({
	temperature: z.number().min(0).max(2).optional(),
	num_ctx: z.number().min(128).max(131072).optional(),
	top_p: z.number().min(0).max(1).optional(),
	top_k: z.number().min(0).max(100).optional(),
});

export const MCP_TOOL_CATALOG = [
	{ name: "list_models", description: "List installed Ollama models" },
	{ name: "pull_model", description: "Download a new model from Ollama library" },
	{ name: "generate", description: "Generate a response for a prompt" },
	{ name: "chat", description: "Send a chat message to a model" },
	{ name: "unload_models", description: "Unload all models from VRAM (Free GPU)" },
	{ name: "get_server_status", description: "Get Ollama server telemetry (VRAM, Disk, Ngrok)" },
	{ name: "delete_model", description: "Delete a model from disk to free space" },
] as const;

export const MCP_TOOL_NAMES = new Set(MCP_TOOL_CATALOG.map((tool) => tool.name));

interface ChatMessage {
	role: string;
	content: string;
	[key: string]: unknown;
}

export class OllamaTools {
	constructor(
		private readonly ollamaService: OllamaService,
		private readonly authService: AuthService
	) {}

	/**
	 * Register Ollama MCP tools directly on a server.
	 * This will OVERWRITE any previously registered handlers for
	 * ListToolsRequestSchema and CallToolRequestSchema.
	 * Prefer using getToolHandlers() for composing with other tool sets.
	 */
	register(server: Server) {
		const { listToolsHandler, callToolHandler } = this.getToolHandlers();
		server.setRequestHandler(ListToolsRequestSchema, listToolsHandler);
		server.setRequestHandler(CallToolRequestSchema, callToolHandler);
	}

	/**
	 * Returns separate handlers for list and call that can be composed
	 * with other tool sets (e.g., memory tools) in a single registration.
	 */
	getToolHandlers() {
		const authService = this.authService;
		const ollamaService = this.ollamaService;

		const listToolsHandler = async () => {
			const requireApiKey = authService.isMcpAuthEnabled();
			const authProps = {
				apiKey: {
					type: "string",
					description: "API Key for authentication",
				},
			};
			const availableTools = [
				{
					name: "list_models",
					description: "List installed Ollama models",
					inputSchema: {
						type: "object",
						properties: {
							...authProps,
						},
						required: requireApiKey ? ["apiKey"] : [],
					},
				},
				{
					name: "pull_model",
					description: "Download a new model from Ollama library",
					inputSchema: {
						type: "object",
						properties: {
							model: {
								type: "string",
								description: "Name of the model to pull (e.g., llama3)",
							},
							...authProps,
						},
						required: requireApiKey ? ["model", "apiKey"] : ["model"],
					},
				},
				{
					name: "generate",
					description: "Generate a response for a prompt",
					inputSchema: {
						type: "object",
						properties: {
							model: { type: "string" },
							prompt: { type: "string" },
							...authProps,
							temperature: { type: "number", minimum: 0, maximum: 2 },
							num_ctx: { type: "number", minimum: 128 },
							keep_alive: { type: "string" },
						},
						required: requireApiKey ? ["model", "prompt", "apiKey"] : ["model", "prompt"],
					},
				},
				{
					name: "chat",
					description: "Send a chat message to a model. Optionally pass tools for function calling support.",
					inputSchema: {
						type: "object",
						properties: {
							model: { type: "string" },
							messages: {
								type: "array",
								items: {
									type: "object",
									properties: {
										role: { type: "string" },
										content: { type: "string" },
									},
								},
							},
							tools: {
								type: "array",
								description: "Optional list of tool definitions for function calling",
								items: { type: "object" },
							},
							...authProps,
							temperature: { type: "number", minimum: 0, maximum: 2 },
							num_ctx: { type: "number", minimum: 128 },
							session_id: { type: "string" },
							keep_alive: { type: "string" },
						},
						required: requireApiKey ? ["model", "messages", "apiKey"] : ["model", "messages"],
					},
				},
				{
					name: "unload_models",
					description: "Unload all models from VRAM (Free GPU)",
					inputSchema: {
						type: "object",
						properties: {
							...authProps,
						},
						required: requireApiKey ? ["apiKey"] : [],
					},
				},
				{
					name: "get_server_status",
					description: "Get Ollama server telemetry (VRAM, Disk, Ngrok)",
					inputSchema: {
						type: "object",
						properties: {
							...authProps,
						},
						required: requireApiKey ? ["apiKey"] : [],
					},
				},
				{
					name: "delete_model",
					description: "Delete a model from disk to free space",
					inputSchema: {
						type: "object",
						properties: {
							model: { type: "string" },
							...authProps,
						},
						required: requireApiKey ? ["model", "apiKey"] : ["model"],
					},
				},
			];

			return {
				tools: availableTools.filter((tool) => authService.isMcpToolEnabled(tool.name)),
			};
		};

		const callToolHandler = async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
			const params = request.params;
			const { name, arguments: args } = params;
			const ip = "MCP-Client";

			if (!(MCP_TOOL_NAMES as Set<string>).has(name)) {
				return {
					content: [{ type: "text", text: `Tool ${name} not found` }],
					isError: true,
				};
			}

			if (!authService.isMcpToolEnabled(name)) {
				return {
					content: [{ type: "text", text: `Tool ${name} is disabled by administrator` }],
					isError: true,
				};
			}

			// Global Auth Check (solo cuando MCP auth esta activa)
			if (authService.isMcpAuthEnabled() && !authService.validate(args?.apiKey as string)) {
				ollamaService.logRequest(ip, `Tool: ${name}`, "Unauthorized");
				ollamaService.reportFailedAuth(ip);
				return {
					content: [{ type: "text", text: "Invalid API Key" }],
					isError: true,
				};
			}

			ollamaService.logRequest(ip, `Tool: ${name}`, "Success");
			log.tool({ tool: name, args: args ? Object.keys(args) : [] }, `Tool call: ${name}`);

			try {
				switch (name) {
					case "list_models": {
						const models = await ollamaService.listModels();
						log.tool({ tool: name, count: models.length }, "Tool success");
						return {
							content: [{ type: "text", text: JSON.stringify(models, null, 2) }],
						};
					}

					case "pull_model":
						await ollamaService.pullModel(args?.model as string);
						log.tool({ tool: name, model: args?.model }, "Tool success");
						return {
							content: [
								{
									type: "text",
									text: `Model ${args?.model} pull initiated/completed successfully.`,
								},
							],
						};

					case "generate": {
						const options = InferenceOptionsSchema.parse({
							temperature: args?.temperature,
							num_ctx: args?.num_ctx,
						});
						const genResponse = await ollamaService.generate(
							args?.model as string,
							args?.prompt as string,
							options,
							args?.keep_alive as string | number
						);
						log.tool({ tool: name, model: args?.model }, "Tool success");
						return {
							content: [{ type: "text", text: genResponse }],
						};
					}

					case "chat": {
						const options = InferenceOptionsSchema.parse({
							temperature: args?.temperature,
							num_ctx: args?.num_ctx,
						});
						const chatResponse = await ollamaService.chat(
							args?.model as string,
							(args?.messages as ChatMessage[]) || [],
							options,
							args?.keep_alive as string | number,
							args?.session_id as string,
							args?.tools as Record<string, unknown>[]
						);
						log.tool({ tool: name, model: args?.model }, "Tool success");
						return {
							content: [{ type: "text", text: chatResponse?.message?.content || "" }],
						};
					}

					case "unload_models":
						await ollamaService.unloadModels();
						log.tool({ tool: name }, "Tool success");
						return {
							content: [{ type: "text", text: "All models unloaded from VRAM successfully." }],
						};

					case "get_server_status": {
						const status = await ollamaService.getServerStatus();
						log.tool({ tool: name }, "Tool success");
						return {
							content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
						};
					}

					case "delete_model":
						await ollamaService.deleteModel(args?.model as string);
						log.tool({ tool: name, model: args?.model }, "Tool success");
						return {
							content: [{ type: "text", text: `Model ${args?.model} deleted successfully.` }],
						};

					default:
						return {
							content: [{ type: "text", text: `Tool ${name} not found` }],
							isError: true,
						};
				}
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : "Unknown error";
				log.tool({ tool: name, error: message }, "Tool failed");
				return {
					content: [{ type: "text", text: `Error: ${message}` }],
					isError: true,
				};
			}
		};

		return { listToolsHandler, callToolHandler };
	}
}
