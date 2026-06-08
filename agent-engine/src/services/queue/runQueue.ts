import { Queue, QueueEvents, Worker } from "bullmq";
import { Redis } from "ioredis";
import { logger } from "../../utils/logger.js";
import { runAgentCore } from "../agent/runAgentCore.js";
import type { AgentResult } from "../agent/types.js";
import { appendRunEvent, updateRun } from "../db/runs.js";
import { publishRunEvent } from "../orchestrator/runEvents.js";
import { getRuntimeContext, hasRuntimeContext } from "../runtime.js";

export interface QueueAgentRunPayload {
	runId: number;
	chatId: string;
	userText: string;
	attachments?: Array<{ name: string; type: string; data: string }>;
	origin?: string;
	telegramChatId?: number;
	skipPersistUserMsg?: boolean;
}

const queueName = "agent-engine-runs";

let redisConnection: Redis | null = null;
let runQueue: Queue | null = null;
let runQueueEvents: QueueEvents | null = null;
let runWorker: Worker | null = null;
let queueReady = false;

function createConnection(): Redis {
	const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
	return new Redis(redisUrl, { maxRetriesPerRequest: null });
}

function forwardRunEvent(
	runId: number,
	type: "status" | "typing" | "tool_call" | "tool_result" | "chunk" | "error",
	payload: Record<string, unknown>
): void {
	appendRunEvent({ runId, type, payload: JSON.stringify(payload) });
	publishRunEvent(runId, type, payload as never);
}

async function broadcastTaskStatus(runId: number, status: string, extra: Record<string, unknown> = {}) {
	try {
		const { getWsServer } = await import("../tools/tool-bridge.js");
		const wsServer = getWsServer();
		if (wsServer) {
			wsServer.sendToAll("task_status" as any, { runId, status, ...extra });
		}
	} catch {
		// ignore - WS server may not be available
	}
}

async function processQueuedRun(payload: QueueAgentRunPayload): Promise<AgentResult> {
	const { config, brain } = getRuntimeContext();
	updateRun(payload.runId, { status: "running" });
	broadcastTaskStatus(payload.runId, "running");

	const result = await runAgentCore({
		chatId: payload.chatId,
		userText: payload.userText,
		attachments: payload.attachments,
		config,
		brain,
		origin: payload.origin,
		telegramChatId: payload.telegramChatId,
		skipPersistUserMsg: payload.skipPersistUserMsg,
		onStatus: (text: string) => forwardRunEvent(payload.runId, "status", { text }),
		onTyping: (isTyping: boolean) => forwardRunEvent(payload.runId, "typing", { isTyping }),
		onChunk: (text: string) => forwardRunEvent(payload.runId, "chunk", { text }),
		onToolCall: (toolName: string, args: Record<string, unknown>) =>
			forwardRunEvent(payload.runId, "tool_call", { toolName, args }),
		onToolResult: (toolName: string, resultText: string) =>
			forwardRunEvent(payload.runId, "tool_result", { toolName, result: resultText }),
	});

	updateRun(payload.runId, {
		status: "completed",
		model: result.model,
		resultText: result.text,
		latencyMs: result.latencyMs,
	});
	broadcastTaskStatus(payload.runId, "completed");
	forwardRunEvent(payload.runId, "status", { text: "Run completado" });
	return result;
}

export function ensureRunQueue(): boolean {
	if (queueReady) {
		return true;
	}

	if (!hasRuntimeContext()) {
		logger.warn("[Queue] Runtime context not ready yet; queue will start lazily");
		return false;
	}

	try {
		redisConnection = createConnection();
		runQueue = new Queue(queueName, {
			connection: redisConnection as any,
			defaultJobOptions: {
				removeOnComplete: 50,
				removeOnFail: 50,
			},
		});
		runQueueEvents = new QueueEvents(queueName, { connection: redisConnection as any });
		runWorker = new Worker(queueName, async (job) => processQueuedRun(job.data as QueueAgentRunPayload), {
			connection: redisConnection as any,
			concurrency: 1,
		});

		runWorker.on("failed", (job, err) => {
			if (job?.data && typeof job.data === "object") {
				const payload = job.data as QueueAgentRunPayload;
				broadcastTaskStatus(payload.runId, "failed", { error: err.message });
				updateRun(payload.runId, { status: "failed", errorText: err.message });
				forwardRunEvent(payload.runId, "error", { message: err.message });
			}
			logger.error(`[Queue] Worker job failed: ${err.message}`);
		});

		queueReady = true;
		logger.info(`[Queue] BullMQ queue ready (${queueName})`);
		return true;
	} catch (err) {
		queueReady = false;
		logger.warn(
			`[Queue] BullMQ unavailable, falling back to inline execution: ${err instanceof Error ? err.message : String(err)}`
		);
		return false;
	}
}

export async function enqueueAgentRun(payload: QueueAgentRunPayload): Promise<AgentResult> {
	const ready = ensureRunQueue();
	if (!ready || !runQueue || !runQueueEvents) {
		logger.warn(`[Queue] Executing run ${payload.runId} inline`);
		return processQueuedRun(payload);
	}

	const job = await runQueue.add("agent-run", payload, {
		jobId: `run-${payload.runId}`,
	});

	const result = await job.waitUntilFinished(runQueueEvents);
	return result as AgentResult;
}

export function shutdownRunQueue(): void {
	void runWorker?.close();
	void runQueueEvents?.close();
	void runQueue?.close();
	void redisConnection?.quit();
	runWorker = null;
	runQueueEvents = null;
	runQueue = null;
	redisConnection = null;
	queueReady = false;
}
