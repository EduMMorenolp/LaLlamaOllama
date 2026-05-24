import { exec } from "node:child_process";
import * as fs from "node:fs";
import http from "node:http";
import https from "node:https";
import type { AxiosInstance } from "axios";
import axios from "axios";
import type { Server as SocketServer } from "socket.io";

export interface OllamaModel {
	name: string;
	size: number;
	format: string;
}

interface RequestLogEntry {
	ip: string;
	action: string;
	status: string;
	timestamp: string;
}

interface SessionMessage {
	role: string;
	content: string;
	[key: string]: unknown;
}

interface GpuMetrics {
	vram: { total: number; used: number; free: number; available: boolean };
	powerDraw: number | null;
	temperature: number | null;
	fanSpeed: number | null;
	gpuUtil: number | null;
}

interface ChatResponse {
	message: { role: string; content: string };
	prompt_eval_count: number;
	eval_count: number;
	total_duration: number;
}

export class OllamaService {
	private readonly baseUrl: string;
	private readonly requestLogs: RequestLogEntry[] = [];
	private readonly blacklist: Set<string> = new Set();
	private readonly failedAttempts: Map<string, number> = new Map();
	private readonly sessionCache: Map<string, SessionMessage[]> = new Map();
	private readonly modelDeletePending: Set<string> = new Set();
	private io?: SocketServer;
	private readonly pullStates: Map<string, { percent: number; status: string; lastUpdate: number }> = new Map();
	private readonly startTime: number = Date.now();
	private readonly httpAgent: http.Agent;
	private readonly httpsAgent: https.Agent;
	private readonly axiosClient: AxiosInstance;
	private activeRequests: number = 0;
	private readonly maxConcurrentRequests: number = 3;
	private readonly requestQueue: Array<() => Promise<void>> = [];
	private totalRequests: number = 0;
	private lastChatTime: number = Date.now();
	private autoUnloadMinutes: number = 0;
	private globalNumCtx: number = 4096;

	// --- GPU Metrics Cache (async, non-blocking) ---
	private cachedGpuMetrics: GpuMetrics = {
		vram: { total: 0, used: 0, free: 0, available: false },
		powerDraw: null,
		temperature: null,
		fanSpeed: null,
		gpuUtil: null,
	};

	// --- Request Concurrency Control ---
	private async enqueueRequest<T>(fn: () => Promise<T>): Promise<T> {
		// If we're under the limit, execute immediately
		if (this.activeRequests < this.maxConcurrentRequests) {
			this.activeRequests++;
			try {
				return await fn();
			} finally {
				this.activeRequests--;
				// Process next queued request
				const nextFn = this.requestQueue.shift();
				if (nextFn) {
					this.enqueueRequest(nextFn).catch(console.error);
				}
			}
		}

		// Otherwise, queue for later
		return new Promise((resolve, reject) => {
			this.requestQueue.push(async () => {
				this.activeRequests++;
				try {
					resolve(await fn());
				} catch (e) {
					reject(e);
				} finally {
					this.activeRequests--;
					const next = this.requestQueue.shift();
					if (next) {
						this.enqueueRequest(next).catch(console.error);
					}
				}
			});
		});
	}

	// --- Persistent Stats ---
	private readonly statsFile = "./lallama_stats.json";
	private stats = {
		totalInputTokens: 0,
		totalOutputTokens: 0,
		totalInferenceMs: 0,
		inferenceHours: 0,
		thermalStressScore: 0,
		sessionCount: 0,
		kwhConsumed: 0,
		electricityRateARS: 150,
		cloudPricePerMToken: 5.0,
		createdAt: new Date().toISOString(),
		// Fase 3: Performance metrics
		ttftHistory: [] as number[], // TTFT (time to first token) per request
		tokensPerSecHistor: [] as number[], // tokens/sec per request
	};

	constructor() {
		this.baseUrl = process.env.OLLAMA_URL || "http://ollama:11434";

		// Setup HTTP agents with keep-alive
		this.httpAgent = new http.Agent({
			keepAlive: true,
			keepAliveMsecs: 1000,
			maxSockets: 10,
			maxFreeSockets: 5,
		});
		this.httpsAgent = new https.Agent({
			keepAlive: true,
			keepAliveMsecs: 1000,
			maxSockets: 10,
			maxFreeSockets: 5,
		});

		// Create axios client with keep-alive
		this.axiosClient = axios.create({
			httpAgent: this.httpAgent,
			httpsAgent: this.httpsAgent,
			timeout: 120000, // 2 min timeout for long inference
		});

		this.loadStats();
		this.startAutoUnloadWatcher();
		this.startGpuMetricsWatcher();
	}

