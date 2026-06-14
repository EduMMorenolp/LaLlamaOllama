import { resetAllSessions } from "../services/agent/runAgentCore.js";
import type { BrainClient } from "../services/brain/client.js";
import { getDueTasks, updateScheduledTask } from "../services/db/scheduled-tasks.js";
import { submitAgentRun } from "../services/orchestrator/index.js";
import { logger } from "../utils/logger.js";
import { getDb } from "../services/db/connection.js";
import { getWsServer } from "../services/tools/tool-bridge.js";
import type { StoredRun } from "../services/db/runs.js";
import { createRun } from "../services/db/runs.js";

// Simple cron matching function (no external dependency needed for basic support)
function matchCron(cronExpr: string, date: Date = new Date()): boolean {
	const parts = cronExpr.trim().split(/\s+/);
	if (parts.length !== 5) {
		logger.warn("[Cron] Invalid cron expression: " + cronExpr + " (need 5 parts, got " + parts.length + ")");
		return false;
	}
	const [min, hour, dayMonth, month, dayWeek] = parts;
	const now = {
		minute: date.getMinutes(),
		hour: date.getHours(),
		dayMonth: date.getDate(),
		month: date.getMonth() + 1,
		dayWeek: date.getDay(), // 0=Sun
	};

	const matchField = (pattern: string, value: number): boolean => {
		if (pattern === "*") return true;
		if (pattern.includes("/")) {
			const [, step] = pattern.split("/");
			return value % parseInt(step, 10) === 0;
		}
		if (pattern.includes(",")) {
			return pattern.split(",").map(Number).includes(value);
		}
		if (pattern.includes("-")) {
			const [lo, hi] = pattern.split("-").map(Number);
			return value >= lo && value <= hi;
		}
		return parseInt(pattern, 10) === value;
	};

	return (
		matchField(min, now.minute) &&
		matchField(hour, now.hour) &&
		matchField(dayMonth, now.dayMonth) &&
		matchField(month, now.month) &&
		matchField(dayWeek, now.dayWeek)
	);
}

// Calculate next run time from cron expression
function getNextRun(cronExpr: string): string | null {
	const now = new Date();
	// Check every minute for the next 24 hours
	for (let i = 1; i <= 1440; i++) {
		const future = new Date(now.getTime() + i * 60000);
		if (matchCron(cronExpr, future)) {
			return future.toISOString();
		}
	}
	return null;
}

export function startCronJobs(brain: BrainClient) {
	// Task scheduler every 60 seconds
	setInterval(
		async () => {
			try {
				// 1. Check recurring scheduled tasks (from scheduled_tasks table)
				const dueTasks = getDueTasks();
				for (const task of dueTasks) {
					if (!matchCron(task.cron_expression)) continue;
					logger.info("[Cron] Executing scheduled task: \"" + task.name + "\" (ID: " + task.id + ")");
					try {
						await submitAgentRun({
							chatId: "scheduler",
							userText: task.task_text,
							origin: "scheduler",
							modeId: task.mode_id || undefined,
						});
						updateScheduledTask(task.id, {
							last_run_at: new Date().toISOString(),
							next_run_at: getNextRun(task.cron_expression),
						} as any);
						logger.info("[Cron] Scheduled task \"" + task.name + "\" completed");
					} catch (err) {
						logger.error("[Cron] Scheduled task \"" + task.name + "\" failed: " + err);
					}
				}

				// 2. Check one-time scheduled runs (from runs table)
				const db = getDb();
				const nowIso = new Date().toISOString();
				const scheduledRuns = db
					.prepare("SELECT * FROM runs WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?")
					.all(nowIso) as StoredRun[];

				for (const run of scheduledRuns) {
					if (run.is_recurring && run.cron_expression) {
						// ─── RECURRING: create new run, update next scheduled_at ─────────
						logger.info(`[Cron] Recurring run ID ${run.id} triggered (cron: ${run.cron_expression})`);
						try {
							// Calculate next execution time
							const nextRun = getNextRun(run.cron_expression);

							// Update the template run with next scheduled_at
							db.prepare(
								"UPDATE runs SET scheduled_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
							).run(nextRun, run.id);

							// Create a new queued run for this execution
							const newRunId = createRun({
								chatId: run.chatId,
								userText: run.userText,
								origin: run.origin || "scheduler",
								status: "queued",
								priority: run.priority,
								preferredModel: run.preferred_model || undefined,
								tags: run.tags || undefined,
								dueDate: run.due_date || undefined,
								description: run.description || undefined,
							});

							const wsServer = getWsServer();
							if (wsServer) {
								wsServer.sendToAll("task_created", {
									runId: newRunId,
									chatId: run.chatId,
									text: run.userText,
									status: "queued",
									origin: run.origin || "scheduler",
								});
								// Also notify update of the template run with new scheduled_at
								wsServer.sendToAll("task_updated", {
									runId: run.id,
									run: { ...run, scheduled_at: nextRun },
								});
							}

							submitAgentRun({
								chatId: run.chatId,
								userText: run.userText,
								origin: run.origin || "scheduler",
								runId: newRunId,
								preferredModel: run.preferred_model || undefined,
							}).catch((err: unknown) => {
								logger.error(
									"[Cron] Recurring run execution failed: " + (err instanceof Error ? err.message : String(err))
								);
							});

							logger.info(`[Cron] Recurring run ${run.id} → new run #${newRunId}, next at: ${nextRun}`);
						} catch (err) {
							logger.error(`[Cron] Recurring run ${run.id} failed: ` + (err instanceof Error ? err.message : String(err)));
						}
					} else {
						// ─── ONE-TIME: original behaviour ─────────────────────────────
						logger.info("[Cron] Executing scheduled run ID: " + run.id + " (Scheduled at: " + run.scheduled_at + ")");
						try {
							db.prepare("UPDATE runs SET status = 'queued', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(run.id);

							const wsServer = getWsServer();
							if (wsServer) {
								wsServer.sendToAll("task_status", {
									runId: run.id,
									chatId: run.chatId,
									status: "queued",
									text: run.userText,
								});
							}

							submitAgentRun({
								chatId: run.chatId,
								userText: run.userText,
								origin: run.origin || "web",
								runId: run.id,
								preferredModel: run.preferred_model || undefined,
							}).catch((err: unknown) => {
								logger.error(
									"[Cron] Scheduled task execution failed: " + (err instanceof Error ? err.message : String(err))
								);
							});
						} catch (err) {
							logger.error("[Cron] Failed to process scheduled run ID " + run.id + ": " + err);
						}
					}
				}
			} catch (err) {
				logger.warn("[Cron] Task scheduler error: " + err);
			}
		},
		60 * 1000 // every 60 seconds
	);

	// Session cleanup every 30 minutes
	setInterval(
		async () => {
			logger.debug("[Cron] Running periodic cleanup...");
			try {
				resetAllSessions();
			} catch (err) {
				logger.warn("[Cron] Session cleanup failed: " + err);
			}
		},
		30 * 60 * 1000
	);

	logger.info("[Cron] Background jobs started (task scheduler every 60s, cleanup every 30min)");
}
