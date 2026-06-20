// @ts-nocheck — BullMQ/ioredis type incompatibilities (pre-existing, needs package upgrade)
import { Queue, QueueEvents, Worker } from "bullmq";
import { Redis } from "ioredis";
import { logger } from "../../utils/logger.js";
import { runAgentCore } from "../agent/runAgentCore.js";
import type { AgentResult } from "../agent/types.js";
import { appendRunEvent, getRun, updateRun } from "../db/runs.js";
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
	modeId?: string;
	preferredModel?: string;
	options?: Record<string, unknown>;
}

const queueName = "agent-engine-runs";

let redisConnection: Redis | null = null;
let runQueue: Queue<QueueAgentRunPayload> | null = null;
let runQueueEvents: QueueEvents | null = null;
let runWorker: Worker<QueueAgentRunPayload> | null = null;
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
	publishRunEvent(runId, type, payload as Parameters<typeof publishRunEvent>[2]);
}

async function broadcastWs(type: string, payload: Record<string, unknown>) {
	try {
		const { getWsServer } = await import("../tools/tool-bridge.js");
		const wsServer = getWsServer();
		if (wsServer) {
			wsServer.sendToAll(type, payload);
		}
	} catch {
		// ignore - WS server may not be available
	}
}

async function processQueuedRun(payload: QueueAgentRunPayload): Promise<AgentResult> {
	const { config, brain } = getRuntimeContext();
	updateRun(payload.runId, { status: "running" });

	const run = getRun(payload.runId);
	const preferredModel = run?.preferred_model || payload.preferredModel;

	// Broadcast task_created for ALL origins (tool, scheduler, etc.)
	// The UI "new_task" handler also broadcasts this, frontend deduplicates by runId
	broadcastWs("task_created", {
		runId: payload.runId,
		chatId: payload.chatId,
		text: payload.userText,
		status: "running",
		origin: payload.origin || "web",
	});
	broadcastWs("task_status", { runId: payload.runId, status: "running" });

	const result = await runAgentCore({
		chatId: payload.chatId,
		userText: payload.userText,
		attachments: payload.attachments,
		config,
		brain,
		origin: payload.origin,
		telegramChatId: payload.telegramChatId,
		skipPersistUserMsg: payload.skipPersistUserMsg,
		modeId: payload.modeId,
		preferredModel,
		options: payload.options,
		onStatus: (text: string) => forwardRunEvent(payload.runId, "status", { text }),
		onTyping: (isTyping: boolean) => forwardRunEvent(payload.runId, "typing", { isTyping }),
		onChunk: (text: string) => forwardRunEvent(payload.runId, "chunk", { text }),
		onToolCall: (toolName: string, args: Record<string, unknown>) =>
			forwardRunEvent(payload.runId, "tool_call", { toolName, args }),
		onToolResult: (toolName: string, resultText: string) =>
			forwardRunEvent(payload.runId, "tool_result", { toolName, result: resultText }),
	});

	const completePayload = {
		runId: payload.runId,
		status: "completed",
		resultText: result.text,
		model: result.model,
		latencyMs: result.latencyMs,
	};

	updateRun(payload.runId, {
		status: "completed",
		model: result.model,
		resultText: result.text,
		latencyMs: result.latencyMs,
	});
	broadcastWs("task_status", completePayload);
	broadcastWs("task_completed", completePayload);
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
		runQueue = new Queue<QueueAgentRunPayload>(queueName, {
			connection: redisConnection,
			defaultJobOptions: {
				removeOnComplete: 50,
				removeOnFail: 50,
			},
		});
		runQueueEvents = new QueueEvents(queueName, { connection: redisConnection });
		runWorker = new Worker<QueueAgentRunPayload>(
			queueName,
			async (job) => processQueuedRun(job.data),
			{
				connection: redisConnection,
				concurrency: 1,
			}
		);

		runWorker.on("failed", (job, err) => {
			if (job?.data && typeof job.data === "object") {
				const payload = job.data as QueueAgentRunPayload;
				const failPayload = { runId: payload.runId, status: "failed" as const, error: err.message };
				broadcastWs("task_status", failPayload);
				broadcastWs("task_failed", failPayload);
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