	public async checkConnection(): Promise<void> {
		try {
			await this.axiosClient.get(`${this.baseUrl}/api/tags`, { timeout: 3000 });
			const cyan = "\x1b[36m";
			const yellow = "\x1b[33m";
			const green = "\x1b[32m";
			const reset = "\x1b[0m";

			console.log(`
        ${green}✅ Ollama Engine Connection Established${reset}
        -----------------------------------
        ${yellow}Host:${reset}     ${cyan}${this.baseUrl}${reset}
        ${yellow}Driver:${reset}   ${cyan}Axios / REST${reset}
        ${yellow}Modo:${reset}     ${cyan}${process.env.NODE_ENV || "development"}${reset}
        -----------------------------------
        `);
		} catch (_error) {
			console.error("❌ No se pudo conectar al motor Ollama local");
		}
	}

	// --- GPU Metrics Watcher (async, non-blocking) ---
	private startGpuMetricsWatcher() {
		setInterval(() => {
			const cmd =
				"nvidia-smi --query-gpu=memory.total,memory.used,memory.free,power.draw,temperature.gpu,fan.speed,utilization.gpu --format=csv,noheader,nounits";
			const timeoutHandle = setTimeout(() => {}, 2000);
			exec(cmd, (err: Error | null, stdout: string) => {
				clearTimeout(timeoutHandle);
				if (err) return;
				try {
					const parts = stdout
						.trim()
						.split(",")
						.map((v: string) => parseFloat(v.trim()));
					this.cachedGpuMetrics = {
						vram: { total: parts[0], used: parts[1], free: parts[2], available: true },
						powerDraw: Number.isNaN(parts[3]) ? null : parts[3],
						temperature: Number.isNaN(parts[4]) ? null : parts[4],
						fanSpeed: Number.isNaN(parts[5]) ? null : parts[5],
						gpuUtil: Number.isNaN(parts[6]) ? null : parts[6],
					};
					if (this.cachedGpuMetrics.temperature !== null) {
						this.addThermalStress(this.cachedGpuMetrics.temperature);
					}
				} catch (_e) {
					// ignore parse errors
				}
			});
		}, 3000);
	}

	// --- Auto-Unload Watcher ---
	private startAutoUnloadWatcher() {
		setInterval(async () => {
			if (this.autoUnloadMinutes <= 0) return;
			const inactiveMins = (Date.now() - this.lastChatTime) / 60000;
			if (inactiveMins >= this.autoUnloadMinutes) {
				console.log(`[auto-unload] ${inactiveMins.toFixed(1)}min inactividad — liberando VRAM...`);
				try {
					await this.unloadModels();
					if (this.io)
						this.io.emit("security-alert", {
							type: "info",
							message: `Auto-Unload: VRAM liberada por inactividad (${this.autoUnloadMinutes}min)`,
						});
				} catch (err) {
					console.error("[auto-unload-error]", err);
					if (this.io)
						this.io.emit("security-alert", {
							type: "error",
							message: `Auto-Unload falló: revisa los logs`,
						});
				}
				this.lastChatTime = Date.now();
			}
		}, 60 * 1000);
	}

	setAutoUnload(minutes: number) {
		this.autoUnloadMinutes = minutes;
	}

	setGlobalNumCtx(ctx: number) {
		this.globalNumCtx = Math.max(512, Math.min(ctx, 131072));
	}

	getGlobalNumCtx() {
		return this.globalNumCtx;
	}
	getAutoUnload() {
		return this.autoUnloadMinutes;
	}

	// --- GPU Metrics (now cached, non-blocking) ---
	getGpuMetrics(): {
		vram: { total: number; used: number; free: number; available: boolean };
		powerDraw: number | null;
		temperature: number | null;
		fanSpeed: number | null;
		gpuUtil: number | null;
	} {
		return { ...this.cachedGpuMetrics };
	}

	getVramInfo() {
		return this.getGpuMetrics().vram;
	}

