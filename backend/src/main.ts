import "dotenv/config";

// --- Validación de Variables de Entorno ---
const validateEnv = () => {
  const cyan = "\x1b[36m";
  const yellow = "\x1b[33m";
  const red = "\x1b[31m";
  const reset = "\x1b[0m";

  const requiredVariables = ["API_KEY"];
  const missing = requiredVariables.filter((key) => !process.env[key] || process.env[key].trim() === "");

  if (missing.length > 0) {
    console.error(`\n${red}❌ [FATAL] Faltan variables de entorno requeridas en el Backend:${reset}`);
    missing.forEach((key) => {
      console.error(`   ${yellow}- ${key}${reset}`);
    });
    console.error(
      `\n${cyan}Por favor, define estas variables en tu archivo .env o en el docker-compose.yml${reset}\n`
    );
    process.exit(1);
  }
};
validateEnv();

import { createServer } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { Server as SocketServer } from "socket.io";
import { AppModule } from "./app.module.js";
import { AgentsService } from "./services/agents.service.js";
import logger from "./utils/logger.js";
import { createAuthMiddleware, createMcpAuthMiddleware } from "./middleware/auth.middleware.js";
import { createSecurityMiddleware } from "./middleware/security.middleware.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import { createAllRoutes } from "./routes/index.js";

const log = logger.child({ component: "main" });

const app = express();

// 1. Body parsing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 2. CORS
app.use(cors());

// 3. Seguridad
app.use(helmet());

// 4. AppModule (servicios)
const appModule = new AppModule();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    const isLocal = ip === "::1" || ip === "127.0.0.1" || ip.includes("127.0.0.1");
    const apiKey = req.headers["x-api-key"] || req.headers.authorization?.toString().replace("Bearer ", "");
    const isValidKey = appModule.authService.validate(apiKey as string);
    return isLocal || isValidKey;
  },
});
app.use(limiter);

const port = process.env.APP_PORT || 3000;
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: "*" },
});

const server = new Server(
  {
    name: "lallama-station-mcp",
    version: "1.0.0",
  },
  {
    capabilities: { tools: {} },
  }
);

await appModule.bootstrap(server, io);
await appModule.ollamaService.checkConnection();
const agentsService = new AgentsService(appModule.ollamaService);

// --- Auto-Pull de modelos al arranque ---
(async () => {
  const autoPullEnv = process.env.OLLAMA_AUTO_PULL?.trim();
  if (!autoPullEnv) return;

  const requested = autoPullEnv
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  if (requested.length === 0) return;

  const cyan = "\x1b[36m";
  const yellow = "\x1b[33m";
  const reset = "\x1b[0m";
  log.info({ models: requested }, "auto-pull: modelos configurados");

  await new Promise<void>((resolve) => setTimeout(resolve, 3000));

  const existing = await appModule.ollamaService.listModels();
  const existingNames = new Set(existing.map((m) => m.name));

  for (const model of requested) {
    if (existingNames.has(model)) {
      log.info({ model }, "auto-pull: ya disponible, omitiendo");
      continue;
    }
    log.info({ model }, "auto-pull: descargando");
    appModule.ollamaService.pullModel(model).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ model, message }, "auto-pull: error al descargar");
    });
  }
})();

// --- Middlewares ---
const authMiddleware = createAuthMiddleware(appModule.authService, appModule.ollamaService);
const securityMiddleware = createSecurityMiddleware(appModule.ollamaService);
const mcpAuthMiddleware = createMcpAuthMiddleware(appModule.authService);

app.use(securityMiddleware);

// --- Rutas (Use Case Architecture) ---
const NGROK_CONTAINER = process.env.NGROK_CONTAINER_NAME || "mcp-ngrok-tunnel";
const BRAIN_CONTAINER = process.env.BRAIN_CONTAINER_NAME || "brain";
const OLLAMA_CONTAINER = "mcp-ollama-motor";
const ngrokAuthtokenConfigured = Boolean(process.env.NGROK_AUTHTOKEN?.trim());

const routers = createAllRoutes(
  appModule.authService,
  appModule.ollamaService,
  agentsService,
  {
    authMiddleware,
    appPort: String(port),
    ngrokContainer: NGROK_CONTAINER,
    ngrokAuthtokenConfigured,
    ollamaContainer: OLLAMA_CONTAINER,
    brainContainer: BRAIN_CONTAINER,
  }
);

for (const router of routers) {
  app.use(router);
}

// --- Endpoints MCP (SSE) ---
let transport: SSEServerTransport | null = null;

app.get("/sse", async (req, res) => {
  const apiKey = req.headers["x-api-key"] || req.headers.authorization?.toString().replace("Bearer ", "");
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";

  if (appModule.authService.isMcpAuthEnabled() && !appModule.authService.validate(apiKey as string)) {
    log.warn({ ip }, "SSE-AUTH-FAIL: Unauthorized MCP connection attempt");
    appModule.ollamaService.logRequest(ip, "GET /sse", "Unauthorized");
    appModule.ollamaService.reportFailedAuth(ip);
    return res.status(401).json({
      error: { message: "Unauthorized: Invalid API Key", type: "authentication_error" },
    });
  }

  log.info({ ip }, "SSE: New authenticated connection");
  const _sessionId = appModule.sessionManager.createSession(ip, apiKey as string);

  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const apiKey = req.headers["x-api-key"] || req.headers.authorization?.toString().replace("Bearer ", "");

  if (appModule.authService.isMcpAuthEnabled() && !appModule.authService.validate(apiKey as string)) {
    return res.status(401).json({
      error: { message: "Unauthorized: Invalid API Key", type: "authentication_error" },
    });
  }

  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No transport active");
  }
});

// --- Error Handler ---
app.use(createErrorHandler());

// --- Startup ---
httpServer.listen(port, () => {
  log.info(
    { sse: `http://localhost:${port}/sse`, api: `http://localhost:${port}/v1` },
    "🚀 Servidor Híbrido Blindado Iniciado"
  );
});

export { io };
