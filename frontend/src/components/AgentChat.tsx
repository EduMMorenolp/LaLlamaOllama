import { Bot, Send, StopCircle, Terminal, Wrench } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ChatMessage {
	role: "user" | "assistant" | "tool" | "system";
	content: string;
	timestamp: Date;
}

interface ToolCallInfo {
	toolName: string;
	args: Record<string, unknown>;
	result?: string;
	status: "pending" | "done" | "error";
}

export const AgentChat: React.FC = () => {
	const [messages, setMessages] = useState<ChatMessage[]>([
		{
			role: "system",
			content: "🧠 Agent Engine ready. Send a message to start an autonomous coding session.",
			timestamp: new Date(),
		},
	]);
	const [input, setInput] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
	const [currentToolCalls, setCurrentToolCalls] = useState<ToolCallInfo[]>([]);
	const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
	const wsRef = useRef<WebSocket | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages, currentToolCalls]);

	// Connect WebSocket
	useEffect(() => {
		const engineUrl = import.meta.env.VITE_ENGINE_URL || "http://localhost:3020";
		const wsUrl = engineUrl.replace("http", "ws");

		setConnectionStatus("connecting");

		const ws = new WebSocket(wsUrl);
		wsRef.current = ws;

		ws.onopen = () => {
			setConnectionStatus("connected");
		};

		ws.onclose = () => {
			setConnectionStatus("disconnected");
		};

		ws.onerror = () => {
			setConnectionStatus("disconnected");
		};

		ws.onmessage = (event: MessageEvent) => {
			try {
				const msg = JSON.parse(event.data);
				handleWsMessage(msg);
			} catch {
				// Ignore parse errors
			}
		};

		return () => {
			ws.close();
		};
	}, []);

	const handleWsMessage = (msg: { type: string; payload?: Record<string, unknown> }) => {
		switch (msg.type) {
			case "status":
				if (msg.payload?.status === "connected") {
					setConnectionStatus("connected");
				}
				break;

			case "assistant_chunk": {
				// Streaming chunks are collected and shown progressively
				// For now, we handle complete responses via assistant_done
				break;
			}

			case "tool_call": {
				const toolName = msg.payload?.toolName as string;
				const args = msg.payload?.args as Record<string, unknown>;
				setCurrentToolCalls((prev) => [
					...prev,
					{ toolName, args, status: "pending" },
				]);
				break;
			}

			case "tool_result": {
				const toolName = msg.payload?.toolName as string;
				const result = msg.payload?.result as string;
				setCurrentToolCalls((prev) =>
					prev.map((tc) =>
						tc.toolName === toolName
							? { ...tc, result, status: result.startsWith("Error") ? "error" : "done" }
							: tc
					)
				);
				break;
			}

			case "assistant_done": {
				const text = msg.payload?.text as string;

				setMessages((prev) => [
					...prev,
					{
						role: "assistant",
						content: text,
						timestamp: new Date(),
					},
				]);

				// Clear tool calls
				setCurrentToolCalls([]);
				setIsProcessing(false);
				break;
			}

			case "error": {
				const message = msg.payload?.message as string;
				setMessages((prev) => [
					...prev,
					{
						role: "system",
						content: `❌ Error: ${message}`,
						timestamp: new Date(),
					},
				]);
				setIsProcessing(false);
				break;
			}
		}
	};

	const handleSend = useCallback(() => {
		const text = input.trim();
		if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

		setMessages((prev) => [
			...prev,
			{ role: "user", content: text, timestamp: new Date() },
		]);
		setInput("");
		setIsProcessing(true);
		setCurrentToolCalls([]);

		wsRef.current.send(
			JSON.stringify({
				type: "user_message",
				payload: {
					chatId: "dashboard",
					text,
				},
			})
		);
	}, [input]);

	const handleCancel = () => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(
				JSON.stringify({
					type: "cancel",
					payload: { chatId: "dashboard" },
				})
			);
		}
		setIsProcessing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<div
			className="card-glass"
			style={{
				padding: "0",
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
				height: "calc(100vh - 160px)",
			}}
		>
			{/* Header */}
			<div
				style={{
					padding: "16px 20px",
					borderBottom: "1px solid var(--border-light)",
					display: "flex",
					alignItems: "center",
					gap: "12px",
					justifyContent: "space-between",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
					<div
						style={{
							width: "36px",
							height: "36px",
							borderRadius: "10px",
							background: "linear-gradient(135deg, var(--accent), #7c3aed)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Bot size={20} color="white" />
					</div>
					<div>
						<div style={{ fontWeight: 600, fontSize: "14px" }}>Agent Engine</div>
						<div
							style={{
								fontSize: "11px",
								color: "var(--text-muted)",
								display: "flex",
								alignItems: "center",
								gap: "6px",
							}}
						>
							<span
								style={{
									width: "6px",
									height: "6px",
									borderRadius: "50%",
									background:
										connectionStatus === "connected"
											? "var(--success)"
											: connectionStatus === "connecting"
												? "var(--warning)"
												: "var(--error)",
									display: "inline-block",
								}}
							/>
							{connectionStatus === "connected"
								? "Connected"
								: connectionStatus === "connecting"
									? "Connecting..."
									: "Disconnected"}
						</div>
					</div>
				</div>

				{isProcessing && (
					<button
						type="button"
						onClick={handleCancel}
						style={{
							background: "rgba(239,68,68,0.1)",
							border: "1px solid rgba(239,68,68,0.2)",
							color: "var(--error)",
							padding: "6px 12px",
							borderRadius: "6px",
							cursor: "pointer",
							fontSize: "11px",
							fontWeight: 600,
							display: "flex",
							alignItems: "center",
							gap: "6px",
						}}
					>
						<StopCircle size={14} /> Stop
					</button>
				)}
			</div>

			{/* Messages */}
			<div
				style={{
					flex: 1,
					overflowY: "auto",
					padding: "16px",
					display: "flex",
					flexDirection: "column",
					gap: "12px",
				}}
			>
				{messages.map((msg, i) => (
					<MessageBubble key={i} message={msg} />
				))}

				{/* Tool calls indicator */}
				{currentToolCalls.length > 0 && (
					<div
						style={{
							padding: "12px",
							background: "rgba(79,140,255,0.05)",
							border: "1px solid rgba(79,140,255,0.1)",
							borderRadius: "8px",
						}}
					>
						<div style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)", marginBottom: "8px" }}>
							<Terminal size={12} style={{ marginRight: "6px" }} />
							Tool Calls
						</div>
						{currentToolCalls.map((tc, i) => (
							<div
								key={i}
								style={{
									display: "flex",
									alignItems: "flex-start",
									gap: "8px",
									padding: "6px 0",
									fontSize: "12px",
								}}
							>
								<Wrench size={12} style={{ marginTop: "2px", color: "var(--text-muted)", flexShrink: 0 }} />
								<div style={{ flex: 1 }}>
									<div style={{ fontWeight: 600, color: "var(--text-main)" }}>
										{tc.toolName}
									</div>
									<div style={{ color: "var(--text-dim)", fontSize: "11px" }}>
										{JSON.stringify(tc.args).substring(0, 100)}
									</div>
									{tc.status === "done" && (
										<div style={{ color: "var(--success)", fontSize: "10px", marginTop: "2px" }}>
											✓ Completed
										</div>
									)}
									{tc.status === "error" && (
										<div style={{ color: "var(--error)", fontSize: "10px", marginTop: "2px" }}>
											✗ Failed
										</div>
									)}
									{tc.status === "pending" && (
										<div style={{ color: "var(--warning)", fontSize: "10px", marginTop: "2px" }}>
											⟳ Running...
										</div>
									)}
								</div>
							</div>
						))}
					</div>
				)}

				{/* Streaming indicator */}
				{isProcessing && currentToolCalls.length === 0 && (
					<div
						style={{
							padding: "12px 16px",
							display: "flex",
							alignItems: "center",
							gap: "8px",
							color: "var(--text-muted)",
							fontSize: "13px",
						}}
					>
						<div className="typing-indicator">
							<span /><span /><span />
						</div>
						Thinking...
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* Input */}
			<div
				style={{
					padding: "12px 16px",
					borderTop: "1px solid var(--border-light)",
				}}
			>
				<div
					style={{
						display: "flex",
						gap: "8px",
						alignItems: "flex-end",
					}}
				>
					<textarea
						ref={inputRef}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Ask the coding agent to do something..."
						disabled={isProcessing}
						rows={2}
						style={{
							flex: 1,
							background: "rgba(255,255,255,0.03)",
							border: "1px solid var(--border-light)",
							borderRadius: "8px",
							padding: "10px 14px",
							color: "var(--text-main)",
							fontSize: "13px",
							fontFamily: "inherit",
							resize: "none",
							opacity: isProcessing ? 0.5 : 1,
						}}
					/>
					<button
						type="button"
						onClick={handleSend}
						disabled={isProcessing || !input.trim()}
						style={{
							padding: "10px 16px",
							background: "linear-gradient(135deg, var(--accent), #7c3aed)",
							border: "none",
							borderRadius: "8px",
							color: "white",
							cursor: isProcessing ? "not-allowed" : "pointer",
							opacity: isProcessing || !input.trim() ? 0.5 : 1,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Send size={18} />
					</button>
				</div>
			</div>
		</div>
	);
};

// ─── Message Bubble Component ────────────────────────────────────────

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
	const isUser = message.role === "user";
	const isSystem = message.role === "system";

	if (isSystem) {
		return (
			<div
				style={{
					textAlign: "center",
					padding: "8px 16px",
					fontSize: "12px",
					color: "var(--text-dim)",
				}}
			>
				{message.content}
			</div>
		);
	}

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: isUser ? "flex-end" : "flex-start",
				maxWidth: "80%",
				alignSelf: isUser ? "flex-end" : "flex-start",
			}}
		>
			<div
				style={{
					padding: "10px 14px",
					borderRadius: "12px",
					background: isUser
						? "linear-gradient(135deg, var(--accent), #7c3aed)"
						: "rgba(255,255,255,0.05)",
					border: isUser ? "none" : "1px solid var(--border-light)",
					color: isUser ? "white" : "var(--text-main)",
					fontSize: "13px",
					lineHeight: 1.5,
					whiteSpace: "pre-wrap",
				}}
			>
				{message.content}
			</div>
			<div
				style={{
					fontSize: "10px",
					color: "var(--text-dim)",
					marginTop: "4px",
					padding: "0 4px",
				}}
			>
				{message.timestamp.toLocaleTimeString()}
			</div>
		</div>
	);
};