	// --- Stats Persistence ---
	private loadStats() {
		try {
			if (fs.existsSync(this.statsFile)) {
				const data = JSON.parse(fs.readFileSync(this.statsFile, "utf8"));
				this.stats = { ...this.stats, ...data };
			}
		} catch {}
	}

	private saveStats() {
		try {
			fs.writeFileSync(this.statsFile, JSON.stringify(this.stats, null, 2));
		} catch {}
	}

	trackTokenUsage(inputTokens: number, outputTokens: number, durationMs: number, powerWatts?: number | null) {
		this.stats.totalInputTokens += inputTokens || 0;
		this.stats.totalOutputTokens += outputTokens || 0;
		this.stats.totalInferenceMs += durationMs || 0;
		this.stats.inferenceHours = this.stats.totalInferenceMs / 3_600_000;
		this.stats.sessionCount++;
		if (powerWatts && powerWatts > 0) {
			this.stats.kwhConsumed += (powerWatts * (durationMs / 3_600_000)) / 1000;
		}
		if (this.stats.sessionCount % 5 === 0) this.saveStats();
	}

	addThermalStress(temperature: number) {
		if (temperature > 85) this.stats.thermalStressScore += 3;
		else if (temperature > 75) this.stats.thermalStressScore += 1;
		// Auto-unload de emergencia si temperatura critica
		if (temperature >= 90) {
			this.unloadModels().catch(() => {});
			if (this.io)
				this.io.emit("security-alert", {
					type: "ban",
					message: `ALERTA TERMICA: GPU a ${temperature}C. Modelos descargados automaticamente.`,
				});
		}
		if (this.stats.thermalStressScore % 20 === 0) this.saveStats();
	}

	updateElectricityRate(rateARS: number) {
		this.stats.electricityRateARS = rateARS;
		this.saveStats();
	}
	updateCloudPrice(price: number) {
		this.stats.cloudPricePerMToken = price;
		this.saveStats();
	}
	getStats() {
		return { ...this.stats };
	}

	setIo(io: SocketServer) {
		this.io = io;
		io.on("connection", (socket) => {
			// Enviar estados actuales de descarga al nuevo cliente
			this.pullStates.forEach((value, key) => {
				socket.emit("pull-progress", { model: key, percent: value.percent, status: value.status });
			});
		});
	}

	async listModels(): Promise<OllamaModel[]> {
		try {
			const response = await this.axiosClient.get(`${this.baseUrl}/api/tags`, { timeout: 2000 });
			return response.data.models || [];
		} catch {
			return []; // Devolver vacío silenciosamente si el motor está apagado
		}
	}

	async generate(
		model: string,
		prompt: string,
		options: Record<string, unknown> = {},
		keep_alive: string | number = "5m"
	): Promise<string> {
		const response = await this.axiosClient.post(`${this.baseUrl}/api/generate`, {
			model,
			prompt,
			options,
			keep_alive,
			stream: false,
		});
		return response.data.response;
	}

	async embed(model: string, input: string | string[]): Promise<number[][]> {
		try {
			const response = await this.axiosClient.post(`${this.baseUrl}/api/embed`, {
				model,
				input,
			});
			return response.data.embeddings || [];
		} catch (error) {
			console.error("[OllamaService] Error generating embeddings:", error);
			return [];
		}
	}

	/**
	 * Construye mensajes de sesión comprimiendo historial antiguo para ahorrar tokens.
	 * Si hay >6 msgs en cache, resume los antiguos en un system msg y mantiene los últimos 5.
	 */
	private buildSessionMessages(
		messages: SessionMessage[],
		sessionId?: string
	): SessionMessage[] {
		if (!sessionId) return messages;
		const cached = this.sessionCache.get(sessionId) || [];
		if (messages.length !== 1 || cached.length === 0) return messages;

		let finalMessages: SessionMessage[];
		if (cached.length > 6) {
			// Resumir mensajes antiguos en un system message
			const keep = cached.slice(-5);
			const summary = `[Historial: ${cached.length - 5} mensajes anteriores resumidos. Último tema: "${cached[cached.length - 1]?.content?.substring(0, 80)}"]`;
			finalMessages = [{ role: "system", content: summary }, ...keep, ...messages];
		} else {
			finalMessages = [...cached, ...messages];
		}

		// Cache limitado a 10 mensajes (vs 20 anterior)
		this.sessionCache.set(sessionId, finalMessages.slice(-10));
		return finalMessages;
	}

