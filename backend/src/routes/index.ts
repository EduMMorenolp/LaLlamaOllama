import type { Router, RequestHandler } from "express";
import type { AuthService } from "../auth/auth.service.js";
import type { OllamaService } from "../ollama/ollama.service.js";
import type { AgentsService } from "../services/agents.service.js";
import { DockerContainerRepository } from "../repositories/docker-container.repository.js";
import { MCP_TOOL_CATALOG } from "../ollama/ollama.tools.js";
// Status
import { GetFastStatusUseCase } from "../use-cases/status/get-fast-status.js";
import { GetFullStatusUseCase } from "../use-cases/status/get-full-status.js";
import { createStatusRouter } from "./status.routes.js";
// Auth
import { GetAuthSettingsUseCase } from "../use-cases/auth/get-settings.js";
import { ToggleOllamaAuthUseCase } from "../use-cases/auth/toggle-ollama-auth.js";
import { ToggleMcpAuthUseCase } from "../use-cases/auth/toggle-mcp-auth.js";
import { ListMcpToolsUseCase } from "../use-cases/auth/list-mcp-tools.js";
import { ToggleMcpToolUseCase } from "../use-cases/auth/toggle-mcp-tool.js";
import { createAuthRouter } from "./auth.routes.js";
// Security
import { BanIpUseCase } from "../use-cases/security/ban-ip.js";
import { UnbanIpUseCase } from "../use-cases/security/unban-ip.js";
import { createSecurityRouter } from "./security.routes.js";
// Hardware
import { GetHardwareInfoUseCase } from "../use-cases/hardware/get-hardware-info.js";
import { SetAutoUnloadUseCase } from "../use-cases/hardware/set-auto-unload.js";
import { SetNumCtxUseCase } from "../use-cases/hardware/set-num-ctx.js";
import { createHardwareRouter } from "./hardware.routes.js";
// Engine Stats
import { GetEngineStatsUseCase } from "../use-cases/engine-stats/get-engine-stats.js";
import { UpdateElectricityRateUseCase } from "../use-cases/engine-stats/update-electricity-rate.js";
import { UpdateCloudPriceUseCase } from "../use-cases/engine-stats/update-cloud-price.js";
import { createEngineStatsRouter } from "./engine-stats.routes.js";
// Docker
import { StartContainerUseCase } from "../use-cases/docker/start-container.js";
import { StopContainerUseCase } from "../use-cases/docker/stop-container.js";
import { RestartContainerUseCase } from "../use-cases/docker/restart-container.js";
import { createDockerRouter } from "./docker.routes.js";
// Ngrok
import { GetNgrokStatusUseCase } from "../use-cases/ngrok/get-status.js";
import { GetNgrokConfigUseCase } from "../use-cases/ngrok/get-config.js";
import { SetNgrokAuthtokenUseCase } from "../use-cases/ngrok/set-authtoken.js";
import { StartNgrokUseCase } from "../use-cases/ngrok/start-ngrok.js";
import { StopNgrokUseCase } from "../use-cases/ngrok/stop-ngrok.js";
import { createNgrokRouter } from "./ngrok.routes.js";
// Models
import { ListModelsUseCase } from "../use-cases/models/list-models.js";
import { ListModelsOpenAiUseCase } from "../use-cases/models/list-models-openai.js";
import { PullModelUseCase } from "../use-cases/models/pull-model.js";
import { UnloadModelsUseCase } from "../use-cases/models/unload-models.js";
import { CleanWorkspaceUseCase } from "../use-cases/models/clean-workspace.js";
import { DeleteModelUseCase } from "../use-cases/models/delete-model.js";
import { createModelsRouter } from "./models.routes.js";
// Chat
import { CreateChatUseCase } from "../use-cases/chat/create-chat.js";
import { CreateChatStreamUseCase } from "../use-cases/chat/create-chat-stream.js";
import { createChatRouter } from "./chat.routes.js";
// Agents
import { AnalyzeProjectUseCase } from "../use-cases/agents/analyze-project.js";
import { createAgentsRouter } from "./agents.routes.js";
// Search
import { SearchModelsUseCase } from "../use-cases/search/search-models.js";
import { createSearchRouter } from "./search.routes.js";

export interface RouteConfig {
  authMiddleware: RequestHandler;
  appPort: string;
  ngrokContainer: string;
  ngrokAuthtokenConfigured: boolean;
  ollamaContainer: string;
  brainContainer: string;
}

