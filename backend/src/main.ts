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
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";
import Docker from "dockerode";
import express, { type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { Server as SocketServer } from "socket.io";
import { AppModule } from "./app.module.js";
import { MCP_TOOL_CATALOG } from "./ollama/ollama.tools.js";
import { AgentsService } from "./services/agents.service.js";

const app = express();
app.use(cors()); // Habilitar CORS para desarrollo local del frontend

// --- Middleware de Seguridad (Fase 1) ---
app.use(helmet());
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

app.use(express.json());
const port = process.env.APP_PORT || 3000;
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
	cors: {
		origin: "*", // En producción se debe restringir
	},
});

const server = new Server(
	{
		name: "lallama-station-mcp",
		version: "1.0.0",
	},
	{
		capabilities: {
			tools: {},
		},
	}
);

// Módulo de la aplicación (Estilo NestJS)
const appModule = new AppModule();
await appModule.bootstrap(server, io);
await appModule.ollamaService.checkConnection();
const agentsService = new AgentsService(appModule.ollamaService);

// --- Auto-Pull de modelos al arranque ---
// Configura en .env o docker-compose: OLLAMA_AUTO_PULL=llama3.2,qwen2.5-coder:7b
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
	console.log(`\n${cyan}[auto-pull]${reset} Modelos configurados: ${yellow}${requested.join(", ")}${reset}`);

	// Esperar 3 segundos para que Ollama esté listo antes de empezar
	await new Promise<void>((resolve) => setTimeout(resolve, 3000));

	const existing = await appModule.ollamaService.listModels();
	const existingNames = new Set(existing.map((m) => m.name));

	for (const model of requested) {
		if (existingNames.has(model)) {
			console.log(`${cyan}[auto-pull]${reset} ${model} — ya disponible, omitiendo.`);
			continue;
		}
		console.log(`${cyan}[auto-pull]${reset} Descargando ${yellow}${model}${reset}...`);
		appModule.ollamaService.pullModel(model).catch((err: unknown) => {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`${cyan}[auto-pull]${reset} Error al descargar ${model}: ${message}`);
		});
	}
})();

// --- Middleware de Seguridad Avanzada (Fase 2) ---
const securityMiddleware = (req: Request, res: Response, next: (err?: unknown) => void) => {
	const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";

	if (appModule.ollamaService.isBlacklisted(ip)) {
		return res.status(403).json({ error: "Forbidden: Your IP is blacklisted" });
	}
	next();
};

app.use(securityMiddleware);

const authMiddleware = (req: Request, res: Response, next: (err?: unknown) => void) => {
	if (!appModule.authService.isOllamaAuthEnabled()) {
		return next();
	}

	const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
	const apiKey = req.headers["x-api-key"] || req.headers.authorization?.toString().replace("Bearer ", "");

	const action = `${req.method} ${req.path}`;
	// Omitir logging de endpoints de polling interno para no saturar el panel de seguridad
	const isPolling =
		req.method === "GET" &&
		["/api/status", "/api/status/fast", "/api/engine-stats", "/api/hardware"].includes(req.path);

	if (appModule.authService.validate(apiKey as string)) {
		if (!isPolling) {
			appModule.ollamaService.logRequest(ip, action, "Success");
		}
		next();
	} else {
		appModule.ollamaService.logRequest(ip, action, "Unauthorized");
		appModule.ollamaService.reportFailedAuth(ip);
		res.status(401).json({ error: "Unauthorized: Invalid API Key" });
	}
};

const withAuthConfig = <T extends Record<string, unknown>>(payload: T) => ({
	...payload,
	auth: appModule.authService.getSettings(),
});

// --- Rutas de Compatibilidad OpenAI ---