	/**
	 * Envía solo options no-default para ahorrar bytes en el request a Ollama
	 */
	private buildOllamaBody(
		model: string,
		messages: SessionMessage[],
		options: Record<string, unknown>,
		keepAlive: string | number,
		stream: boolean
	): Record<string, unknown> {
		const body: Record<string, unknown> = { model, messages, stream };
		const mergedOptions = { ...options };
		if (options.num_ctx === undefined) mergedOptions.num_ctx = this.globalNumCtx;
		if (Object.keys(mergedOptions).length > 0) body.options = mergedOptions;
		if (keepAlive !== "5m") body.keep_alive = keepAlive;
		return body;
	}

	async chat(
		model: string,
		messages: SessionMessage[],
		options: Record<string, unknown> = {},
		keep_alive: string | number = "5m",
		sessionId?: string
	): Promise<ChatResponse> {
		return this.enqueueRequest(async () => {
			const finalMessages = this.buildSessionMessages(messages, sessionId);
			this.lastChatTime = Date.now();
			const startMs = Date.now();

			const response = await this.axiosClient.post(
				`${this.baseUrl}/api/chat`,
				this.buildOllamaBody(model, finalMessages, options, keep_alive, false)
			);

			const durationMs = Date.now() - startMs;
			const promptTokens = response.data.prompt_eval_count || 0;
			const evalTokens = response.data.eval_count || 0;
			const gpuPower = this.cachedGpuMetrics.powerDraw;
			this.trackTokenUsage(promptTokens, evalTokens, durationMs, gpuPower);

			return {
				message: response.data.message,
				prompt_eval_count: promptTokens,
				eval_count: evalTokens,
				total_duration: durationMs,
			};
		});
	}

	async chatStream(
		model: string,
		messages: SessionMessage[],
		options: Record<string, unknown> = {},
		keep_alive: string | number = "5m",
		sessionId?: string
	): Promise<{ data: import("stream").Readable }> {
		return this.enqueueRequest(async () => {
			const finalMessages = this.buildSessionMessages(messages, sessionId);
			this.lastChatTime = Date.now();

			return this.axiosClient.post(
				`${this.baseUrl}/api/chat`,
				this.buildOllamaBody(model, finalMessages, options, keep_alive, true),
				{ responseType: "stream" }
			);
		});
	}

	async unloadModels(): Promise<void> {
		const models = await this.listModels();
		for (const model of models) {
			await this.axiosClient
				.post(`${this.baseUrl}/api/chat`, {
					model: model.name,
					keep_alive: 0,
				})
				.catch(() => {});
		}
	}

	async pullModel(model: string): Promise<void> {
		const status = (await this.getServerStatus()) as { diskSpace?: { free: number } };
		const diskFree = status.diskSpace?.free ?? 0;
		if (diskFree < 2) {
			const msg = `Espacio insuficiente para descargar ${model}. Libres: ${diskFree.toFixed(2)}GB`;
			if (this.io) this.io.emit("security-alert", { type: "error", message: msg });
			throw new Error(msg);
		}

		try {
			const response = await this.axiosClient.post(
				`${this.baseUrl}/api/pull`,
				{
					name: model,
					stream: true,
				},
				{ responseType: "stream" }
			);

			let buffer = "";
			response.data.on("data", (chunk: Buffer) => {
				buffer += chunk.toString();
				const lines = buffer.split("\n");
				buffer = lines.pop() || ""; // Mantener la última línea incompleta en el buffer

				for (const line of lines) {
					if (!line) continue;
					try {
						const update = JSON.parse(line);
						if (update.status === "downloading" && update.total) {
							const percent = Math.round((update.completed / update.total) * 100);
							const prevState = this.pullStates.get(model);
							const now = Date.now();
							// Emitir si el porcentaje avanzó o pasaron más de 2 segundos
							if (!prevState || percent >= prevState.percent + 1 || now - prevState.lastUpdate > 2000) {
								this.pullStates.set(model, { percent, status: update.status, lastUpdate: now });
								if (this.io) this.io.emit("pull-progress", { model, percent, status: update.status });
							}
						} else if (update.status === "success") {
							this.pullStates.delete(model);
							if (this.io) {
								this.io.emit("pull-progress", { model, percent: 100, status: "completed" });
								setTimeout(() => {
									if (this.io) this.io.emit("pull-progress", { model, percent: 100, status: "done" });
								}, 1500);
							}
						}
					} catch (_e) {
						// Ignorar errores de parseo
					}
				}
			});
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			if (this.io)
				this.io.emit("security-alert", { type: "error", message: `Fallo al descargar ${model}: ${message}` });
			throw e;
		}
	}