export function createAllRoutes(
  authService: AuthService,
  ollamaService: OllamaService,
  agentsService: AgentsService,
  config: RouteConfig
): Router[] {
  const dockerRepo = new DockerContainerRepository();

  // --- Status ---
  const getFastStatus = new GetFastStatusUseCase(ollamaService, dockerRepo, config.brainContainer);
  const getFullStatus = new GetFullStatusUseCase(ollamaService, dockerRepo, config.brainContainer);
  const statusRouter = createStatusRouter(getFastStatus, getFullStatus, authService, config.authMiddleware);

  // --- Auth ---
  const getAuthSettings = new GetAuthSettingsUseCase(authService);
  const toggleOllamaAuth = new ToggleOllamaAuthUseCase(authService);
  const toggleMcpAuth = new ToggleMcpAuthUseCase(authService);
  const listMcpTools = new ListMcpToolsUseCase(authService, MCP_TOOL_CATALOG);
  const toggleMcpTool = new ToggleMcpToolUseCase(authService, MCP_TOOL_CATALOG);
  const authRouter = createAuthRouter(
    getAuthSettings, toggleOllamaAuth, toggleMcpAuth,
    listMcpTools, toggleMcpTool, config.authMiddleware
  );

  // --- Security ---
  const banIp = new BanIpUseCase(ollamaService);
  const unbanIp = new UnbanIpUseCase(ollamaService);
  const securityRouter = createSecurityRouter(banIp, unbanIp, config.authMiddleware);

  // --- Hardware ---
  const getHardwareInfo = new GetHardwareInfoUseCase(ollamaService);
  const setAutoUnload = new SetAutoUnloadUseCase(ollamaService);
  const setNumCtx = new SetNumCtxUseCase(ollamaService);
  const hardwareRouter = createHardwareRouter(getHardwareInfo, setAutoUnload, setNumCtx, config.authMiddleware);

  // --- Engine Stats ---
  const getEngineStats = new GetEngineStatsUseCase(ollamaService);
  const updateElectricityRate = new UpdateElectricityRateUseCase(ollamaService);
  const updateCloudPrice = new UpdateCloudPriceUseCase(ollamaService);
  const engineStatsRouter = createEngineStatsRouter(
    getEngineStats, updateElectricityRate, updateCloudPrice, config.authMiddleware
  );

  // --- Docker ---
  const startContainer = new StartContainerUseCase(dockerRepo);
  const stopContainer = new StopContainerUseCase(dockerRepo);
  const restartContainer = new RestartContainerUseCase(dockerRepo);
  const dockerRouter = createDockerRouter(
    startContainer, stopContainer, restartContainer,
    config.authMiddleware, config.ollamaContainer, config.brainContainer
  );

  // --- Ngrok ---
  const getNgrokStatus = new GetNgrokStatusUseCase(dockerRepo, config.ngrokContainer);
  const getNgrokConfig = new GetNgrokConfigUseCase(config.ngrokContainer, config.appPort, config.ngrokAuthtokenConfigured);
  const setNgrokAuthtoken = new SetNgrokAuthtokenUseCase(dockerRepo, config.ngrokContainer);
  const startNgrok = new StartNgrokUseCase(dockerRepo, config.ngrokContainer);
  const stopNgrok = new StopNgrokUseCase(dockerRepo, config.ngrokContainer);
  const ngrokRouter = createNgrokRouter(
    getNgrokStatus, getNgrokConfig, setNgrokAuthtoken, startNgrok, stopNgrok, config.authMiddleware
  );

  // --- Models ---
  const listModels = new ListModelsUseCase(ollamaService);
  const listModelsOpenAi = new ListModelsOpenAiUseCase(ollamaService);
  const pullModel = new PullModelUseCase(ollamaService);
  const unloadModels = new UnloadModelsUseCase(ollamaService);
  const cleanWorkspace = new CleanWorkspaceUseCase(ollamaService);
  const deleteModel = new DeleteModelUseCase(ollamaService);
  const modelsRouter = createModelsRouter(
    listModels, listModelsOpenAi, pullModel, unloadModels,
    cleanWorkspace, deleteModel, config.authMiddleware
  );

  // --- Chat ---
  const createChat = new CreateChatUseCase(ollamaService);
  const createChatStream = new CreateChatStreamUseCase(ollamaService);
  const chatRouter = createChatRouter(createChat, createChatStream, config.authMiddleware);

  // --- Agents ---
  const analyzeProject = new AnalyzeProjectUseCase(agentsService);
  const agentsRouter = createAgentsRouter(analyzeProject, config.authMiddleware);

  // --- Search ---
  const searchModels = new SearchModelsUseCase();
  const searchRouter = createSearchRouter(searchModels, config.authMiddleware);

  return [
    statusRouter,
    authRouter,
    securityRouter,
    hardwareRouter,
    engineStatsRouter,
    dockerRouter,
    ngrokRouter,
    modelsRouter,
    chatRouter,
    agentsRouter,
    searchRouter,
  ];
}
