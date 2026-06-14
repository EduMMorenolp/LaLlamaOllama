import { logger } from "../../utils/logger.js";
import type { AgentOptions, AgentResult } from "../agent/types.js";
import { createRun, updateRun } from "../db/runs.js";
import { enqueueAgentRun, ensureRunQueue } from "../queue/runQueue.js";
import { subscribeRunEvents } from "./runEvents.js";

function serializeOptions(opts: Omit<AgentOptions, "config" | "brain">) {
	return {
		chatId: opts.chatId,
		userText: opts.userText,
		attachments: opts.attachments,
		origin: opts.origin,
		telegramChatId: opts.telegramChatId,
		skipPersistUserMsg: opts.skipPersistUserMsg,
		modeId: opts.modeId,
		preferredModel: opts.preferredModel,
	};
}

export function initOrchestrator(): void {
	ensureRunQueue();
}

export async function submitAgentRun(opts: Omit<AgentOptions, "config" | "brain"> & { runId?: number }): Promise<AgentResult & { runId: number }> {
	const runId = opts.runId ?? createRun({
		chatId: opts.chatId,
		userText: opts.userText,
		origin: opts.origin || "web",
		status: "queued",
		preferredModel: opts.preferredModel,
	});

	const unsubscribe = subscribeRunEvents(runId, {
		onStatus: opts.onStatus,
		onTyping: opts.onTyping,
		onToolCall: opts.onToolCall,
		onToolResult: opts.onToolResult,
		onChunk: opts.onChunk,
	});

	try {
		const result = await enqueueAgentRun({
			runId,
			...serializeOptions(opts),
		});
		// NOTA: updateRun ya lo hace processQueuedRun (status=running, completed)
		// No duplicamos la escritura aquí.
		return { ...result, runId };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logger.error(`[Orchestrator] Run ${runId} failed: ${message}`);
		// processQueuedRun también maneja el caso failed, pero si falla antes
		// de llegar a processQueuedRun (ej: error de queue), actualizamos aquí.
		try {
			const run = await import("../db/runs.js").then(m => m.getRun(runId));
			if (run && (run.status === "queued" || run.status === "running")) {
				updateRun(runId, { status: "failed", errorText: message });
			}
		} catch {
			updateRun(runId, { status: "failed", errorText: message });
		}
		throw err;
	} finally {
		unsubscribe();
	}
}