	async deleteModel(model: string): Promise<void> {
		try {
			// Fase 1: Prevent double-delete and track pending deletions
			if (this.modelDeletePending.has(model)) {
				throw new Error(`Model ${model} deletion already in progress`);
			}

			this.modelDeletePending.add(model);
			try {
				// Verify model exists before attempting delete
				const models = await this.listModels();
				if (!models.find((m) => m.name === model)) {
					throw new Error(`Model ${model} not found`);
				}

				await this.axiosClient({
					method: "DELETE",
					url: `${this.baseUrl}/api/delete`,
					data: { name: model },
					timeout: 30000,
				});

				console.log(`[delete] Model ${model} deleted successfully`);
				if (this.io) {
					this.io.emit("security-alert", {
						type: "info",
						message: `Modelo ${model} eliminado correctamente.`,
					});
				}
			} finally {
				this.modelDeletePending.delete(model);
			}
		} catch (e) {
			console.error(`[delete-error] Failed to delete model ${model}:`, e);
			if (this.io) {
				this.io.emit("security-alert", {
					type: "error",
					message: `Error al eliminar modelo: ${e instanceof Error ? e.message : "desconocido"}`,
				});
			}
			throw e;
		}
	}

	async cleanWorkspace(): Promise<{ freed: number; details?: string }> {
		// Fase 1: Safe cleanup - don't clean if there are pending operations
		if (this.modelDeletePending.size > 0) {
			const pendingModels = Array.from(this.modelDeletePending).join(", ");
			throw new Error(
				`Cannot clean workspace: ${this.modelDeletePending.size} model(s) deletion in progress: ${pendingModels}`
			);
		}

		let freed = 0;
		let cleanedFiles = 0;
		try {
			const blobsPath = "/root/.ollama/models/blobs";
			console.log(`[cleanup] Starting safe workspace cleanup in ${blobsPath}`);

			if (fs.existsSync(blobsPath)) {
				const files = fs.readdirSync(blobsPath);
				console.log(`[cleanup] Found ${files.length} blob files to scan`);

				for (const file of files) {
					try {
						const filePath = `${blobsPath}/${file}`;
						const stats = fs.statSync(filePath);
						const now = Date.now();
						const lastAccess = stats.atimeMs;

						// Only clean blobs older than 24 hours
						if (now - lastAccess > 24 * 60 * 60 * 1000) {
							freed += stats.size;
							fs.unlinkSync(filePath);
							cleanedFiles++;
						}
					} catch (e) {
						console.warn(`[cleanup] Error processing file ${file}:`, e);
					}
				}
			}

			const freedGb = (freed / 1024 ** 3).toFixed(2);
			console.log(`[cleanup] Cleanup complete: freed ${freedGb} GB (${cleanedFiles} files)`);

			return {
				freed: parseFloat(freedGb) as number,
				details: `${cleanedFiles} blob files deleted, ${freedGb} GB freed`,
			};
		} catch (e) {
			console.error("[cleanup-error]", e);
			throw e;
		}
	}

