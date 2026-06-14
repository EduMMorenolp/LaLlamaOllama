import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Server as SocketServer } from "socket.io";
import { AuthService } from "./auth/auth.service.js";
import { OllamaService } from "./ollama/ollama.service.js";
import { MCP_TOOL_CATALOG, MCP_TOOL_NAMES, OllamaTools } from "./ollama/ollama.tools.js";
import { SessionManager } from "./session/session.manager.js";
import logger from "./utils/logger.js";

export class AppModule {
  public readonly ollamaService: OllamaService;
  public readonly authService: AuthService;
  public readonly sessionManager: SessionManager;
  private readonly ollamaTools: OllamaTools;

  constructor() {
    this.authService = new AuthService();
    this.authService.setKnownMcpTools([...MCP_TOOL_CATALOG.map((tool) => tool.name)]);
    this.ollamaService = new OllamaService();
    this.sessionManager = new SessionManager();
    this.ollamaTools = new OllamaTools(this.ollamaService, this.authService);
  }

  async bootstrap(server: Server, io?: SocketServer) {
    if (io) this.ollamaService.setIo(io);

    const ollamaHandlers = this.ollamaTools.getToolHandlers();

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const ollamaResult = await ollamaHandlers.listToolsHandler();
      return {
        tools: [...(ollamaResult.tools || [])],
      };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const params = request.params as { name: string; arguments?: Record<string, unknown> };
      const { name } = params;

			if ((MCP_TOOL_NAMES as Set<string>).has(name)) {
				return ollamaHandlers.callToolHandler(request);
			}

			return {
				content: [{ type: "text", text: `Tool ${name} not found` }],
				isError: true,
			};
    });

		logger.child({ component: "app-module" }).info("AppModule bootstrapped with MCP tools (Ollama)");
  }
}