// 1. Listar modelos (OpenAI Format)
app.get("/v1/models", authMiddleware, async (_req, res) => {
	try {
		const models = await appModule.ollamaService.listModels();
		res.json({
			object: "list",
			data: models.map((m) => ({
				id: m.name,
				object: "model",
				created: Math.floor(Date.now() / 1000),
				owned_by: "ollama",
			})),
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		res.status(500).json({ error: message });
	}
});

// 1b. Listar modelos con datos completos (para el Dashboard)
app.get("/api/models", authMiddleware, async (_req, res) => {
	try {
		const models = await appModule.ollamaService.listModels();
		res.json({ models });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		res.status(500).json({ error: message });
	}
});

// 1c. Analyze project and generate agents
app.post("/api/agents/analyze-project", authMiddleware, async (req, res) => {
	try {
		const { model, projectName, structure, configFiles } = req.body;
		if (!model || !projectName || !structure) {
			return res.status(400).json({ error: "model, projectName y structure son obligatorios" });
		}
		const result = await agentsService.analyzeProject(model, projectName, structure, configFiles || {});
		res.json(result);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		res.status(500).json({ error: message });
	}
});

// 2. Chat Completions (OpenAI Format) - with streaming support
app.post("/v1/chat/completions", authMiddleware, async (req, res) => {
	const { model, messages, stream = false, temperature, num_ctx, top_p, top_k } = req.body;

	if (!model || !Array.isArray(messages)) {
		return res.status(400).json({ error: "model y messages son obligatorios" });
	}

	try {
		if (stream === true) {
			// Streaming mode: send SSE chunks
			res.setHeader("Content-Type", "text/event-stream");
			res.setHeader("Cache-Control", "no-cache");
			res.setHeader("Connection", "keep-alive");

			try {
				const streamStartMs = Date.now();
				const streamResponse = await appModule.ollamaService.chatStream(model, messages, {
					temperature,
					num_ctx,
					top_p,
					top_k,
				});

				let _fullResponse = "";
				let promptTokens = 0;
				let completionTokens = 0;
				let firstTokenReceived = false;
				let ttftMs = 0;

				streamResponse.data.on("data", (chunk: Buffer) => {
					try {
						const lines = chunk.toString().split("\n");
						for (const line of lines) {
							if (!line || !line.trim()) continue;
							const data = JSON.parse(line);

							if (data.message?.content) {
								// Track TTFT (time to first token)
								if (!firstTokenReceived && data.message.content.length > 0) {
									ttftMs = Date.now() - streamStartMs;
									firstTokenReceived = true;
									console.log(`[stream-ttft] ${model}: ${ttftMs}ms`);
								}

								_fullResponse += data.message.content;
								completionTokens = data.eval_count || 0;
								promptTokens = data.prompt_eval_count || 0;
							}

							// Send as SSE chunk (OpenAI compatible format)
							const sseData = {
								id: `chatcmpl-${Date.now()}`,
								object: "chat.completion.chunk",
								created: Math.floor(Date.now() / 1000),
								model,
								choices: [
									{
										index: 0,
										delta: {
											content: data.message?.content || "",
										},
										finish_reason: null,
									},
								],
							};
							res.write(`data: ${JSON.stringify(sseData)}\n\n`);
						}
					} catch (_e) {
						// ignore parse errors in streaming
					}
				});

				streamResponse.data.on("end", () => {
					const totalDurationMs = Date.now() - streamStartMs;
					const tokensPerSec = completionTokens > 0 ? (completionTokens / totalDurationMs) * 1000 : 0;

					// Record metrics
					if (ttftMs > 0) {
						const stats = appModule.ollamaService.getStats();
						if (!Array.isArray(stats.ttftHistory)) stats.ttftHistory = [];
						stats.ttftHistory.push(ttftMs);
						if (stats.ttftHistory.length > 100) stats.ttftHistory.shift(); // Keep last 100

						if (!Array.isArray(stats.tokensPerSecHistor)) stats.tokensPerSecHistor = [];
						stats.tokensPerSecHistor.push(tokensPerSec);
						if (stats.tokensPerSecHistor.length > 100) stats.tokensPerSecHistor.shift();
					}

					console.log(
						`[stream-final] ${model}: total=${totalDurationMs}ms, tok/s=${tokensPerSec.toFixed(2)}, ttft=${ttftMs}ms`
					);

					// Send final chunk with finish_reason
					const finalData = {
						id: `chatcmpl-${Date.now()}`,
						object: "chat.completion.chunk",
						created: Math.floor(Date.now() / 1000),
						model,
						choices: [
							{
								index: 0,
								delta: {},
								finish_reason: "stop",
							},
						],
						usage: {
							prompt_tokens: promptTokens,
							completion_tokens: completionTokens,
							total_tokens: promptTokens + completionTokens,
						},
					};
					res.write(`data: ${JSON.stringify(finalData)}\n\n`);
					res.write("data: [DONE]\n\n");
					res.end();
				});

				streamResponse.data.on("error", (err: Error) => {
					console.error("[stream-error]", err);
					res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
					res.end();
				});
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
				res.end();
			}
		} else {
			// Non-streaming mode (original behavior)
			const response = await appModule.ollamaService.chat(model, messages, {
				temperature,
				num_ctx,
				top_p,
				top_k,
			});
			const promptTokens = response.prompt_eval_count || 0;
			const completionTokens = response.eval_count || 0;

			res.json({
				id: `chatcmpl-${Date.now()}`,
				object: "chat.completion",
				created: Math.floor(Date.now() / 1000),
				model: model,
				choices: [
					{
						index: 0,
						message: response.message,
						finish_reason: "stop",
					},
				],
				usage: {
					prompt_tokens: promptTokens,
					completion_tokens: completionTokens,
					total_tokens: promptTokens + completionTokens,
				},
			});
		}
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		res.status(500).json({ error: message });
	}
});

// --- Endpoints de Telemetría y Gestión (Fase 5) ---

// Endpoint status rápido (bajo costo, sin GPU/ngrok)
app.get("/api/status/fast", authMiddleware, async (_req, res) => {
	try {
		const status = await appModule.ollamaService.getFastStatus();
		let brainRunning = false;
		try {
			const container = docker.getContainer(BRAIN_CONTAINER);
			const info = await container.inspect();
			brainRunning = info.State?.Running === true;
		} catch {
			brainRunning = false;
		}
		res.json(withAuthConfig({ ...status, brainRunning }));
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		res.status(500).json({ error: message });
	}
});

// Endpoint status completo (costoso, incluye todo)
app.get("/api/status/full", authMiddleware, async (_req, res) => {
	try {
		const status = await appModule.ollamaService.getServerStatus();
		let brainRunning = false;
		try {
			const container = docker.getContainer(BRAIN_CONTAINER);
			const info = await container.inspect();
			brainRunning = info.State?.Running === true;
		} catch {
			brainRunning = false;
		}
		res.json(withAuthConfig({ ...status, brainRunning }));
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		res.status(500).json({ error: message });
	}
});

// Backward compatibility: /api/status redirige a /fast por defecto
app.get("/api/status", authMiddleware, async (_req, res) => {
	try {
		const status = await appModule.ollamaService.getServerStatus();
		let brainRunning = false;
		try {
			const container = docker.getContainer(BRAIN_CONTAINER);
			const info = await container.inspect();
			brainRunning = info.State?.Running === true;
		} catch {
			brainRunning = false;
		}
		res.json(withAuthConfig({ ...status, brainRunning }));
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		res.status(500).json({ error: message });
	}
});

// --- Auth Settings (toggle API Key enforcement) ---

app.get("/api/auth/settings", authMiddleware, (_req, res) => {
	res.json(appModule.authService.getSettings());
});

app.post("/api/auth/ollama", authMiddleware, (req, res) => {
	const { enabled } = req.body;
	if (typeof enabled !== "boolean") {
		return res.status(400).json({ error: "enabled debe ser boolean" });
	}
	appModule.authService.setOllamaAuthEnabled(enabled);
	res.json(appModule.authService.getSettings());
});

app.post("/api/auth/mcp", authMiddleware, (req, res) => {
	const { enabled } = req.body;
	if (typeof enabled !== "boolean") {
		return res.status(400).json({ error: "enabled debe ser boolean" });
	}
	appModule.authService.setMcpAuthEnabled(enabled);
	res.json(appModule.authService.getSettings());
});

app.get("/api/auth/mcp/tools", authMiddleware, (_req, res) => {
	const permissions = appModule.authService.getMcpToolPermissions();
	const byName = new Map(permissions.map((item) => [item.name, item.enabled]));
	const ALL_TOOLS_CATALOG = [...MCP_TOOL_CATALOG];
	const tools = ALL_TOOLS_CATALOG.map((tool) => ({
		name: tool.name,
		description: tool.description,
		enabled: byName.get(tool.name) ?? true,
	}));
	res.json({ tools });
});

app.post("/api/auth/mcp/tools/:name", authMiddleware, (req, res) => {
	const { name } = req.params;
	const { enabled } = req.body;

	if (typeof enabled !== "boolean") {
		return res.status(400).json({ error: "enabled debe ser boolean" });
	}

	const knownTool = [...MCP_TOOL_CATALOG].some((tool) => tool.name === name);
	if (!knownTool) {
		return res.status(404).json({ error: `Tool ${name} no existe` });
	}

	const updated = appModule.authService.setMcpToolEnabled(name, enabled);
	if (!updated) {
		return res.status(404).json({ error: `Tool ${name} no existe` });
	}

	res.json({
		name,
		enabled,
		mcpTools: appModule.authService.getMcpToolPermissions(),
	});
});

app.post("/api/unload", authMiddleware, async (_req, res) => {
	try {
		await appModule.ollamaService.unloadModels();
		res.json({ message: "VRAM freed successfully" });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		res.status(500).json({ error: message });
	}
});

app.post("/api/ban", authMiddleware, async (req, res) => {
	const { ip } = req.body;
	if (!ip) return res.status(400).json({ error: "IP is required" });
	appModule.ollamaService.banIp(ip);
	res.json({ message: `IP ${ip} banned` });
});

app.post("/api/unban", authMiddleware, async (req, res) => {
	const { ip } = req.body;
	if (!ip) return res.status(400).json({ error: "IP is required" });
	appModule.ollamaService.unbanIp(ip);
	res.json({ message: `IP ${ip} unbanned` });
});

app.post("/api/pull", authMiddleware, async (req, res) => {
	const { model } = req.body;
	if (!model) return res.status(400).json({ error: "Model is required" });
	try {
		// No esperamos a que termine, pullModel emite via socket el progreso
		appModule.ollamaService.pullModel(model).catch((err) => {
			console.error(`Error pulling model ${model}:`, err);
		});
		res.json({ message: `Pulling model ${model} started` });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		res.status(500).json({ error: message });
	}
});

app.post("/api/clean", authMiddleware, async (_req, res) => {
	try {
		const result = await appModule.ollamaService.cleanWorkspace();
		res.json({ message: "Workspace cleaned", freed: result.freed });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		res.status(500).json({ error: message });
	}
});

app.delete("/api/models/:name", authMiddleware, async (req, res) => {
	try {
		await appModule.ollamaService.deleteModel(req.params.name);
		res.json({ message: `Model ${req.params.name} deleted` });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		res.status(500).json({ error: message });
	}
});

// --- Hardware Sentinel ---

app.get("/api/hardware", authMiddleware, (_req, res) => {
	res.json({
		vram: appModule.ollamaService.getVramInfo(),
		autoUnloadMinutes: appModule.ollamaService.getAutoUnload(),
		globalNumCtx: appModule.ollamaService.getGlobalNumCtx(),
	});
});

app.post("/api/hardware/auto-unload", authMiddleware, (req, res) => {
	const { minutes } = req.body;
	if (typeof minutes !== "number" || minutes < 0) {
		return res.status(400).json({ error: "minutes debe ser un numero >= 0 (0 = desactivado)" });
	}
	appModule.ollamaService.setAutoUnload(minutes);
	res.json({
		message: `Auto-unload: ${minutes === 0 ? "desactivado" : `${minutes} min`}`,
		autoUnloadMinutes: minutes,
	});
});

app.post("/api/hardware/num-ctx", authMiddleware, (req, res) => {
	const { numCtx } = req.body;
	if (typeof numCtx !== "number" || numCtx < 512) {
		return res.status(400).json({ error: "numCtx debe ser >= 512" });
	}
	appModule.ollamaService.setGlobalNumCtx(numCtx);
	res.json({ message: `Contexto global: ${numCtx} tokens`, globalNumCtx: numCtx });
});

// --- AI Engine Tuner ---

app.get("/api/engine-stats", authMiddleware, (_req, res) => {
	const stats = appModule.ollamaService.getStats();
	const gpu = appModule.ollamaService.getGpuMetrics();
	res.json({ stats, gpu });
});

app.post("/api/engine-stats/electricity-rate", authMiddleware, (req, res) => {
	const { rateARS } = req.body;
	if (typeof rateARS !== "number" || rateARS < 0) {
		return res.status(400).json({ error: "rateARS debe ser un numero >= 0" });
	}
	appModule.ollamaService.updateElectricityRate(rateARS);
	res.json({ message: `Tarifa actualizada: ${rateARS} ARS/kWh` });
});

app.post("/api/engine-stats/cloud-price", authMiddleware, (req, res) => {
	const { pricePerMToken } = req.body;
	if (typeof pricePerMToken !== "number" || pricePerMToken < 0) {
		return res.status(400).json({ error: "pricePerMToken debe ser >= 0" });
	}
	appModule.ollamaService.updateCloudPrice(pricePerMToken);
	res.json({ message: `Precio cloud actualizado: $${pricePerMToken} USD/1M tokens` });
});

// --- Control de Ngrok via Docker API ---
const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const NGROK_CONTAINER = process.env.NGROK_CONTAINER_NAME || "mcp-ngrok-tunnel";
const BRAIN_CONTAINER = process.env.BRAIN_CONTAINER_NAME || "brain";
let ngrokAuthtokenConfigured = Boolean(process.env.NGROK_AUTHTOKEN?.trim());

async function getBrainContainer() {
	try {
		return docker.getContainer(BRAIN_CONTAINER);
	} catch {
		return null;
	}
}

async function getNgrokContainer() {
	try {
		return docker.getContainer(NGROK_CONTAINER);
	} catch {
		return null;
	}
}

async function runNgrokCommand(container: Docker.Container, cmd: string[]) {
	const exec = await container.exec({
		Cmd: cmd,
		AttachStdout: true,
		AttachStderr: true,
	});

	const stream = await exec.start({ hijack: true, stdin: false });
	await new Promise<void>((resolve, reject) => {
		stream.on("end", () => resolve());
		stream.on("error", (err) => reject(err));
	});

	const result = await exec.inspect();
	if (result.ExitCode !== 0) {
		throw new Error(`Comando ngrok fallido (exit=${result.ExitCode})`);
	}
}

app.get("/api/ngrok/status", authMiddleware, async (_req, res) => {
	try {
		const container = await getNgrokContainer();
		if (!container) return res.json({ running: false, url: null });
		const info = await container.inspect();
		const running = info.State?.Running === true;
		// Si está corriendo, intentar obtener la URL del tunnel
		let url: string | null = null;
		if (running) {
			try {
				const ngrokRes = await axios.get("http://mcp-ngrok-tunnel:4040/api/tunnels", { timeout: 2000 });
				url = ngrokRes.data?.tunnels?.[0]?.public_url || null;
			} catch {
				/* tunnel aún iniciando */
			}
		}
		res.json({ running, url });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		res.json({ running: false, url: null, error: message });
	}
});

app.get("/api/ngrok/config", authMiddleware, async (_req, res) => {
	const appPort = process.env.APP_PORT || "3000";
	res.json({
		containerName: NGROK_CONTAINER,
		targetService: "mcp-server",
		targetPort: appPort,
		dashboardApiUrl: "http://mcp-ngrok-tunnel:4040/api/tunnels",
		authtokenConfigured: ngrokAuthtokenConfigured,
	});
});

app.post("/api/ngrok/authtoken", authMiddleware, async (req, res) => {
	const { authtoken } = req.body;
	if (typeof authtoken !== "string" || authtoken.trim().length < 10) {
		return res.status(400).json({ error: "authtoken invalido" });
	}

	let startedByThisRequest = false;
	try {
		const container = await getNgrokContainer();
		if (!container) {
			return res.status(404).json({ error: "Contenedor ngrok no encontrado" });
		}

		const info = await container.inspect();
		const wasRunning = info.State?.Running === true;

		if (!wasRunning) {
			await container.start();
			startedByThisRequest = true;
		}

		await runNgrokCommand(container, ["ngrok", "config", "add-authtoken", authtoken.trim()]);
		ngrokAuthtokenConfigured = true;

		if (wasRunning) {
			await container.restart();
		} else if (startedByThisRequest) {
			await container.stop();
		}

		res.json({ message: "Authtoken de ngrok actualizado", authtokenConfigured: true });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : "Error actualizando authtoken de ngrok";
		res.status(500).json({ error: message });
	}
});

app.post("/api/ngrok/start", authMiddleware, async (_req, res) => {
	try {
		const container = await getNgrokContainer();
		if (!container)
			return res.status(404).json({ error: "Contenedor ngrok no encontrado. Verifica docker-compose." });
		const info = await container.inspect();
		if (info.State?.Running) return res.json({ message: "Ngrok ya está corriendo", running: true });
		await container.start();
		console.log("[ngrok] Tunel iniciado manualmente desde el Dashboard");
		res.json({ message: "Ngrok iniciado", running: true });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		res.status(500).json({ error: message });
	}
});

app.post("/api/ngrok/stop", authMiddleware, async (_req, res) => {
	try {
		const container = await getNgrokContainer();
		if (!container) return res.status(404).json({ error: "Contenedor ngrok no encontrado" });
		const info = await container.inspect();
		if (!info.State?.Running) return res.json({ message: "Ngrok ya está detenido", running: false });
		await container.stop();
		console.log("[ngrok] Tunel detenido manualmente desde el Dashboard");
		res.json({ message: "Ngrok detenido", running: false });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		res.status(500).json({ error: message });
	}
});

// --- Control de Ollama Motor via Docker API ---
const OLLAMA_CONTAINER = "mcp-ollama-motor";

async function getOllamaContainer() {
	try {
		return docker.getContainer(OLLAMA_CONTAINER);
	} catch {
		return null;
	}
}

app.post("/api/ollama/start", authMiddleware, async (_req, res) => {
	try {
		const container = await getOllamaContainer();
		if (!container) return res.status(404).json({ error: "Contenedor Ollama no encontrado." });
		await container.start();
		res.json({ message: "Motor Ollama iniciado" });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		res.status(500).json({ error: message });
	}
});

app.post("/api/ollama/stop", authMiddleware, async (_req, res) => {
	try {
		const container = await getOllamaContainer();
		if (!container) return res.status(404).json({ error: "Contenedor Ollama no encontrado." });
		await container.stop();
		res.json({ message: "Motor Ollama detenido" });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		res.status(500).json({ error: message });
	}
});

app.post("/api/ollama/restart", authMiddleware, async (_req, res) => {
	try {
		const container = await getOllamaContainer();
		if (!container) return res.status(404).json({ error: "Contenedor Ollama no encontrado." });
		await container.restart();
		res.json({ message: "Motor Ollama reiniciado" });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		res.status(500).json({ error: message });
	}
});

// --- Control de Cerebro MCP via Docker API ---
app.post("/api/brain/start", authMiddleware, async (_req, res) => {
	try {
		const container = await getBrainContainer();
		if (!container) return res.status(404).json({ error: "Contenedor mcp-brain no encontrado." });
		await container.start();
		res.json({ message: "Cerebro MCP iniciado", running: true });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		res.status(500).json({ error: message });
	}
});

app.post("/api/brain/stop", authMiddleware, async (_req, res) => {
	try {
		const container = await getBrainContainer();
		if (!container) return res.status(404).json({ error: "Contenedor mcp-brain no encontrado." });
		await container.stop();
		res.json({ message: "Cerebro MCP detenido", running: false });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		res.status(500).json({ error: message });
	}
});

// --- Scraper de Ollama Library ---
app.get("/api/search-models", authMiddleware, async (req, res) => {
	const q = (req.query.q as string) || "";
	const sort = (req.query.sort as string) || "";
	try {
		let url = "https://ollama.com/library";
		const params = new URLSearchParams();
		if (q) params.append("q", q);
		if (sort) params.append("sort", sort);
		const qs = params.toString();
		if (qs) url += `?${qs}`;
		const response = await axios.get(url, {
			timeout: 8000,
			headers: { "User-Agent": "Mozilla/5.0 (compatible; LaLlamaOllama/1.0)" },
		});
		const $ = cheerio.load(response.data);
		interface ScrapedModel {
			name: string;
			title: string;
			desc: string;
			pulls: string;
			tags: string[];
		}
		const models: ScrapedModel[] = [];

		// Parsear tarjetas de modelos de ollama.com/library
		$('a[href^="/library/"]').each((_, el) => {
			const href = $(el).attr("href") || "";
			const name = href.replace("/library/", "").trim();
			if (!name || name.includes("/")) return;

			const title = $(el).find("h2, [class*='title'], strong").first().text().trim() || name;
			const desc = $(el).find("p, [class*='desc']").first().text().trim();
			const pulls = $(el).find("[class*='pull'],[class*='download']").first().text().trim();
			const tags = $(el)
				.find("[class*='tag'],[class*='size']")
				.map((_, t) => $(t).text().trim())
				.get()
				.filter(Boolean)
				.slice(0, 4);

			if (name && !models.find((m) => m.name === name)) {
				models.push({ name, title, desc, pulls, tags });
			}
		});

		res.json({ models: models.slice(0, 24), query: q, source: url });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		res.status(500).json({ error: `Error scraping ollama.com: ${message}`, models: [] });
	}
});

// Los endpoints de memoria ahora son servidos por mcp-brain en el puerto 3001

// --- Endpoints MCP (SSE) with Auth ---

let transport: SSEServerTransport | null = null;

app.get("/sse", async (req: Request, res: Response) => {
	const apiKey = req.headers["x-api-key"] || req.headers.authorization?.toString().replace("Bearer ", "");
	const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";

	if (appModule.authService.isMcpAuthEnabled() && !appModule.authService.validate(apiKey as string)) {
		console.warn(`[SSE-AUTH-FAIL] Unauthorized MCP connection attempt from ${ip}`);
		appModule.ollamaService.logRequest(ip, "GET /sse", "Unauthorized");
		appModule.ollamaService.reportFailedAuth(ip);
		return res.status(401).json({ error: "Unauthorized: Invalid API Key" });
	}

	console.log(`[SSE] New authenticated connection from ${ip}`);
	const _sessionId = appModule.sessionManager.createSession(ip, apiKey as string);

	transport = new SSEServerTransport("/messages", res);
	await server.connect(transport);
});

app.post("/messages", async (req: Request, res: Response) => {
	const apiKey = req.headers["x-api-key"] || req.headers.authorization?.toString().replace("Bearer ", "");

	if (appModule.authService.isMcpAuthEnabled() && !appModule.authService.validate(apiKey as string)) {
		return res.status(401).json({ error: "Unauthorized: Invalid API Key" });
	}

	if (transport) {
		await transport.handlePostMessage(req, res);
	} else {
		res.status(400).send("No transport active");
	}
});

httpServer.listen(port, () => {
	console.log(`\n🚀 Servidor Híbrido Blindado Iniciado`);
	console.log(`----------------------------------`);
	console.log(`MCP SSE: http://localhost:${port}/sse`);
	console.log(`OpenAI API: http://localhost:${port}/v1`);
	console.log(`WebSockets: Activo`);
	console.log(`----------------------------------\n`);
	console.log(`Utiliza tu API_KEY definida en el .env para autenticarte.`);
});

export { io };