	async getServerStatus(): Promise<Record<string, unknown>> {
		let diskSpace = { free: 0, total: 0 };
		try {
			const stats = fs.statfsSync("/root/.ollama");
			const bavail = Number(stats.bavail);
			const bsize = Number(stats.bsize);
			const blocks = Number(stats.blocks);
			diskSpace = {
				free: (bavail * bsize) / 1024 ** 3,
				total: (blocks * bsize) / 1024 ** 3,
			};
		} catch (_e) {
			// Silenciar error en windows local si Ollama no está montado
		}

		let loadedModels = [];
		try {
			const psResponse = await this.axiosClient.get(`${this.baseUrl}/api/ps`);
			loadedModels = psResponse.data.models || [];
		} catch (_e) {
			// Silenciar error de red si ollama está offline
		}

		let ngrokInfo = { url: null as string | null, latency: 0, active: false };
		try {
			const ngrokResponse = await this.axiosClient.get("http://mcp-ngrok-tunnel:4040/api/tunnels", {
				timeout: 2000,
			});
			const tunnel = ngrokResponse.data.tunnels[0];
			if (tunnel) {
				ngrokInfo = { url: tunnel.public_url, latency: 0, active: true };
			}
		} catch (e: unknown) {
			const err = e as { code?: string; message?: string };
			if (err?.code !== "ENOTFOUND" && err?.code !== "ECONNREFUSED" && err?.code !== "ETIMEDOUT") {
				console.warn("[ngrok] Error inesperado:", err?.message || err?.code);
			}
		}

		let ollamaRunning = false;
		try {
			await this.axiosClient.get(`${this.baseUrl}/api/tags`, { timeout: 3000 });
			ollamaRunning = true;
		} catch {
			ollamaRunning = false;
		}

		const uptimeMs = Date.now() - this.startTime;
		const uptimeHours = Math.floor(uptimeMs / 3600000);
		const uptimeMins = Math.floor((uptimeMs % 3600000) / 60000);
		const uptime = `${uptimeHours}h ${uptimeMins}m`;

		const gpu = this.getGpuMetrics();

		return {
			ollamaRunning,
			diskSpace,
			gpu,
			vram: gpu.vram,
			loadedModels,
			ngrokInfo,
			uptime,
			totalRequests: this.totalRequests,
			autoUnloadMinutes: this.autoUnloadMinutes,
			globalNumCtx: this.globalNumCtx,
			engineStats: this.getStats(),
			timestamp: new Date().toISOString(),
			recentLogs: this.requestLogs.slice(-100).reverse(),
			blacklistedIps: Array.from(this.blacklist),
		};
	}

	async getFastStatus(): Promise<Record<string, unknown>> {
		let diskSpace = { free: 0, total: 0 };
		try {
			const stats = fs.statfsSync("/root/.ollama");
			const bavail = Number(stats.bavail);
			const bsize = Number(stats.bsize);
			const blocks = Number(stats.blocks);
			diskSpace = {
				free: (bavail * bsize) / 1024 ** 3,
				total: (blocks * bsize) / 1024 ** 3,
			};
		} catch (_e) {
			// Keep fallback values if disk stats are not available.
		}

		let loadedModels = [];
		let ollamaRunning = false;
		try {
			const psResponse = await this.axiosClient.get(`${this.baseUrl}/api/ps`, { timeout: 3000 });
			loadedModels = psResponse.data.models || [];
			ollamaRunning = true;
		} catch {
			ollamaRunning = false;
		}

		const gpu = this.getGpuMetrics();
		return {
			ollamaRunning,
			diskSpace,
			gpu,
			vram: gpu.vram,
			loadedModels,
			engineStats: this.getStats(),
			timestamp: new Date().toISOString(),
		};
	}

	logRequest(ip: string, action: string, status: string) {
		this.totalRequests++;
		const logEntry = {
			ip,
			action,
			status,
			timestamp: new Date().toISOString(),
		};

		this.requestLogs.push(logEntry);
		if (this.requestLogs.length > 200) this.requestLogs.shift();

		if (this.io) {
			this.io.emit("new-access", logEntry);
		}
	}

	isBlacklisted(ip: string): boolean {
		return this.blacklist.has(ip);
	}
	banIp(ip: string) {
		this.blacklist.add(ip);
	}
	unbanIp(ip: string) {
		this.blacklist.delete(ip);
	}

	reportFailedAuth(ip: string) {
		const attempts = (this.failedAttempts.get(ip) || 0) + 1;
		this.failedAttempts.set(ip, attempts);
		if (attempts >= 5) {
			this.banIp(ip);
			console.warn(`IP ${ip} auto-baneada tras 5 intentos fallidos.`);
			if (this.io) {
				this.io.emit("security-alert", {
					type: "ban",
					ip,
					message: `IP ${ip} ha sido bloqueada automaticamente tras 5 intentos fallidos.`,
				});
			}
		} else {
			if (this.io) {
				this.io.emit("security-alert", {
					type: "auth_failed",
					ip,
					message: `Intento de acceso fallido desde ${ip} (${attempts}/5)`,
				});
			}
		}
	}
}
