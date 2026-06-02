import "dotenv/config";
import { runAgent } from "./agent/loop.js";
import { loadEnv } from "./env.js";
import { GatewayServer } from "./gateway/server.js";
import { BrainClient } from "./memory/brain-client.js";
import { registerAllTools } from "./tools/index.js";
import { toolRegistry } from "./tools/registry.js";
import { logger } from "./utils/logger.js";

async function bootstrap() {
	logger.info("╔══════════════════════════════════════════════╗");
	logger.info("║     Agent Engine - Autonomous Coding Agent   ║");
	logger.info("╚══════════════════════════════════════════════╝");

	// 1. Load config
	const env = loadEnv();
	logger.info(`[Config] Port: ${env.enginePort}`);
	logger.info(`[Config] Backend: ${env.backendUrl}`);
	logger.info(`[Config] Brain: ${env.brainUrl}`);
	logger.info(`[Config] Model: ${env.defaultModel}`);
	logger.info(`[Config] Workspace: ${env.workspaceDir}`);

	// 2. Connect to mcp-brain
	const brain = new BrainClient(env);
	try {
		const stats = await brain.getStats();
		logger.info(`[Brain] Connected. Stats: ${JSON.stringify(stats)}`);
	} catch (err) {
		logger.warn(`[Brain] Initial connection failed: ${err}`);
		logger.warn("[Brain] Will retry on each memory operation");
	}

	// 3. Register all tools
	registerAllTools(brain);
	logger.info(`[Tools] ${toolRegistry.getToolNames().length} tools registered:`);
	for (const name of toolRegistry.getToolNames()) {
		logger.info(`  - ${name} (${toolRegistry.isEnabled(name) ? "enabled" : "disabled"})`);
	}

	// 4. Start gateway server (Express + WebSocket)
	const gateway = new GatewayServer(env);

	// 5. Wire up callbacks
	gateway.onUserMessage = async (chatId: string, text: string) => {
		logger.agent(`[${chatId}] Received: "${text.substring(0, 100)}..."`);

		try {
			const result = await runAgent({
				chatId,
				userText: text,
				env,
				brain,
				onChunk: (chunk: string) => gateway.sendChunk(chatId, chunk),
				onToolCall: (toolName: string, args: Record<string, unknown>) =>
					gateway.sendToolCall(chatId, toolName, args),
				onToolResult: (toolName: string, result: string) => gateway.sendToolResult(chatId, toolName, result),
			});

			gateway.sendDone(chatId, result.text, result.model, result.usage, result.latencyMs);

			// Auto-save important sessions to brain
			if (result.text.length > 50) {
				const title = `Agent chat: ${text.substring(0, 60)}...`;
				await brain.saveMemory(
					"decision",
					title,
					`**User**: ${text}\n\n**Agent**: ${result.text.substring(0, 2000)}`
				);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error(`[${chatId}] Agent error: ${msg}`);
			gateway.sendError(chatId, `Error: ${msg}`);
		}
	};

	gateway.onCancel = (chatId: string) => {
		logger.agent(`[${chatId}] Cancel requested`);
		gateway.sendDone(chatId, "⏹️ Conversación cancelada.", "system", undefined, 0);
	};

	gateway.onGetStatus = (ws) => {
		const msg = JSON.stringify({
			type: "status",
			payload: {
				status: "running",
				model: env.defaultModel,
				tools: toolRegistry.getToolNames(),
				sessions: Array.from(sessionsKeys()),
			},
		});
		ws.send(msg);
	};

	gateway.onListTools = (ws) => {
		const specs = toolRegistry.getSpecs();
		const msg = JSON.stringify({
			type: "tools_list",
			payload: { tools: specs },
		});
		ws.send(msg);
	};

	gateway.onToggleTool = (name: string, enabled: boolean) => {
		const ok = toolRegistry.setEnabled(name, enabled);
		logger.info(`[Tools] Toggle "${name}": ${enabled} (${ok ? "ok" : "not found"})`);
	};

	// 6. Start
	gateway.start();

	// Handle shutdown
	process.on("SIGINT", () => {
		logger.info("Shutting down...");
		gateway.stop();
		process.exit(0);
	});

	process.on("SIGTERM", () => {
		logger.info("Shutting down...");
		gateway.stop();
		process.exit(0);
	});
}

// Helper to iterate session keys (for status)
function sessionsKeys(): string[] {
	// In a real implementation, we'd expose this from the loop module
	return [];
}

bootstrap().catch((err) => {
	logger.error(`[Fatal] ${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
});
