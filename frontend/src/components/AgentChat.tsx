import { Bot, Plus, Save, Send, Settings, StopCircle, Terminal, Trash2, Users, Wrench, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ──────────────────────────────────────────────────────────

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

interface SubAgent {
	name: string;
	model: string;
	system_prompt: string;
	tools: string[];
	temperature: number;
}

// ─── Main Component ─────────────────────────────────────────────────

type TabType = "chat" | "settings" | "agents";

export const AgentChat: React.FC = () => {
	const [activeTab, setActiveTab] = useState<TabType>("chat");
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

	// ─── Settings state ─────────────────────────────────────────────
	const [model, setModel] = useState("llama3.2:3b");
	const [telegramToken, setTelegramToken] = useState("");
	const [telegramEnabled, setTelegramEnabled] = useState(false);
	const [tools, setTools] = useState<string[]>([]);
	const [toolStates, setToolStates] = useState<Record<string, boolean>>({});

	// ─── Sub-agents state ───────────────────────────────────────────
	const [agents, setAgents] = useState<SubAgent[]>([]);
	const [newAgent, setNewAgent] = useState<SubAgent>({
		name: "", model: "", system_prompt: "", tools: [], temperature: 0.7,
	});
	const [showAgentForm, setShowAgentForm] = useState(false);

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
			// Get initial status
			ws.send(JSON.stringify({ type: "get_status", payload: {} }));
			ws.send(JSON.stringify({ type: "list_tools", payload: {} }));
			ws.send(JSON.stringify({ type: "list_experts", payload: {} }));
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
				if (msg.payload?.model) {
					setModel(msg.payload.model as string);
				}
				if (msg.payload?.telegramActive !== undefined) {
					setTelegramEnabled(msg.payload.telegramActive as boolean);
				}
				break;

			case "tools_list": {
				const toolList = msg.payload?.tools as Array<{ function: { name: string } }> | string[];
				if (Array.isArray(toolList)) {
					if (typeof toolList[0] === "string") {
						setTools(toolList as string[]);
						const states: Record<string, boolean> = {};
						for (const t of toolList as string[]) states[t] = true;
						setToolStates(states);
					} else {
						const names = (toolList as Array<{ function: { name: string } }>).map((t) => t.function.name);
						setTools(names);
						const states: Record<string, boolean> = {};
						for (const t of names) states[t] = true;
						setToolStates(states);
					}
				}
				break;
			}

			case "list_experts": {
				const experts = msg.payload?.experts as SubAgent[];
				if (experts) setAgents(experts);
				break;
			}

			case "assistant_chunk":
				break;

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
				const tName = msg.payload?.toolName as string;
				const result = msg.payload?.result as string;
				setCurrentToolCalls((prev) =>
					prev.map((tc) =>
						tc.toolName === tName
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
					{ role: "assistant", content: text, timestamp: new Date() },
				]);
				setCurrentToolCalls([]);
				setIsProcessing(false);
				break;
			}

			case "error": {
				const message = msg.payload?.message as string;
				setMessages((prev) => [
					...prev,
					{ role: "system", content: `❌ Error: ${message}`, timestamp: new Date() },
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
				payload: { chatId: "dashboard", text },
			})
		);
	}, [input]);

	const handleCancel = () => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(
				JSON.stringify({ type: "cancel", payload: { chatId: "dashboard" } })
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

	// ─── Settings handlers ──────────────────────────────────────────
	const handleTelegramSave = () => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(
				JSON.stringify({
					type: "telegram_update",
					payload: { botToken: telegramToken, enabled: telegramEnabled },
				})
			);
		}
	};

	const handleToolToggle = (toolName: string, enabled: boolean) => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(
				JSON.stringify({
					type: "toggle_tool",
					payload: { name: toolName, enabled },
				})
			);
		}
		setToolStates((prev) => ({ ...prev, [toolName]: enabled }));
	};

	// ─── Agent handlers ─────────────────────────────────────────────
	const handleCreateAgent = () => {
		if (!newAgent.name.trim()) return;
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(
				JSON.stringify({
					type: "expert_update",
					payload: {
						action: "upsert",
						expert: {
							name: newAgent.name.trim(),
							model: newAgent.model || model,
							system_prompt: newAgent.system_prompt,
							tools: newAgent.tools,
							temperature: newAgent.temperature,
							experts: [],
						},
					},
				})
			);
		}
		setNewAgent({ name: "", model: "", system_prompt: "", tools: [], temperature: 0.7 });
		setShowAgentForm(false);
	};

	const handleDeleteAgent = (name: string) => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(
				JSON.stringify({
					type: "expert_update",
					payload: { action: "delete", name },
				})
			);
		}
	};

	// ─── Tabs ───────────────────────────────────────────────────────
	const tabs: Array<{ id: TabType; label: string; icon: typeof Bot }> = [
		{ id: "chat", label: "Chat", icon: Bot },
		{ id: "settings", label: "Settings", icon: Settings },
		{ id: "agents", label: "Sub-Agents", icon: Users },
	];

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
					flexWrap: "wrap",
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
							{model && <span style={{ opacity: 0.6 }}>· {model}</span>}
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

			{/* Tab Navigation */}
			<div
				style={{
					display: "flex",
					borderBottom: "1px solid var(--border-light)",
					padding: "0 16px",
					gap: "4px",
				}}
			>
				{tabs.map((tab) => {
					const Icon = tab.icon;
					return (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							style={{
								padding: "10px 16px",
								background: "none",
								border: "none",
								borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
								color: activeTab === tab.id ? "var(--accent)" : "var(--text-muted)",
								cursor: "pointer",
								fontSize: "12px",
								fontWeight: activeTab === tab.id ? 600 : 400,
								display: "flex",
								alignItems: "center",
								gap: "6px",
								transition: "all 0.2s",
							}}
						>
							<Icon size={14} />
							{tab.label}
						</button>
					);
				})}
			</div>

			{/* Tab Content */}
			<div style={{ flex: 1, overflow: "auto" }}>
				{activeTab === "chat" && renderChat()}
				{activeTab === "settings" && renderSettings()}
				{activeTab === "agents" && renderAgents()}
			</div>
		</div>
	);

	// ─── Chat Tab ───────────────────────────────────────────────────
	function renderChat() {
		return (
			<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
											{tc.args ? JSON.stringify(tc.args).substring(0, 100) : ""}
										</div>
										{tc.status === "done" && (
											<div style={{ color: "var(--success)", fontSize: "10px", marginTop: "2px" }}>✓ Completed</div>
										)}
										{tc.status === "error" && (
											<div style={{ color: "var(--error)", fontSize: "10px", marginTop: "2px" }}>✗ Failed</div>
										)}
										{tc.status === "pending" && (
											<div style={{ color: "var(--warning)", fontSize: "10px", marginTop: "2px" }}>⟳ Running...</div>
										)}
									</div>
								</div>
							))}
						</div>
					)}

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

				<div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-light)" }}>
					<div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
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
	}

	// ─── Settings Tab ───────────────────────────────────────────────
	function renderSettings() {
		return (
			<div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
				<h3 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: 600, color: "var(--text-main)" }}>
					<Settings size={16} style={{ marginRight: "8px" }} />
					Agent Settings
				</h3>

				{/* Model selector */}
				<div className="setting-card" style={{ marginBottom: "16px", padding: "16px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)" }}>
					<label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>
						Default Model
					</label>
					<input
						type="text"
						value={model}
						onChange={(e) => setModel(e.target.value)}
						style={{
							width: "100%",
							padding: "10px 14px",
							background: "rgba(255,255,255,0.03)",
							border: "1px solid var(--border-light)",
							borderRadius: "8px",
							color: "var(--text-main)",
							fontSize: "13px",
							fontFamily: "monospace",
						}}
						placeholder="llama3.2:3b"
					/>
					<div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "6px" }}>
						Model for agent reasoning (e.g. llama3.2:3b, gpt-4, openrouter/...)
					</div>
				</div>

				{/* Telegram */}
				<div className="setting-card" style={{ marginBottom: "16px", padding: "16px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)" }}>
					<label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>
						Telegram Bot Token
					</label>
					<div style={{ display: "flex", gap: "8px" }}>
						<input
							type="password"
							value={telegramToken}
							onChange={(e) => setTelegramToken(e.target.value)}
							style={{
								flex: 1,
								padding: "10px 14px",
								background: "rgba(255,255,255,0.03)",
								border: "1px solid var(--border-light)",
								borderRadius: "8px",
								color: "var(--text-main)",
								fontSize: "13px",
								fontFamily: "monospace",
							}}
							placeholder="123456:ABC-DEF..."
						/>
						<button
							type="button"
							onClick={handleTelegramSave}
							style={{
								padding: "10px 16px",
								background: "rgba(79,140,255,0.1)",
								border: "1px solid rgba(79,140,255,0.2)",
								borderRadius: "8px",
								color: "var(--accent)",
								cursor: "pointer",
								fontSize: "11px",
								fontWeight: 600,
							}}
						>
							<Save size={14} style={{ marginRight: "4px" }} />
							Save
						</button>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
						<span
							style={{
								width: "8px",
								height: "8px",
								borderRadius: "50%",
								background: telegramEnabled ? "var(--success)" : "var(--error)",
								display: "inline-block",
							}}
						/>
						<span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
							{telegramEnabled ? "Bot active" : "Bot inactive"}
						</span>
					</div>
				</div>

				{/* Tool Toggles */}
				<div className="setting-card" style={{ padding: "16px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)" }}>
					<label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "12px" }}>
						Tools ({tools.length})
					</label>
					<div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
						{tools.map((tool) => (
							<button
								key={tool}
								type="button"
								onClick={() => handleToolToggle(tool, !toolStates[tool])}
								style={{
									padding: "6px 12px",
									borderRadius: "6px",
									border: "1px solid var(--border-light)",
									background: toolStates[tool] ? "rgba(79,140,255,0.1)" : "rgba(255,255,255,0.02)",
									color: toolStates[tool] ? "var(--accent)" : "var(--text-muted)",
									cursor: "pointer",
									fontSize: "11px",
									fontWeight: 600,
									transition: "all 0.2s",
								}}
							>
								{tool}
							</button>
						))}
					</div>
				</div>
			</div>
		);
	}

	// ─── Sub-Agents Tab ─────────────────────────────────────────────
	function renderAgents() {
		return (
			<div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
					<h3 style={{ margin: "0", fontSize: "16px", fontWeight: 600, color: "var(--text-main)" }}>
						<Users size={16} style={{ marginRight: "8px" }} />
						Sub-Agents ({agents.length})
					</h3>
					<button
						type="button"
						onClick={() => setShowAgentForm(!showAgentForm)}
						style={{
							padding: "8px 14px",
							background: "rgba(79,140,255,0.1)",
							border: "1px solid rgba(79,140,255,0.2)",
							borderRadius: "8px",
							color: "var(--accent)",
							cursor: "pointer",
							fontSize: "11px",
							fontWeight: 600,
							display: "flex",
							alignItems: "center",
							gap: "6px",
						}}
					>
						{showAgentForm ? <X size={14} /> : <Plus size={14} />}
						{showAgentForm ? "Cancel" : "New Agent"}
					</button>
				</div>

				{/* New Agent Form */}
				{showAgentForm && (
					<div
						style={{
							padding: "16px",
							marginBottom: "16px",
							borderRadius: "8px",
							background: "rgba(79,140,255,0.05)",
							border: "1px solid rgba(79,140,255,0.15)",
						}}
					>
						<div style={{ marginBottom: "12px" }}>
							<label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Name</label>
							<input
								type="text"
								value={newAgent.name}
								onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
								style={inputStyle}
								placeholder="my-expert-agent"
							/>
						</div>
						<div style={{ marginBottom: "12px" }}>
							<label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Model</label>
							<input
								type="text"
								value={newAgent.model}
								onChange={(e) => setNewAgent({ ...newAgent, model: e.target.value })}
								style={inputStyle}
								placeholder={model}
							/>
						</div>
						<div style={{ marginBottom: "12px" }}>
							<label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>System Prompt</label>
							<textarea
								value={newAgent.system_prompt}
								onChange={(e) => setNewAgent({ ...newAgent, system_prompt: e.target.value })}
								rows={4}
								style={{ ...inputStyle, resize: "vertical" }}
								placeholder="You are an expert agent specialized in..."
							/>
						</div>
						<button
							type="button"
							onClick={handleCreateAgent}
							style={{
								padding: "10px 20px",
								background: "linear-gradient(135deg, var(--accent), #7c3aed)",
								border: "none",
								borderRadius: "8px",
								color: "white",
								cursor: "pointer",
								fontSize: "12px",
								fontWeight: 600,
							}}
						>
							<Save size={14} style={{ marginRight: "6px" }} />
							Create Agent
						</button>
					</div>
				)}

				{/* Agent List */}
				{agents.length === 0 && !showAgentForm && (
					<div style={{ textAlign: "center", padding: "40px", color: "var(--text-dim)", fontSize: "13px" }}>
						No sub-agents configured yet. Create one to delegate specialized tasks.
					</div>
				)}

				{agents.map((agent) => (
					<div
						key={agent.name}
						style={{
							padding: "14px 16px",
							marginBottom: "8px",
							borderRadius: "8px",
							background: "rgba(255,255,255,0.02)",
							border: "1px solid var(--border-light)",
						}}
					>
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
							<div>
								<div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-main)" }}>
									@{agent.name}
								</div>
								<div style={{ fontSize: "11px", color: "var(--accent)", fontFamily: "monospace", marginTop: "2px" }}>
									{agent.model || "(default model)"}
								</div>
								<div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "6px", maxHeight: "40px", overflow: "hidden" }}>
									{agent.system_prompt.substring(0, 150)}
									{agent.system_prompt.length > 150 ? "..." : ""}
								</div>
								{agent.tools.length > 0 && (
									<div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
										{agent.tools.map((t) => (
											<span key={t} style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(79,140,255,0.1)", color: "var(--accent)" }}>
												{t}
											</span>
										))}
									</div>
								)}
							</div>
							<button
								type="button"
								onClick={() => handleDeleteAgent(agent.name)}
								style={{
									padding: "6px",
									background: "none",
									border: "none",
									color: "var(--error)",
									cursor: "pointer",
									opacity: 0.6,
								}}
								title="Delete agent"
							>
								<Trash2 size={14} />
							</button>
						</div>
					</div>
				))}
			</div>
		);
	}
};

// ─── Shared styles ─────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
	width: "100%",
	padding: "10px 14px",
	background: "rgba(255,255,255,0.03)",
	border: "1px solid var(--border-light)",
	borderRadius: "8px",
	color: "var(--text-main)",
	fontSize: "13px",
	fontFamily: "inherit",
	boxSizing: "border-box",
};

// ─── Message Bubble Component ───────────────────────────────────────

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
