import { resetAllSessions } from "../services/agent/runAgentCore.js";
import type { BrainClient } from "../services/brain/client.js";
import { getDueTasks, updateScheduledTask } from "../services/db/scheduled-tasks.js";
import { submitAgentRun } from "../services/orchestrator/index.js";
import { logger } from "../utils/logger.js";

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
