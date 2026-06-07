import { EventEmitter } from "node:events";
import type { AgentResult } from "../agent/types.js";

export type RunEventName = "status" | "typing" | "tool_call" | "tool_result" | "chunk" | "complete" | "error";

export interface RunEventPayloadMap {
	status: { text: string };
	typing: { isTyping: boolean };
	tool_call: { toolName: string; args: Record<string, unknown> };
	tool_result: { toolName: string; result: string };
	chunk: { text: string };
	complete: { result: AgentResult };
	error: { message: string };
}

const runEvents = new EventEmitter();
runEvents.setMaxListeners(0);

export function publishRunEvent<T extends RunEventName>(runId: number, event: T, payload: RunEventPayloadMap[T]): void {
	runEvents.emit(`${runId}:${event}`, payload);
}

export function subscribeRunEvents(
	runId: number,
	handlers: {
		onStatus?: (text: string) => void;
		onTyping?: (isTyping: boolean) => void;
		onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
		onToolResult?: (toolName: string, result: string) => void;
		onChunk?: (text: string) => void;
		onComplete?: (result: AgentResult) => void;
		onError?: (message: string) => void;
	}
): () => void {
	const listeners: Array<{ event: string; handler: (...args: any[]) => void }> = [];

	const bind = <T extends RunEventName>(event: T, handler?: (payload: RunEventPayloadMap[T]) => void) => {
		if (!handler) return;
		const eventName = `${runId}:${event}`;
		const wrapped = (payload: RunEventPayloadMap[T]) => handler(payload);
		runEvents.on(eventName, wrapped);
		listeners.push({ event: eventName, handler: wrapped });
	};

	bind("status", (payload) => handlers.onStatus?.(payload.text));
	bind("typing", (payload) => handlers.onTyping?.(payload.isTyping));
	bind("tool_call", (payload) => handlers.onToolCall?.(payload.toolName, payload.args));
	bind("tool_result", (payload) => handlers.onToolResult?.(payload.toolName, payload.result));
	bind("chunk", (payload) => handlers.onChunk?.(payload.text));
	bind("complete", (payload) => handlers.onComplete?.(payload.result));
	bind("error", (payload) => handlers.onError?.(payload.message));

	return () => {
		for (const listener of listeners) {
			runEvents.off(listener.event, listener.handler);
		}
	};
}
