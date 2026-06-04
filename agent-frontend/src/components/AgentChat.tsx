import { ChevronLeft, ChevronRight, Edit3, MessageSquare, Paperclip, Pin, PinOff, Plus, Save, Search, Send, StopCircle, Terminal, Trash2, Wrench, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { config } from "../config";

// ─── Types ──────────────────────────────────────────────────────────

interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

interface ChatMessage {
	role: "user" | "assistant" | "tool" | "system";
	content: string;
	timestamp: Date;
	usage?: TokenUsage;
}

interface ToolCallInfo {
	toolName: string;
	args: Record<string, unknown>;
	result?: string;
	status: "pending" | "done" | "error";
}

interface ChatEntry {
	id: string;
	userId: string;
	title: string;
	origin: string;
	expertName: string | null;
	pinned: number;
	created_at: string;
	updated_at: string;
	lastMessage?: string;
}

// ─── Main Component ─────────────────────────────────────────────────

export const AgentChat: React.FC = () => {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
	const [currentToolCalls, setCurrentToolCalls] = useState<ToolCallInfo[]>([]);
	const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
	const wsRef = useRef<WebSocket | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	// ─── Chat management ───────────────────────────────────────────
	const [chats, setChats] = useState<ChatEntry[]>([]);
	const [currentChatId, setCurrentChatId] = useState<string | null>(null);
	const [chatSidebarOpen, setChatSidebarOpen] = useState(true);
	const [chatSearch, setChatSearch] = useState("");
	const [renamingChat, setRenamingChat] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [model, setModel] = useState("");
	const [totalPromptTokens, setTotalPromptTokens] = useState(0);
	const [totalCompletionTokens, setTotalCompletionTokens] = useState(0);
	const userId = "web-user";
	const [attachments, setAttachments] = useState<Array<{ name: string; type: string; data: string }>>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages, currentToolCalls]);

	const sendWs = useCallback((type: string, payload?: Record<string, unknown>) => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify({ type, payload: payload || {} }));
		}
	}, []);

	// Connect WebSocket
	useEffect(() => {
		setConnectionStatus("connecting");

		const ws = new WebSocket(config.wsUrl);
		wsRef.current = ws;

		ws.onopen = () => {
			setConnectionStatus("connected");
			sendWs("identify", { userId });
		};

		ws.onclose = () => setConnectionStatus("disconnected");
		ws.onerror = () => setConnectionStatus("disconnected");

		ws.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data);
				handleWsMessage(msg);
			} catch { /* ignore */ }
		};

		return () => ws.close();
	}, []);

	const handleWsMessage = (msg: { type: string; payload?: Record<string, unknown> }) => {
		switch (msg.type) {
			case "status":
				if (msg.payload?.status === "identified") {
					setModel((msg.payload?.model as string) || "");
				}
				if (msg.payload?.status === "running") {
					setModel((msg.payload?.model as string) || model);
				}
				break;

			case "list_chats": {
				const chatList = msg.payload?.chats as ChatEntry[];
				const activeChatId = msg.payload?.activeChatId as string | undefined;
				if (chatList) {
					setChats(chatList);
					if (activeChatId) {
						setCurrentChatId(activeChatId);
					} else if (!currentChatId && chatList.length > 0) {
						const first = chatList[0];
						setCurrentChatId(first.id);
					}
				}
				break;
			}

			case "assistant_done": {
				const chatId = msg.payload?.chatId as string;
				const usage = msg.payload?.usage as TokenUsage | undefined;

				if (usage) {
					setTotalPromptTokens((p) => p + usage.promptTokens);
					setTotalCompletionTokens((p) => p + usage.completionTokens);
				}

				if (msg.payload?.history) {
					const history = msg.payload?.history as Array<{ role: string; text: string }>;
					setMessages(history.map((h) => ({
						role: h.role as ChatMessage["role"],
						content: h.text,
						timestamp: new Date(),
					})));
					return;
				}

				const text = msg.payload?.text as string;
				if (chatId === currentChatId || !currentChatId) {
					setMessages((prev) => [
						...prev,
						{ role: "assistant", content: text, timestamp: new Date(), usage },
					]);
				}
				setCurrentToolCalls([]);
				setIsProcessing(false);
				break;
			}

			case "tool_call": {
				setCurrentToolCalls((prev) => [
					...prev,
					{
						toolName: msg.payload?.toolName as string,
						args: msg.payload?.args as Record<string, unknown>,
						status: "pending",
					},
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

			case "error": {
				setMessages((prev) => [
					...prev,
					{ role: "system", content: `❌ Error: ${msg.payload?.message as string}`, timestamp: new Date() },
				]);
				setIsProcessing(false);
				break;
			}
		}
	};

	const handleSend = useCallback(() => {
		const text = input.trim();
		if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

		const chatId = currentChatId || "dashboard";
		const promptEstimate = Math.ceil(text.length / 4);
		setMessages((prev) => [...prev, { role: "user", content: text, timestamp: new Date(), usage: { promptTokens: promptEstimate, completionTokens: 0, totalTokens: promptEstimate } }]);
		setTotalPromptTokens((p) => p + promptEstimate);
		setInput("");
		setIsProcessing(true);
		setCurrentToolCalls([]);

		const payload: Record<string, unknown> = { chatId, text };
		if (attachments.length > 0) {
			payload.attachments = attachments;
		}
		sendWs("user_message", payload);
		setAttachments([]);  // Clear attachments after sending
	}, [input, currentChatId, sendWs, attachments]);

	const handleCancel = () => {
		sendWs("cancel", { chatId: currentChatId || "dashboard" });
		setIsProcessing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	// ─── Chat CRUD ─────────────────────────────────────────────────
	const handleNewChat = () => sendWs("chat_update", { action: "create", title: "Nuevo chat" });

	const handleSwitchChat = (chatId: string) => {
		if (chatId === currentChatId) return;
		setCurrentChatId(chatId);
		setMessages([]);
		sendWs("switch_chat", { chatId });
	};

	const handleRenameChat = (chatId: string) => {
		if (renameValue.trim()) {
			sendWs("chat_update", { action: "rename", chatId, title: renameValue.trim() });
		}
		setRenamingChat(null);
		setRenameValue("");
	};

	const handleDeleteChat = (chatId: string) => {
		sendWs("chat_update", { action: "delete", chatId });
		if (currentChatId === chatId) {
			setCurrentChatId(null);
			setMessages([]);
		}
	};

	const handlePinChat = (chatId: string) => sendWs("chat_update", { action: "pin", chatId });

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files) return;
		
		const newAttachments: Array<{ name: string; type: string; data: string }> = [];
		let loaded = 0;
		
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const reader = new FileReader();
			reader.onload = (ev) => {
				const data = ev.target?.result as string;
				newAttachments.push({ name: file.name, type: file.type, data });
				loaded++;
				if (loaded === files.length) {
					setAttachments((prev) => [...prev, ...newAttachments]);
				}
			};
			reader.readAsDataURL(file);
		}
		
		// Reset input so same file can be selected again
		e.target.value = "";
	};

	const removeAttachment = (index: number) => {
		setAttachments((prev) => prev.filter((_, i) => i !== index));
	};

	const currentChat = chats.find((c) => c.id === currentChatId);

	const filteredChats = chats.filter((c) =>
		c.title.toLowerCase().includes(chatSearch.toLowerCase())
	);
	const pinnedChats = filteredChats.filter((c) => c.pinned);
	const recentChats = filteredChats.filter((c) => !c.pinned);

	return (
		<div className="card-glass" style={{
			padding: "0",
			overflow: "hidden",
			display: "flex",
			flexDirection: "column",
			height: "100%",
		}}>
			{/* Compact bar: status + model + chat title + stop + sidebar toggle */}
			<div style={{
				display: "flex",
				alignItems: "center",
				gap: "10px",
				padding: "8px 16px",
				borderBottom: "1px solid var(--border-light)",
				flexShrink: 0,
			}}>
				<span style={{
					width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0,
					background: connectionStatus === "connected" ? "var(--success)"
						: connectionStatus === "connecting" ? "var(--warning)" : "var(--error)",
				}} />
				<span style={{ fontSize: "11px", color: "var(--text-dim)", fontWeight: 500 }}>
					{connectionStatus === "connected" ? "Connected" : connectionStatus === "connecting" ? "Connecting..." : "Disconnected"}
				</span>
				{model && (
					<span style={{ fontSize: "11px", color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
						· {model}
					</span>
				)}
				{(totalPromptTokens > 0 || totalCompletionTokens > 0) && (
					<span style={{ fontSize: "10px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
						Σ {totalPromptTokens + totalCompletionTokens}
					</span>
				)}
				<span style={{ flex: 1 }} />
				<span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)" }}>
					{currentChat?.title || ""}
				</span>
				<span style={{ flex: 1 }} />
				{isProcessing && (
					<button type="button" onClick={handleCancel} style={{
						background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
						color: "var(--error)", padding: "4px 10px", borderRadius: "5px",
						cursor: "pointer", fontSize: "10px", fontWeight: 600,
						display: "flex", alignItems: "center", gap: "4px",
					}}>
						<StopCircle size={12} /> Stop
					</button>
				)}
				<button type="button" onClick={() => setChatSidebarOpen(!chatSidebarOpen)} style={{
					background: "none", border: "none", color: "var(--text-muted)",
					cursor: "pointer", padding: "2px", display: "flex",
				}} title={chatSidebarOpen ? "Ocultar lista" : "Mostrar lista"}>
					{chatSidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
				</button>
			</div>

			{/* Main: Messages | Chat Sidebar */}
			<div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
				{/* Messages */}
				<div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
					<div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
						{messages.length === 0 && (
							<div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-dim)", fontSize: "13px" }}>
								Agent Engine ready. Send a message to start an autonomous coding session.
							</div>
						)}
						{messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}

						{currentToolCalls.length > 0 && (
							<div style={{ padding: "12px", background: "rgba(79,140,255,0.05)", border: "1px solid rgba(79,140,255,0.1)", borderRadius: "8px" }}>
								<div style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)", marginBottom: "8px" }}>
									<Terminal size={12} style={{ marginRight: "6px" }} /> Tool Calls
								</div>
								{currentToolCalls.map((tc, i) => (
									<div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "6px 0", fontSize: "12px" }}>
										<Wrench size={12} style={{ marginTop: "2px", color: "var(--text-muted)", flexShrink: 0 }} />
										<div style={{ flex: 1 }}>
											<div style={{ fontWeight: 600, color: "var(--text-main)" }}>{tc.toolName}</div>
											<div style={{ color: "var(--text-dim)", fontSize: "11px" }}>
												{tc.args ? JSON.stringify(tc.args).substring(0, 100) : ""}
											</div>
											{tc.status === "done" && <div style={{ color: "var(--success)", fontSize: "10px", marginTop: "2px" }}>✓ Completed</div>}
											{tc.status === "error" && <div style={{ color: "var(--error)", fontSize: "10px", marginTop: "2px" }}>✗ Failed</div>}
											{tc.status === "pending" && <div style={{ color: "var(--warning)", fontSize: "10px", marginTop: "2px" }}>⟳ Running...</div>}
										</div>
									</div>
								))}
							</div>
						)}

						{isProcessing && currentToolCalls.length === 0 && (
							<div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", fontSize: "13px" }}>
								<div className="typing-indicator"><span /><span /><span /></div>
								Thinking...
							</div>
						)}
						<div ref={messagesEndRef} />
					</div>

					{/* Input */}
					<div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-light)" }}>
						{/* Hidden file input */}
						<input
							type="file"
							ref={fileInputRef}
							onChange={handleFileSelect}
							multiple
							style={{ display: "none" }}
							accept=".txt,.json,.md,.csv,.xml,.yaml,.yml,.log,.js,.ts,.py,.java,.html,.css,.pdf,.png,.jpg,.jpeg,.gif,.svg,.webp"
						/>
						{/* Attachments chips */}
						{attachments.length > 0 && (
							<div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
								{attachments.map((att, i) => (
									<div key={i} style={{
										display: "flex", alignItems: "center", gap: "4px",
										background: "rgba(79,140,255,0.1)", border: "1px solid rgba(79,140,255,0.2)",
										borderRadius: "6px", padding: "4px 8px", fontSize: "11px",
										color: "var(--accent)", maxWidth: "200px",
									}}>
										<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
											{att.name}
										</span>
										<button type="button" onClick={() => removeAttachment(i)} style={{
											background: "none", border: "none", color: "var(--text-muted)",
											cursor: "pointer", padding: "1px", display: "flex",
										}}>
											<X size={12} />
										</button>
									</div>
								))}
							</div>
						)}
						<div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
							<button type="button" onClick={() => fileInputRef.current?.click()} style={{
								background: "none", border: "1px solid var(--border-light)", borderRadius: "8px",
								color: "var(--text-muted)", cursor: "pointer", padding: "10px",
								display: "flex", alignItems: "center", justifyContent: "center",
								flexShrink: 0, opacity: isProcessing ? 0.5 : 1,
							}} disabled={isProcessing} title="Adjuntar archivo">
								<Paperclip size={18} />
							</button>
							<textarea
								ref={inputRef}
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Ask the coding agent to do something..."
								disabled={isProcessing}
								rows={2}
								style={{
									flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)",
									borderRadius: "8px", padding: "10px 14px", color: "var(--text-main)",
									fontSize: "13px", fontFamily: "inherit", resize: "none",
									opacity: isProcessing ? 0.5 : 1,
								}}
							/>
							<button type="button" onClick={handleSend} disabled={isProcessing || !input.trim()} style={{
								padding: "10px 16px", background: "linear-gradient(135deg, var(--accent), #7c3aed)",
								border: "none", borderRadius: "8px", color: "white",
								cursor: isProcessing ? "not-allowed" : "pointer",
								opacity: isProcessing || !input.trim() ? 0.5 : 1,
								display: "flex", alignItems: "center", justifyContent: "center",
							}}>
								<Send size={18} />
							</button>
						</div>
					</div>
				</div>

				{/* Chat Sidebar (right) */}
				{chatSidebarOpen && (
					<div style={{
						width: "260px", borderLeft: "1px solid var(--border-light)",
						display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0,
					}}>
						<div style={{ padding: "12px", borderBottom: "1px solid var(--border-light)" }}>
							<div style={{ display: "flex", gap: "6px" }}>
								<div style={{ flex: 1, display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", borderRadius: "6px", padding: "6px 10px" }}>
									<Search size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
									<input type="text" value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} placeholder="Buscar chat..." style={{ background: "none", border: "none", color: "var(--text-main)", fontSize: "11px", fontFamily: "inherit", outline: "none", width: "100%" }} />
								</div>
								<button type="button" onClick={handleNewChat} style={{ background: "rgba(79,140,255,0.1)", border: "1px solid rgba(79,140,255,0.2)", borderRadius: "6px", color: "var(--accent)", cursor: "pointer", padding: "6px 8px", display: "flex", alignItems: "center" }} title="Nuevo chat">
									<Plus size={14} />
								</button>
							</div>
						</div>
						<div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
							{pinnedChats.length > 0 && (
								<>
									<div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", padding: "4px 8px", textTransform: "uppercase", letterSpacing: "1px" }}>Fijados</div>
									{pinnedChats.map((chat) => renderChatItem(chat))}
									<div style={{ height: "8px" }} />
								</>
							)}
							<div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", padding: "4px 8px", textTransform: "uppercase", letterSpacing: "1px" }}>Recientes</div>
							{recentChats.length === 0 && pinnedChats.length === 0 && (
								<div style={{ textAlign: "center", padding: "24px", color: "var(--text-dim)", fontSize: "11px" }}>No hay chats. Crea uno nuevo.</div>
							)}
							{recentChats.map((chat) => renderChatItem(chat))}
						</div>
					</div>
				)}
			</div>
		</div>
	);

	// ─── Render Chat Item ───────────────────────────────────────────
	function renderChatItem(chat: ChatEntry) {
		const isActive = chat.id === currentChatId;
		const isRenaming = renamingChat === chat.id;

		return (
			<div key={chat.id} style={{
				padding: "8px", marginBottom: "2px", borderRadius: "6px", cursor: "pointer",
				background: isActive ? "rgba(79,140,255,0.1)" : "transparent",
				border: isActive ? "1px solid rgba(79,140,255,0.2)" : "1px solid transparent",
				transition: "all 0.15s",
			}}>
				{isRenaming ? (
					<div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
						<input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
							onKeyDown={(e) => { if (e.key === "Enter") handleRenameChat(chat.id); if (e.key === "Escape") setRenamingChat(null); }}
							autoFocus style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid var(--accent)", borderRadius: "4px", padding: "4px 8px", color: "var(--text-main)", fontSize: "11px", fontFamily: "inherit", outline: "none" }} />
						<button type="button" onClick={() => handleRenameChat(chat.id)} style={{ background: "rgba(79,140,255,0.1)", border: "none", borderRadius: "4px", color: "var(--accent)", cursor: "pointer", padding: "4px" }}>
							<Save size={12} />
						</button>
					</div>
				) : (
					<div onClick={() => handleSwitchChat(chat.id)} style={{ cursor: "pointer" }}>
						<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
							<MessageSquare size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
							<span style={{ fontSize: "12px", fontWeight: isActive ? 600 : 400, color: "var(--text-main)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
								{chat.title}
							</span>
						</div>
						{chat.lastMessage && (
							<div style={{ fontSize: "10px", color: "var(--text-dim)", marginLeft: "18px", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
								{chat.lastMessage}
							</div>
						)}
						{isActive && (
							<div style={{ display: "flex", gap: "2px", marginTop: "4px", marginLeft: "18px" }}>
								<button type="button" onClick={(e) => { e.stopPropagation(); setRenamingChat(chat.id); setRenameValue(chat.title); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px 4px" }} title="Renombrar">
									<Edit3 size={10} />
								</button>
								<button type="button" onClick={(e) => { e.stopPropagation(); handlePinChat(chat.id); }} style={{ background: "none", border: "none", color: chat.pinned ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", padding: "2px 4px" }} title={chat.pinned ? "Desfijar" : "Fijar"}>
									{chat.pinned ? <PinOff size={10} /> : <Pin size={10} />}
								</button>
								<button type="button" onClick={(e) => { e.stopPropagation(); if (confirm("¿Eliminar este chat?")) handleDeleteChat(chat.id); }} style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", padding: "2px 4px" }} title="Eliminar">
									<Trash2 size={10} />
								</button>
							</div>
						)}
					</div>
				)}
			</div>
		);
	}
};

// ─── Message Bubble Component ───────────────────────────────────────

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
	const isUser = message.role === "user";
	const isSystem = message.role === "system";

	if (isSystem) {
		return <div style={{ textAlign: "center", padding: "8px 16px", fontSize: "12px", color: "var(--text-dim)" }}>{message.content}</div>;
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", maxWidth: "80%", alignSelf: isUser ? "flex-end" : "flex-start" }}>
			<div style={{
				padding: "10px 14px", borderRadius: "12px",
				background: isUser ? "linear-gradient(135deg, var(--accent), #7c3aed)" : "rgba(255,255,255,0.05)",
				border: isUser ? "none" : "1px solid var(--border-light)",
				color: isUser ? "white" : "var(--text-main)",
				fontSize: "13px", lineHeight: 1.5, whiteSpace: "pre-wrap",
			}}>
				{message.content}
			</div>
			<div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "4px", padding: "0 4px", display: "flex", gap: "8px" }}>
				<span>{message.timestamp.toLocaleTimeString()}</span>
				{!isUser && message.usage && (
					<span>{message.usage.promptTokens}▲ / {message.usage.completionTokens}▼</span>
				)}
			</div>
		</div>
	);
};
