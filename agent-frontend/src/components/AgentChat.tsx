import {
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Download,
	Edit3,
	MessageSquare,
	Paperclip,
	Pin,
	PinOff,
	Plus,
	Reply,
	Save,
	Search,
	Send,
	StopCircle,
	Terminal,
	Trash2,
	Wrench,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../contexts/ToastContext";
import { useWs } from "../contexts/WebSocketContext";
import { ConfirmModal } from "./ConfirmModal";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage, ChatEntry, ToolCallInfo, TokenUsage } from "../types/chat";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage, ChatEntry, ToolCallInfo, TokenUsage } from "../types/chat";

// Main Component

export const AgentChat: React.FC = () => {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
	const [currentToolCalls, setCurrentToolCalls] = useState<ToolCallInfo[]>([]);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	// Chat management-
	const [chats, setChats] = useState<ChatEntry[]>([]);
	const [channelChats, setChannelChats] = useState<ChatEntry[]>([]);
	const [currentChatId, setCurrentChatId] = useState<string | null>(null);
	const [chatSidebarOpen, setChatSidebarOpen] = useState(true);
	const [chatSearch, setChatSearch] = useState("");
	const [renamingChat, setRenamingChat] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [model, setModel] = useState("");
	const [totalPromptTokens, setTotalPromptTokens] = useState(0);
	const [totalCompletionTokens, setTotalCompletionTokens] = useState(0);
	const [attachments, setAttachments] = useState<Array<{ name: string; type: string; data: string }>>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
	const [messageQueue, setMessageQueue] = useState<string[]>([]);
	const [confirmClearQueue, setConfirmClearQueue] = useState(false);
	const messageQueueRef = useRef<string[]>([]);

	// Feature: search within chat-
	const [chatSearchQuery, setChatSearchQuery] = useState("");
	const [chatSearchOpen, setChatSearchOpen] = useState(false);

	// Feature: collapsible tools--
	const [collapsedTools, setCollapsedTools] = useState(true);

	// Feature: edit messages
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const [editValue, setEditValue] = useState("");

	// Feature: image lightbox
	const [expandedImage, setExpandedImage] = useState<string | null>(null);

	// Feature: reply to messages
	const [replyTo, setReplyTo] = useState<{ index: number; content: string; role: string; timestamp: Date } | null>(
		null
	);

	// Feature: saved/favorited messages
	const [savedMessages, setSavedMessages] = useState<Set<string>>(new Set());
	const [feedbackMap, setFeedbackMap] = useState<Map<string, "up" | "down">>(new Map());
	const [feedbackMap, setFeedbackMap] = useState<Map<string, "up" | "down">>(new Map());

	// Feature: auto suggestions
	const [suggestions, setSuggestions] = useState<string[]>([]);

	// Slash commands-
	const COMMANDS = [
		{ cmd: "/ayuda", desc: "Muestra esta lista de comandos", action: () => {} },
		{ cmd: "/buscar", desc: "Busca informaciï¿½n en internet", action: () => {} },
		{ cmd: "/nuevaTarea", desc: "Crear una nueva tarea", action: () => {} },
		{ cmd: "/modelos", desc: "Listar modelos disponibles en Ollama", action: () => {} },
		{ cmd: "/cambioModelo", desc: "Cambiar el modelo activo: /cambioModelo <nombre>", action: () => {} },
		{ cmd: "/tools", desc: "Listar herramientas disponibles", action: () => {} },
	];
	const [showCommands, setShowCommands] = useState(false);
	const [commandFilter, setCommandFilter] = useState("");
	const [selectedCmdIndex, setSelectedCmdIndex] = useState(0);
	const [showNewTaskModal, setShowNewTaskModal] = useState(false);
	const [newTaskText, setNewTaskText] = useState("");

	const { connected, reconnecting, send: sendWs, subscribe } = useWs();
	const { connected, reconnecting, send: sendWs, subscribe } = useWs();
	const { show: showToast } = useToast();

	const handleWsMessage = (msg: { type: string; payload?: Record<string, unknown> }) => {
		console.log("[Chat WS] Recibido:", msg.type, msg.payload);
		switch (msg.type) {
			case "status":
				if (msg.payload?.status === "identified") {
					const newModel = (msg.payload?.model as string) || "";
					console.log("[Chat WS] Modelo actualizado a:", newModel);
					setModel(newModel);
					sendWs("list_sessions", {});
				}
				break;

			case "assistant_chunk": {
				const chunkText = msg.payload?.text as string;
				if (!chunkText) break;
				setMessages((prev) => {
					const last = prev[prev.length - 1];
					if (last?.role === "assistant" && last.content !== "" && !last.content.startsWith("{")) {
						const updated = [...prev];
						updated[updated.length - 1] = { ...last, content: last.content + chunkText };
						return updated;
					}
					return [...prev, { role: "assistant", content: chunkText, timestamp: new Date() }];
				});
				break;
			}

			case "list_chats": {
				const chatList = msg.payload?.chats as ChatEntry[];
				const activeChatId = msg.payload?.activeChatId as string | undefined;
				if (chatList) {
					setChats(chatList);
					if (activeChatId) {
						setCurrentChatId(activeChatId);
					}
				}
				if (msg.payload?.channelChats) {
					setChannelChats(msg.payload.channelChats as ChatEntry[]);
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
					setMessages(
						history.map((h) => ({
							role: h.role as ChatMessage["role"],
							content: h.text,
							timestamp: new Date(),
						}))
					);
					return;
				}

				const text = msg.payload?.text as string;
				if (chatId === currentChatId || !currentChatId) {
					setMessages((prev) => {
						const last = prev[prev.length - 1];
						// Replace the last streaming message (from assistant_chunk) instead of appending
						if (last?.role === "assistant" && !last.usage) {
							const updated = [...prev];
							updated[updated.length - 1] = {
								role: "assistant",
								content: text,
								timestamp: new Date(),
								usage,
							};
							return updated;
						}
						return [...prev, { role: "assistant", content: text, timestamp: new Date(), usage }];
					});
				}
				// Keep completed tool calls visible as conversation history
				// They get cleared on next user message via handleSend
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
					{
						role: "system",
						content: `❌ Error: ${msg.payload?.message as string}`,
						timestamp: new Date(),
					},
				]);
				setIsProcessing(false);
				break;
			}

			case "suggestions": {
				const s = msg.payload?.suggestions as string[];
				if (s && Array.isArray(s)) {
					setSuggestions(s);
				}
				break;
			}

			case "message_saved": {
				const savedChatId = msg.payload?.chatId as string;
				const savedContent = msg.payload?.messageContent as string;
				if (savedChatId && savedContent) {
					const key = `${savedChatId}|${savedContent.substring(0, 50)}`;
					setSavedMessages((prev) => new Set(prev).add(key));
				}
				break;
			}

			case "message_unsaved": {
				const unsavedChatId = msg.payload?.chatId as string;
				const unsavedContent = msg.payload?.messageContent as string;
				if (unsavedChatId && unsavedContent) {
					const key = `${unsavedChatId}|${unsavedContent.substring(0, 50)}`;
					setSavedMessages((prev) => {
						const next = new Set(prev);
						next.delete(key);
						return next;
					});
				}
				break;
			}

			case "message_saved_status": {
				const statusChatId = msg.payload?.chatId as string;
				const statusContent = msg.payload?.messageContent as string;
				const isSaved = msg.payload?.saved as boolean;
				if (statusChatId && statusContent) {
					const key = `${statusChatId}|${statusContent.substring(0, 50)}`;
					setSavedMessages((prev) => {
						const next = new Set(prev);
						if (isSaved) {
							next.add(key);
						} else {
							next.delete(key);
						}
						return next;
					});
				}
				break;
			}

			case "list_sessions_result":
			case "list_sessions": {
				const sessions = msg.payload?.sessions as Array<ChatEntry & { messageCount: number }>;
				if (sessions) {
					setChats(sessions);
				}
				break;
			}

			case "tools_list": {
				const tools = msg.payload?.tools as Array<{ function: { name: string; description: string } }>;
				if (tools && Array.isArray(tools)) {
					const toolsText = tools
						.filter((t) => t?.function?.name)
						.map((t) => `- **${t.function.name}**: ${t.function.description || "Sin descripción"}`)
						.join("\n");
					setMessages((prev) => {
						if (prev.length > 0 && prev[prev.length - 1].content.startsWith("**Herramientas disponibles")) {
							const updated = [...prev];
							updated[updated.length - 1] = {
								role: "system",
								content: `**Herramientas disponibles (${tools.length}):**\n\n${toolsText}`,
								timestamp: new Date(),
							};
							return updated;
						}
						return [
							...prev,
							{
								role: "system",
								content: `**Herramientas disponibles (${tools.length}):**\n\n${toolsText}`,
								timestamp: new Date(),
							},
						];
					});
				}
				break;
			}

			case "ollama_models": {
				const models = msg.payload?.models as Array<{ name: string }>;
				if (models && Array.isArray(models)) {
					setMessages((prev) => {
						if (
							prev.length > 0 &&
							(prev[prev.length - 1].content.startsWith("**Modelos disponibles en Ollama") ||
								prev[prev.length - 1].content === "No se encontraron modelos en Ollama.")
						) {
							const updated = [...prev];
							if (models.length === 0) {
								updated[updated.length - 1] = {
									role: "system",
									content: "No se encontraron modelos en Ollama.",
									timestamp: new Date(),
								};
							} else {
								const modelsText = models.map((m: { name: string }) => `- **${m.name}**`).join("\n");
								updated[updated.length - 1] = {
									role: "system",
									content: `**Modelos disponibles en Ollama (${models.length}):**\n\n${modelsText}\n\nUsa \`/cambioModelo <nombre>\` para cambiar el modelo activo.`,
									timestamp: new Date(),
								};
							}
							return updated;
						}
						if (models.length === 0) {
							return [
								...prev,
								{
									role: "system",
									content: "No se encontraron modelos en Ollama.",
									timestamp: new Date(),
								},
							];
						}
						const modelsText = models.map((m: { name: string }) => `- **${m.name}**`).join("\n");
						return [
							...prev,
							{
								role: "system",
								content: `**Modelos disponibles en Ollama (${models.length}):**\n\n${modelsText}\n\nUsa \`/cambioModelo <nombre>\` para cambiar el modelo activo.`,
								timestamp: new Date(),
							},
						];
					});
				}
				break;
			}

			case "task_created": {
				const taskRunId = msg.payload?.runId as number;
				const taskText = msg.payload?.text as string;
				setMessages((prev) => [
					...prev,
					{
						role: "system",
						content: `✅ Tarea creada (#${taskRunId}): **${taskText}**`,
						timestamp: new Date(),
					},
				]);
				break;
			}
			case "telegram_message": {
				const msgChatId = msg.payload?.chatId as string;
				const content = (msg.payload?.content as string) || "";
				const role = (msg.payload?.role as string) || "user";
				if (msgChatId === currentChatId) {
					setMessages((prev) => [
						...prev,
						{
							role: role as ChatMessage["role"],
							content,
							timestamp: new Date(),
						},
					]);
				}
				// Update sidebar lastMessage for this chat
				if (content) {
					setChannelChats((prev) =>
						prev.map((c) => (c.id === msgChatId ? { ...c, lastMessage: content.substring(0, 80) } : c))
					);
				}
				break;
			}

			case "mode_changed": {
				const modeLabel =
					(msg.payload?.label as string) || (msg.payload?.mode as Record<string, string>)?.name || "";
				const resetSession = msg.payload?.resetSession === true;
				if (resetSession) {
					setMessages([]);
					setCurrentChatId(null);
				}
				if (modeLabel) {
					setMessages((prev) => [
						...prev,
						{
							role: "system" as ChatMessage["role"],
							content: `Modo cambiado a ${modeLabel}. ${resetSession ? "La sesión se ha reiniciado." : ""}`,
							timestamp: new Date(),
						},
					]);
				}
				break;
			}

			case "notification": {
				const title = msg.payload?.title as string;
				const message = msg.payload?.message as string;
				const level = msg.payload?.level as string;
				if (message) showToast(`${title ? title + ": " : ""}${message}`, level === "error" ? "error" : level === "success" ? "success" : "info");
				break;
			}
		}
	};

	const sendMessage = useCallback(
		(text: string, quotedMessage?: { content: string; role: string; timestamp?: string } | null) => {
			const chatId = currentChatId || "dashboard";
			const promptEstimate = Math.ceil(text.length / 4);
			setMessages((prev) => [
				...prev,
				{
					role: "user",
					content: text,
					timestamp: new Date(),
					usage: { promptTokens: promptEstimate, completionTokens: 0, totalTokens: promptEstimate },
				},
			]);
			setTotalPromptTokens((p) => p + promptEstimate);
			setInput("");
			setIsProcessing(true);
			// Clear tool calls from previous response when new message is sent
			setCurrentToolCalls([]);

			const payload: Record<string, unknown> = { chatId, text };
			if (quotedMessage) {
				payload.quotedMessage = quotedMessage;
			}
			if (attachments.length > 0) {
				payload.attachments = attachments;
			}
			sendWs("user_message", payload);
			setAttachments([]); // Clear attachments after sending
		},
		[currentChatId, sendWs, attachments]
	);

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [messages, isProcessing, scrollToBottom]);

	// Keep messageQueueRef in sync
	useEffect(() => {
		messageQueueRef.current = messageQueue;
	}, [messageQueue]);

	// Auto-dispatch next queued message when processing finishes
	useEffect(() => {
		if (!isProcessing && messageQueueRef.current.length > 0) {
			const [nextText, ...rest] = messageQueueRef.current;
			setMessageQueue(rest);
			sendMessage(nextText);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isProcessing]);

	// Subscribe to WS messages
	useEffect(() => {
		return subscribe((msg) => {
			console.log("[Chat WS] Recibido:", msg.type, msg.payload);
			handleWsMessage(msg);
		});
	}, [subscribe, currentChatId]);

	const executeCommand = useCallback(
		(cmdText: string) => {
			const cmd = COMMANDS.find((c) => cmdText.startsWith(c.cmd));
			if (!cmd) return false;

			if (cmd.cmd === "/ayuda") {
				const helpText = COMMANDS.map((c) => `${c.cmd} - ${c.desc}`).join("\n");
				setMessages((prev) => [
					...prev,
					{
						role: "system",
						content: `Comandos disponibles:\n${helpText}`,

						timestamp: new Date(),
					},
				]);
			} else if (cmd.cmd === "/buscar") {
				const query = cmdText.slice("/buscar".length).trim();
				if (query) {
					sendMessage(`Busca en internet: ${query}`);
				} else {
					setInput("/buscar: ");
					setTimeout(() => inputRef.current?.focus(), 0);
				}
			} else if (cmd.cmd === "/nuevaTarea") {
				setShowNewTaskModal(true);
			} else if (cmd.cmd === "/modelos") {
				sendWs("list_ollama_models", {});
			} else if (cmd.cmd === "/cambioModelo") {
				const modelName = cmdText.slice("/cambioModelo".length).trim();
				if (modelName) {
					sendWs("general_config_update", { model: modelName });
					setMessages((prev) => [
						...prev,
						{
							role: "system",
							content: `✅ Cambiando modelo activo a: **${modelName}**`,

							timestamp: new Date(),
						},
					]);
				} else {
					setMessages((prev) => [
						...prev,
						{
							role: "system",
							content: "Usa: /cambioModelo <nombre_del_modelo>",

							timestamp: new Date(),
						},
					]);
				}
			} else if (cmd.cmd === "/tools") {
				sendWs("list_tools", {});
			} else {
				return false;
			}
			setInput("");
			setShowCommands(false);
			return true;
		},
		[sendMessage, sendWs, COMMANDS.map, COMMANDS.find]
	);

	const handleSend = useCallback(() => {
		const text = input.trim();
		if (!text || !connected) return;

		// Check if it's a /buscar: prefix (Discord-like parameter input)
		if (text.startsWith("/buscar: ")) {
			const query = text.slice("/buscar: ".length).trim();
			if (query) {
				sendMessage(`Busca en internet: ${query}`);
				setInput("");
				return;
			}
		}

		// Check if it's a /cambioModelo command with parameter
		if (text.startsWith("/cambioModelo ")) {
			executeCommand(text);
			return;
		}

		// Check if it's a slash command
		if (text.startsWith("/")) {
			executeCommand(text);
			return;
		}

		if (isProcessing) {
			// Queue the message instead of sending directly
			if (messageQueue.length >= 3) return;
			setMessageQueue((prev) => [...prev, text]);
			setInput("");
			return;
		}

		if (replyTo) {
			sendMessage(text, {
				content: replyTo.content,
				role: replyTo.role,
				timestamp: replyTo.timestamp instanceof Date ? replyTo.timestamp.toISOString() : replyTo.timestamp,
			});
		} else {
			sendMessage(text);
		}
		setReplyTo(null);
		setSuggestions([]);
	}, [input, isProcessing, connected, messageQueue.length, sendMessage, executeCommand, replyTo]);

	const handleCancel = () => {
		if (messageQueue.length > 0) {
			setConfirmClearQueue(true);
		} else {
			sendWs("cancel", { chatId: currentChatId || "dashboard" });
			setIsProcessing(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		// Command palette navigation
		if (showCommands) {
			const filtered = COMMANDS.filter((c) => c.cmd.includes(commandFilter) || commandFilter === "/");
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedCmdIndex((prev) => Math.min(prev + 1, filtered.length - 1));
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedCmdIndex((prev) => Math.max(prev - 1, 0));
				return;
			}
			if (e.key === "Enter" && filtered[selectedCmdIndex]) {
				e.preventDefault();
				executeCommand(filtered[selectedCmdIndex].cmd);
				return;
			}
			if (e.key === "Escape") {
				setShowCommands(false);
				return;
			}
		}

		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	// Chat CRUD--
	const handleNewChat = () => sendWs("chat_update", { action: "create", title: "Nuevo chat" });

	const handleSwitchChat = (chatId: string) => {
		if (chatId === currentChatId) return;
		setCurrentChatId(chatId);
		setMessages([]);
		setMessageQueue([]);
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

		const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
		const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
		const newAttachments: Array<{ name: string; type: string; data: string }> = [];
		let loaded = 0;

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			if (file.size > MAX_FILE_SIZE) {
				showToast(`Archivo demasiado grande: ${file.name} (máx 5MB)`, "error");
				continue;
			}
			if (file.size > MAX_FILE_SIZE) {
				showToast(`Archivo demasiado grande: ${file.name} (máx 5MB)`, "error");
				continue;
			}
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

	// Feature: edit handlers-
	const handleStartEdit = useCallback(
		(index: number) => {
			setEditingIndex(index);
			setEditValue(messages[index].content);
		},
		[messages]
	);

	const handleSaveEdit = useCallback(
		(index: number) => {
			setMessages((prev) =>
				prev.map((msg, i) => (i === index ? { ...msg, content: editValue, timestamp: new Date() } : msg))
			);
			setEditingIndex(null);
			setEditValue("");
		},
		[editValue]
	);

	const handleCancelEdit = useCallback(() => {
		setEditingIndex(null);
		setEditValue("");
	}, []);

	// Feature: export chat as markdown--
	const exportChat = useCallback(() => {
		const title = chats.find((c) => c.id === currentChatId)?.title || "chat";
		const date = new Date().toISOString().split("T")[0];
		const chatId = currentChatId || "export";
		const model = messages.find((m) => m.usage)?.usage?.model || "";
		const model = messages.find((m) => m.usage)?.usage?.model || "";

		let md = `# ${title}\n\n`;
		md += `*Exportado el ${new Date().toLocaleString("es-AR")}*\n\n`;
		if (model) md += `*Modelo: ${model}*\n\n`;
		md += `---\n\n`;
		let md = `# ${title}\n\n`;
		md += `*Exportado el ${new Date().toLocaleString("es-AR")}*\n\n`;
		if (model) md += `*Modelo: ${model}*\n\n`;
		md += `---\n\n`;

		messages.forEach((msg) => {
			if (msg.role === "system") return;

			if (msg.role === "system") return;

			const roleLabel =
				msg.role === "user"
					? "Usuario"
					: msg.role === "assistant"
						? "Asistente"
						: msg.role === "tool"
							? "Herramienta"
							: msg.role;
			const time = new Date(msg.timestamp).toLocaleString("es-AR");
			md += `## ${roleLabel} — ${time}\n\n`;

			if (msg.role === "tool") {
				md += "```\n" + msg.content.substring(0, 2000) + "\n```\n\n";
			} else {
				md += `${msg.content}\n\n`;
			}

						: msg.role === "tool"
							? "Herramienta"
							: msg.role;
			const time = new Date(msg.timestamp).toLocaleString("es-AR");
			md += `## ${roleLabel} — ${time}\n\n`;

			if (msg.role === "tool") {
				md += "```\n" + msg.content.substring(0, 2000) + "\n```\n\n";
			} else {
				md += `${msg.content}\n\n`;
			}

			if (msg.usage) {
				md += `> Tokens: ${msg.usage.promptTokens || "?"} ↑ / ${msg.usage.completionTokens || "?"} ↓\n\n`;
				md += `> Tokens: ${msg.usage.promptTokens || "?"} ↑ / ${msg.usage.completionTokens || "?"} ↓\n\n`;
			}

			md += `---\n\n`;

			md += `---\n\n`;
		});

		const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `chat-${chatId}-${date}.md`;
		a.click();
		URL.revokeObjectURL(url);
	}, [chats, currentChatId, messages]);

	// Computed values-
	const currentChat = chats.find((c) => c.id === currentChatId);

	const filteredChats = chats.filter((c) => c.title.toLowerCase().includes(chatSearch.toLowerCase()));
	const pinnedChats = filteredChats.filter((c) => c.pinned);
	const recentChats = filteredChats.filter((c) => !c.pinned);
	const telegramChats = channelChats.filter((c) => c.origin === "telegram");

	const filteredMessageIndices = chatSearchQuery
		? messages
				.map((msg, i) => ({ msg, i }))
				.filter(({ msg }) => msg.content.toLowerCase().includes(chatSearchQuery.toLowerCase()))
		: messages.map((msg, i) => ({ msg, i }));

	const filteredCount = filteredMessageIndices.length;

	return (
		<div
			className="card-glass"
			style={{
				padding: "0",
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
				height: "100%",
			}}
		>
			{/* Compact bar: status + model + chat title + actions + stop + sidebar toggle */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "10px",
					padding: "8px 16px",
					borderBottom: "1px solid var(--border-light)",
					flexShrink: 0,
				}}
			>
				<span
					style={{
						width: "7px",
						height: "7px",
						borderRadius: "50%",
						flexShrink: 0,
						background: connected ? "var(--success)" : reconnecting ? "var(--warning)" : "var(--error)",
						animation: reconnecting ? "pulse 1.5s ease-in-out infinite" : "none",
						background: connected ? "var(--success)" : reconnecting ? "var(--warning)" : "var(--error)",
						animation: reconnecting ? "pulse 1.5s ease-in-out infinite" : "none",
					}}
				/>
				<span style={{ fontSize: "11px", color: "var(--text-dim)", fontWeight: 500 }}>
					{connected ? "Conectado" : reconnecting ? "Reconectando..." : "Desconectado"}
					{connected ? "Conectado" : reconnecting ? "Reconectando..." : "Desconectado"}
				</span>
				{model && (
					<span style={{ fontSize: "11px", color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
						Model: {model}
					</span>
				)}
				{(totalPromptTokens > 0 || totalCompletionTokens > 0) && (
					<>
						<span style={{ fontSize: "10px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
							Tokens: {totalPromptTokens + totalCompletionTokens}
						</span>
						<div
							style={{
								width: "60px",
								height: "4px",
								background: "rgba(255,255,255,0.1)",
								borderRadius: "2px",
								overflow: "hidden",
							}}
							title={`${totalPromptTokens} prompt + ${totalCompletionTokens} completion`}
						>
							<div
								style={{
									width: `${Math.min(100, ((totalPromptTokens + totalCompletionTokens) / 8000) * 100)}%`,
									height: "100%",
									background: (totalPromptTokens + totalCompletionTokens) > 6000
										? "var(--warning)"
										: "var(--accent)",
									borderRadius: "2px",
									transition: "width 0.3s ease",
								}}
							/>
						</div>
					</>
					<>
						<span style={{ fontSize: "10px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
							Tokens: {totalPromptTokens + totalCompletionTokens}
						</span>
						<div
							style={{
								width: "60px",
								height: "4px",
								background: "rgba(255,255,255,0.1)",
								borderRadius: "2px",
								overflow: "hidden",
							}}
							title={`${totalPromptTokens} prompt + ${totalCompletionTokens} completion`}
						>
							<div
								style={{
									width: `${Math.min(100, ((totalPromptTokens + totalCompletionTokens) / 8000) * 100)}%`,
									height: "100%",
									background: (totalPromptTokens + totalCompletionTokens) > 6000
										? "var(--warning)"
										: "var(--accent)",
									borderRadius: "2px",
									transition: "width 0.3s ease",
								}}
							/>
						</div>
					</>
				)}
				<span style={{ flex: 1 }} />
				<span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)" }}>
					{currentChat?.title || ""}
				</span>
				{/* Feature: search button */}
				<button
					type="button"
					onClick={() => setChatSearchOpen(!chatSearchOpen)}
					title="Buscar en el chat"
					style={{
						background: chatSearchOpen ? "rgba(79,140,255,0.15)" : "none",
						border: "none",
						color: "var(--text-muted)",
						cursor: "pointer",
						padding: "4px",
						display: "flex",
						borderRadius: "4px",
					}}
				>
					<Search size={14} />
				</button>
				{/* Feature: export button */}
				<button
					type="button"
					onClick={exportChat}
					title="Exportar chat como Markdown"
					style={{
						background: "none",
						border: "none",
						color: "var(--text-muted)",
						cursor: "pointer",
						padding: "4px",
						display: "flex",
						borderRadius: "4px",
					}}
				>
					<Download size={14} />
				</button>
				<span style={{ flex: 1 }} />
				{isProcessing && (
					<button
						type="button"
						onClick={handleCancel}
						title="Cancelar"
						style={{
							background: "rgba(239,68,68,0.1)",
							border: "1px solid rgba(239,68,68,0.2)",
							color: "var(--error)",
							padding: "4px 10px",
							borderRadius: "5px",
							cursor: "pointer",
							fontSize: "10px",
							fontWeight: 600,
							display: "flex",
							alignItems: "center",
							gap: "4px",
						}}
					>
						<StopCircle size={12} /> Detener
					</button>
				)}
				<button
					type="button"
					onClick={() => setChatSidebarOpen(!chatSidebarOpen)}
					style={{
						background: "none",
						border: "none",
						color: "var(--text-muted)",
						cursor: "pointer",
						padding: "2px",
						display: "flex",
					}}
					title={chatSidebarOpen ? "Ocultar lista" : "Mostrar lista"}
				>
					{chatSidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
				</button>
			</div>

			{/* Feature: search input bar */}
			{chatSearchOpen && (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						padding: "8px 16px",
						borderBottom: "1px solid var(--border-light)",
						background: "rgba(79,140,255,0.03)",
					}}
				>
					<Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
					<input
						type="text"
						value={chatSearchQuery}
						onChange={(e) => setChatSearchQuery(e.target.value)}
						placeholder="Buscar en mensajes..."
						style={{
							flex: 1,
							background: "transparent",
							border: "none",
							color: "var(--text-main)",
							fontSize: "13px",
							fontFamily: "inherit",
							outline: "none",
						}}
					/>
					{chatSearchQuery && (
						<span
							style={{
								fontSize: "11px",
								color: "var(--text-dim)",
								whiteSpace: "nowrap",
								fontWeight: filteredCount === 0 ? 600 : 400,
							}}
						>
							{filteredCount > 0
								? `🔍 ${filteredCount} resultado${filteredCount === 1 ? "" : "s"}`
								: "Sin resultados"}
						</span>
					)}
					<button
						type="button"
						onClick={() => {
							setChatSearchOpen(false);
							setChatSearchQuery("");
						}}
						style={{
							background: "none",
							border: "none",
							color: "var(--text-muted)",
							cursor: "pointer",
							padding: "2px",
							display: "flex",
						}}
						title="Cerrar búsqueda"
					>
						<X size={14} />
					</button>
				</div>
			)}

			{/* Main: Messages | Chat Sidebar */}
			<div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
				{/* Messages */}
				<div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
						{filteredMessageIndices.length === 0 && chatSearchQuery && (
							<div
								style={{
									textAlign: "center",
									padding: "40px 20px",
									color: "var(--text-dim)",
									fontSize: "13px",
								}}
							>
								No se encontraron mensajes con &ldquo;{chatSearchQuery}&rdquo;
							</div>
						)}
						{messages.length === 0 && !currentChatId && (
							<div
								style={{
									textAlign: "center",
									padding: "60px 20px",
									color: "var(--text-dim)",
									fontSize: "13px",
								}}
							>
								<div
									style={{
										fontWeight: 600,
										color: "var(--text-main)",
										marginBottom: "8px",
										fontSize: "15px",
									}}
								>
									Agent Engine Listo
								</div>
								<div style={{ marginBottom: "20px", lineHeight: 1.6 }}>
									Selecciona un chat existente o crea uno nuevo.
								</div>
								<button
									type="button"
									onClick={handleNewChat}
									style={{
										padding: "10px 24px",
										background: "linear-gradient(135deg, var(--accent), #7c3aed)",
										border: "none",
										borderRadius: "8px",
										color: "white",
										cursor: "pointer",
										fontSize: "13px",
										fontWeight: 600,
										display: "inline-flex",
										alignItems: "center",
										gap: "8px",
									}}
								>
									<Plus size={16} /> Nuevo Chat
								</button>
							</div>
						)}
						{messages.length === 0 && currentChatId && (
							<div
								style={{
									textAlign: "center",
									padding: "60px 20px",
									color: "var(--text-dim)",
									fontSize: "13px",
								}}
							>
								Chat vacío. Envía un mensaje para empezar.
							</div>
						)}
						{filteredMessageIndices.map(({ msg, i }) => {
							const msgKey = msg.timestamp?.getTime()?.toString(36) || `msg-${i}`;
							if (editingIndex === i) {
								return (
									<div
										key={msgKey}
										style={{
											display: "flex",
											flexDirection: "column",
											alignItems: "flex-end",
											maxWidth: "80%",
											alignSelf: "flex-end",
										}}
									>
										<div
											style={{
												padding: "10px 14px",
												borderRadius: "12px",
												background: "linear-gradient(135deg, var(--accent), #7c3aed)",
												width: "100%",
											}}
										>
											<textarea
												value={editValue}
												onChange={(e) => setEditValue(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Enter" && !e.shiftKey) {
														e.preventDefault();
														handleSaveEdit(i);
													}
													if (e.key === "Escape") {
														handleCancelEdit();
													}
												}}
												style={{
													width: "100%",
													background: "rgba(255,255,255,0.1)",
													border: "1px solid rgba(255,255,255,0.2)",
													borderRadius: "6px",
													padding: "8px",
													color: "white",
													fontSize: "13px",
													fontFamily: "inherit",
													resize: "vertical",
													minHeight: "60px",
													outline: "none",
												}}
											/>
											<div
												style={{
													display: "flex",
													gap: "6px",
													marginTop: "6px",
													justifyContent: "flex-end",
												}}
											>
												<button
													type="button"
													onClick={() => handleSaveEdit(i)}
													style={{
														background: "rgba(255,255,255,0.15)",
														border: "none",
														borderRadius: "4px",
														color: "white",
														cursor: "pointer",
														padding: "4px 8px",
														display: "flex",
														alignItems: "center",
														gap: "4px",
														fontSize: "11px",
														fontWeight: 600,
													}}
												>
													<Check size={14} /> Guardar
												</button>
												<button
													type="button"
													onClick={handleCancelEdit}
													style={{
														background: "rgba(255,255,255,0.08)",
														border: "none",
														borderRadius: "4px",
														color: "white",
														cursor: "pointer",
														padding: "4px 8px",
														display: "flex",
														alignItems: "center",
														gap: "4px",
														fontSize: "11px",
														fontWeight: 600,
													}}
												>
													<X size={14} /> Cancelar
												</button>
											</div>
										</div>
									</div>
								);
							}
							return (
								<MessageBubble
									key={msgKey}
									message={msg}
									index={i}
									onEdit={handleStartEdit}
									onImageClick={setExpandedImage}
									onReply={(idx, content, role, timestamp) => {
										setReplyTo({ index: idx, content, role, timestamp });
									}}
									onToggleSave={(_idx, role, content, timestamp, isSaved) => {
										sendWs(isSaved ? "unsave_message" : "save_message", {
											chatId: currentChatId || "dashboard",
											messageRole: role,
											messageContent: content,
											messageTimestamp:
												timestamp instanceof Date ? timestamp.toISOString() : timestamp,
										});
									}}
									isSaved={savedMessages.has(
										`${currentChatId || "dashboard"}|${msg.content.substring(0, 50)}`
									)}
									onFeedback={(idx, rating) => {
										const key = `${currentChatId}-${idx}`;
										const prev = feedbackMap.get(key);
										// If same rating clicked again, toggle off
										const newRating = prev === rating ? null : rating;
										setFeedbackMap((prev) => {
											const next = new Map(prev);
											if (newRating) next.set(key, newRating);
											else next.delete(key);
											return next;
										});
										if (newRating) {
											sendWs("message_feedback", {
												chatId: currentChatId,
												rating: newRating,
											});
										}
									}}
									feedbackState={feedbackMap.get(`${currentChatId}-${i}`) || null}
									onFeedback={(idx, rating) => {
										const key = `${currentChatId}-${idx}`;
										const prev = feedbackMap.get(key);
										// If same rating clicked again, toggle off
										const newRating = prev === rating ? null : rating;
										setFeedbackMap((prev) => {
											const next = new Map(prev);
											if (newRating) next.set(key, newRating);
											else next.delete(key);
											return next;
										});
										if (newRating) {
											sendWs("message_feedback", {
												chatId: currentChatId,
												rating: newRating,
											});
										}
									}}
									feedbackState={feedbackMap.get(`${currentChatId}-${i}`) || null}
								/>
							);
						})}

						{/* Feature: collapsible tool calls */}
						{currentToolCalls.length > 0 && (
							<div
								style={{
									padding: "12px",
									background: "rgba(79,140,255,0.05)",
									border: "1px solid rgba(79,140,255,0.1)",
									borderRadius: "8px",
								}}
							>
								<div
									onClick={() => setCollapsedTools(!collapsedTools)}
									style={{
										fontSize: "11px",
										fontWeight: 700,
										color: "var(--accent)",
										marginBottom: collapsedTools ? 0 : "8px",
										cursor: "pointer",
										display: "flex",
										alignItems: "center",
										gap: "4px",
										userSelect: "none",
									}}
								>
									{collapsedTools ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
									<Terminal size={12} /> Herramientas ({currentToolCalls.length})
								</div>
								{!collapsedTools &&
									currentToolCalls.map((tc, i) => (
										<div
											key={`tc-${tc.toolName}-${i}`}
											style={{
												display: "flex",
												alignItems: "flex-start",
												gap: "8px",
												padding: "6px 0",
												fontSize: "12px",
											}}
										>
											<Wrench
												size={12}
												style={{
													marginTop: "2px",
													color: "var(--text-muted)",
													flexShrink: 0,
												}}
											/>
											<div style={{ flex: 1 }}>
												<div style={{ fontWeight: 600, color: "var(--text-main)" }}>
													{tc.toolName}
												</div>
												<div style={{ color: "var(--text-dim)", fontSize: "11px" }}>
													{tc.args ? JSON.stringify(tc.args).substring(0, 100) : ""}
												</div>
												{tc.status === "done" && (
													<div
														style={{
															color: "var(--success)",
															fontSize: "10px",
															marginTop: "2px",
														}}
													>
														✅ Completado
													</div>
												)}
												{tc.status === "error" && (
													<div
														style={{
															color: "var(--error)",
															fontSize: "10px",
															marginTop: "2px",
														}}
													>
														❌ Falló
													</div>
												)}
												{tc.status === "pending" && (
													<div
														style={{
															color: "var(--warning)",
															fontSize: "10px",
															marginTop: "2px",
														}}
													>
														⏳ Ejecutando...
													</div>
												)}
											</div>
										</div>
									))}
							</div>
						)}

						{/* Feature: auto suggestions */}
						{suggestions.length > 0 && (
							<div
								style={{
									display: "flex",
									flexWrap: "wrap",
									gap: "8px",
									marginTop: "8px",
								}}
							>
								{suggestions.map((s, idx) => (
									<button
										key={idx}
										type="button"
										onClick={() => {
											setInput(s);
											setSuggestions([]);
										}}
										style={{
											background: "rgba(79,140,255,0.08)",
											border: "1px solid rgba(79,140,255,0.2)",
											borderRadius: "16px",
											padding: "6px 14px",
											fontSize: "12px",
											color: "var(--accent)",
											cursor: "pointer",
										}}
									>
										{s}
									</button>
								))}
							</div>
						)}

						{isProcessing && (
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
									<span />
									<span />
									<span />
								</div>
								Pensando...
							</div>
						)}
						<div ref={messagesEndRef} />
					</div>

					{/* Queue bar */}
					{messageQueue.length > 0 && (
						<div
							style={{
								padding: "6px 16px",
								borderTop: "1px solid var(--border-light)",
								display: "flex",
								alignItems: "center",
								gap: "8px",
								fontSize: "11px",
								color: "var(--text-dim)",
							}}
						>
							<span style={{ fontWeight: 600, color: "var(--accent)", whiteSpace: "nowrap" }}>
								{messageQueue.length}/3 mensajes en cola
							</span>
							<div style={{ flex: 1, display: "flex", gap: "4px", overflow: "hidden" }}>
								{messageQueue.map((q, i) => (
									<span
										key={i}
										style={{
											display: "inline-flex",
											alignItems: "center",
											gap: "4px",
											background: "rgba(79,140,255,0.08)",
											border: "1px solid rgba(79,140,255,0.15)",
											borderRadius: "4px",
											padding: "2px 6px",
											fontSize: "10px",
											color: "var(--text-main)",
											maxWidth: "140px",
										}}
									>
										<span
											style={{
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}}
										>
											{q}
										</span>
										<button
											type="button"
											onClick={() =>
												setMessageQueue((prev) => prev.filter((_, idx) => idx !== i))
											}
											style={{
												background: "none",
												border: "none",
												color: "var(--text-muted)",
												cursor: "pointer",
												padding: 0,
												display: "flex",
											}}
											title="Quitar de la cola"
										>
											<X size={10} />
										</button>
									</span>
								))}
							</div>
							<button
								type="button"
								onClick={() => setMessageQueue([])}
								style={{
									background: "rgba(239,68,68,0.08)",
									border: "1px solid rgba(239,68,68,0.15)",
									borderRadius: "4px",
									color: "var(--error)",
									cursor: "pointer",
									padding: "2px 8px",
									fontSize: "10px",
									fontWeight: 600,
									whiteSpace: "nowrap",
								}}
							>
								Vaciar cola
							</button>
						</div>
					)}

					{/* Input */}
					<div
						style={{
							padding: "12px 16px",
							borderTop: messageQueue.length > 0 ? "none" : "1px solid var(--border-light)",
						}}
					>
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
									<div
										key={i}
										style={{
											display: "flex",
											alignItems: "center",
											gap: "4px",
											background: "rgba(79,140,255,0.1)",
											border: "1px solid rgba(79,140,255,0.2)",
											borderRadius: "6px",
											padding: "4px 8px",
											fontSize: "11px",
											color: "var(--accent)",
											maxWidth: "200px",
										}}
									>
										<span
											style={{
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}}
										>
											{att.name}
										</span>
										<button
											type="button"
											onClick={() => removeAttachment(i)}
											title="Eliminar archivo"
											style={{
												background: "none",
												border: "none",
												color: "var(--text-muted)",
												cursor: "pointer",
												padding: "1px",
												display: "flex",
											}}
										>
											<X size={12} />
										</button>
									</div>
								))}
							</div>
						)}

						{/* Feature: reply bar */}
						{replyTo && (
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "8px",
									background: "rgba(79,140,255,0.08)",
									border: "1px solid rgba(79,140,255,0.15)",
									borderRadius: "8px",
									padding: "8px 12px",
									marginBottom: "8px",
									fontSize: "11px",
									color: "var(--text-main)",
								}}
							>
								<Reply size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />
								<span
									style={{
										flex: 1,
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{"Respondiendo a " +
										(replyTo.role === "user" ? "Usuario" : "Asistente") +
										": " +
										replyTo.content.substring(0, 60) +
										"..."}
								</span>
								<button
									type="button"
									onClick={() => setReplyTo(null)}
									style={{
										background: "none",
										border: "none",
										color: "var(--text-muted)",
										cursor: "pointer",
										padding: "2px",
										display: "flex",
									}}
									title="Cancelar respuesta"
								>
									<X size={14} />
								</button>
							</div>
						)}
						<div style={{ display: "flex", gap: "8px", alignItems: "flex-end", position: "relative" }}>
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								style={{
									background: "none",
									border: "1px solid var(--border-light)",
									borderRadius: "8px",
									color: "var(--text-muted)",
									cursor: "pointer",
									padding: "10px",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									flexShrink: 0,
									opacity: isProcessing ? 0.5 : 1,
								}}
								disabled={isProcessing}
								title="Adjuntar archivo"
							>
								<Paperclip size={18} />
							</button>
							<textarea
								ref={inputRef}
								value={input}
								onChange={(e) => {
									const val = e.target.value;
									setInput(val);
									// Detect slash commands
									if (val.startsWith("/")) {
										const filter = val.toLowerCase();
										setCommandFilter(filter);
										setShowCommands(true);
										setSelectedCmdIndex(0);
									} else {
										setShowCommands(false);
									}
								}}
								onKeyDown={handleKeyDown}
								placeholder={
									isProcessing
										? messageQueue.length >= 3
											? "Cola llena (3/3)"
											: "Escribe, se encolará al enviar..."
										: "Pregunta al agente..."
								}
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
								}}
							/>
							{/* Command palette dropdown */}
							{showCommands && (
								<div
									style={{
										position: "absolute",
										bottom: "100%",
										left: 0,
										right: 0,
										background: "var(--bg-surface)",
										border: "1px solid var(--border-light)",
										borderRadius: "8px",
										boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
										overflow: "hidden",
										zIndex: 100,
									}}
								>
									{COMMANDS.filter((c) => c.cmd.includes(commandFilter) || commandFilter === "/").map(
										(c, i) => (
											<div
												key={c.cmd}
												onClick={() => {
													executeCommand(c.cmd);
												}}
												style={{
													padding: "8px 12px",
													cursor: "pointer",
													fontSize: "12px",
													background:
														i === selectedCmdIndex ? "rgba(79,140,255,0.1)" : "transparent",
													color: "var(--text-main)",
													borderBottom: "1px solid var(--border-light)",
													display: "flex",
													justifyContent: "space-between",
													gap: "12px",
												}}
												onMouseEnter={() => setSelectedCmdIndex(i)}
											>
												<span style={{ fontWeight: 600, color: "var(--accent)" }}>{c.cmd}</span>
												<span style={{ color: "var(--text-dim)", fontSize: "11px" }}>
													{c.desc}
												</span>
											</div>
										)
									)}
								</div>
							)}
							<button
								type="button"
								onClick={handleSend}
								disabled={!input.trim() || (isProcessing && messageQueue.length >= 3)}
								title={
									isProcessing && messageQueue.length >= 3
										? "Máximo 3 mensajes en cola"
										: "Enviar mensaje"
								}
								style={{
									padding: "10px 16px",
									background: "linear-gradient(135deg, var(--accent), #7c3aed)",
									border: "none",
									borderRadius: "8px",
									color: "white",
									cursor:
										!input.trim() || (isProcessing && messageQueue.length >= 3)
											? "not-allowed"
											: "pointer",
									opacity: !input.trim() || (isProcessing && messageQueue.length >= 3) ? 0.5 : 1,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Send size={18} />
							</button>
						</div>
					</div>

					{/* Footer stats */}
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							padding: "4px 16px",
							borderTop: "1px solid var(--border-light)",
							fontSize: "9px",
							color: "var(--text-dim)",
						}}
					>
						<span>
							Tokens: {totalPromptTokens + totalCompletionTokens} ({"⏳"} {totalPromptTokens}{" "}
							{"▽"} {totalCompletionTokens})
						</span>
						<span>{new Date().toLocaleTimeString()}</span>
					</div>
				</div>

				{/* Chat Sidebar (right) */}
				{chatSidebarOpen && (
					<div
						style={{
							width: "260px",
							borderLeft: "1px solid var(--border-light)",
							display: "flex",
							flexDirection: "column",
							overflow: "hidden",
							flexShrink: 0,
						}}
					>
						<div style={{ padding: "12px", borderBottom: "1px solid var(--border-light)" }}>
							<div style={{ display: "flex", gap: "6px" }}>
								<div
									style={{
										flex: 1,
										display: "flex",
										alignItems: "center",
										gap: "6px",
										background: "rgba(255,255,255,0.03)",
										border: "1px solid var(--border-light)",
										borderRadius: "6px",
										padding: "6px 10px",
									}}
								>
									<Search size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
									<input
										type="text"
										value={chatSearch}
										onChange={(e) => setChatSearch(e.target.value)}
										placeholder="Buscar chat..."
										style={{
											background: "none",
											border: "none",
											color: "var(--text-main)",
											fontSize: "11px",
											fontFamily: "inherit",
											outline: "none",
											width: "100%",
										}}
									/>
								</div>
								<button
									type="button"
									onClick={handleNewChat}
									style={{
										background: "rgba(79,140,255,0.1)",
										border: "1px solid rgba(79,140,255,0.2)",
										borderRadius: "6px",
										color: "var(--accent)",
										cursor: "pointer",
										padding: "6px 8px",
										display: "flex",
										alignItems: "center",
									}}
									title="Nuevo chat"
								>
									<Plus size={14} />
								</button>
							</div>
						</div>
						<div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
							{pinnedChats.length > 0 && (
								<>
									<div
										style={{
											fontSize: "10px",
											fontWeight: 600,
											color: "var(--text-muted)",
											padding: "4px 8px",
											textTransform: "uppercase",
											letterSpacing: "1px",
										}}
									>
										Fijados
									</div>
									{pinnedChats.map((chat) => renderChatItem(chat))}
									<div style={{ height: "8px" }} />
								</>
							)}
							{telegramChats.length > 0 && (
								<>
									<div
										style={{
											fontSize: "10px",
											fontWeight: 600,
											color: "var(--text-muted)",
											padding: "4px 8px",
											textTransform: "uppercase",
											letterSpacing: "1px",
										}}
									>
										📱 Telegram
									</div>
									{telegramChats.map((chat) => renderChatItem(chat))}
									<div style={{ height: "8px" }} />
								</>
							)}
							<div
								style={{
									fontSize: "10px",
									fontWeight: 600,
									color: "var(--text-muted)",
									padding: "4px 8px",
									textTransform: "uppercase",
									letterSpacing: "1px",
								}}
							>
								Recientes
							</div>
							{recentChats.length === 0 && pinnedChats.length === 0 && (
								<div
									style={{
										textAlign: "center",
										padding: "24px",
										color: "var(--text-dim)",
										fontSize: "11px",
									}}
								>
									No hay chats. Crea uno nuevo.
								</div>
							)}
							{recentChats.map((chat) => renderChatItem(chat))}
						</div>
					</div>
				)}
			</div>

			<ConfirmModal
				open={!!confirmDelete}
				title="Eliminar chat"
				message="¿Estás seguro de eliminar este chat? Esta acción no se puede deshacer."
				confirmText="Eliminar"
				onConfirm={() => {
					if (confirmDelete) {
						handleDeleteChat(confirmDelete);
						setConfirmDelete(null);
					}
				}}
				onCancel={() => setConfirmDelete(null)}
				danger
			/>
			<ConfirmModal
				open={confirmClearQueue}
				title="Cancelar y vaciar cola"
				message="Tienes mensajes en cola. ¿Quieres cancelar la respuesta actual y vaciar la cola, o cancelar solo la respuesta actual y mantener la cola?"
				confirmText="Vaciar todo"
				cancelText="Solo cancelar respuesta"
				onConfirm={() => {
					setConfirmClearQueue(false);
					setMessageQueue([]);
					sendWs("cancel", { chatId: currentChatId || "dashboard" });
					setIsProcessing(false);
				}}
				onCancel={() => {
					setConfirmClearQueue(false);
					sendWs("cancel", { chatId: currentChatId || "dashboard" });
					setIsProcessing(false);
				}}
				danger
			/>

			{/* Nueva Tarea Modal */}

			{showNewTaskModal && (
				<div
					style={{
						position: "fixed",
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						background: "rgba(0,0,0,0.7)",
						backdropFilter: "blur(4px)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						zIndex: 1000,
					}}
					onClick={() => setShowNewTaskModal(false)}
				>
					<div
						style={{
							background: "var(--bg-surface)",
							border: "1px solid var(--border)",
							borderRadius: "16px",
							width: "500px",
							maxWidth: "90vw",
							padding: "24px",
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<h3
							style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}
						>
							Nueva Tarea
						</h3>
						<div style={{ marginBottom: "16px" }}>
							<label
								style={{
									fontSize: "10px",
									fontWeight: 600,
									color: "var(--text-muted)",
									textTransform: "uppercase",
									display: "block",
									marginBottom: "4px",
								}}
							>
								Descripción de la tarea
							</label>
							<textarea
								value={newTaskText}
								onChange={(e) => setNewTaskText(e.target.value)}
								placeholder="Describe la tarea a ejecutar..."
								rows={4}
								style={{
									width: "100%",
									background: "rgba(255,255,255,0.03)",
									border: "1px solid var(--border-light)",
									borderRadius: "6px",
									padding: "8px 12px",
									color: "var(--text-main)",
									fontSize: "13px",
									fontFamily: "inherit",
									resize: "vertical",
									outline: "none",
									boxSizing: "border-box",
								}}
							/>
						</div>
						<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
							<button
								type="button"
								onClick={() => {
									setShowNewTaskModal(false);
									setNewTaskText("");
								}}
								style={{
									padding: "8px 20px",
									background: "rgba(255,255,255,0.05)",
									border: "1px solid var(--border-light)",
									borderRadius: "8px",
									color: "var(--text-main)",
									cursor: "pointer",
									fontSize: "12px",
									fontWeight: 600,
								}}
							>
								Cancelar
							</button>
							<button
								type="button"
								onClick={() => {
									if (!newTaskText.trim()) return;
									sendWs("new_task", { text: newTaskText.trim() });
									setNewTaskText("");
									setShowNewTaskModal(false);
									showToast("Tarea enviada", "success");
								}}
								disabled={!newTaskText.trim()}
								style={{
									padding: "8px 20px",
									background: "linear-gradient(135deg, var(--accent), #7c3aed)",
									border: "none",
									borderRadius: "8px",
									color: "white",
									cursor: "pointer",
									fontSize: "12px",
									fontWeight: 600,
									opacity: !newTaskText.trim() ? 0.5 : 1,
								}}
							>
								Crear Tarea
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Feature: image lightbox overlay */}
			{expandedImage && (
				<div
					onClick={() => setExpandedImage(null)}
					style={{
						position: "fixed",
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						background: "rgba(0,0,0,0.85)",
						zIndex: 9999,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						cursor: "pointer",
						padding: "40px",
					}}
				>
					<img
						src={expandedImage}
						alt="Imagen ampliada"
						onClick={(e) => e.stopPropagation()}
						style={{
							maxWidth: "90%",
							maxHeight: "90%",
							borderRadius: "12px",
							objectFit: "contain",
						}}
					/>
				</div>
			)}
		</div>
	);

	// Render Chat Item
	function renderChatItem(chat: ChatEntry) {
		const isActive = chat.id === currentChatId;
		const isRenaming = renamingChat === chat.id;

		return (
			<div
				key={chat.id}
				style={{
					padding: "8px",
					marginBottom: "2px",
					borderRadius: "6px",
					cursor: "pointer",
					background: isActive ? "rgba(79,140,255,0.1)" : "transparent",
					border: isActive ? "1px solid rgba(79,140,255,0.2)" : "1px solid transparent",
					transition: "all 0.15s",
				}}
			>
				{isRenaming ? (
					<div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
						<input
							type="text"
							value={renameValue}
							onChange={(e) => setRenameValue(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleRenameChat(chat.id);
								if (e.key === "Escape") setRenamingChat(null);
							}}
							style={{
								flex: 1,
								background: "rgba(255,255,255,0.05)",
								border: "1px solid var(--accent)",
								borderRadius: "4px",
								padding: "4px 8px",
								color: "var(--text-main)",
								fontSize: "11px",
								fontFamily: "inherit",
								outline: "none",
							}}
						/>
						<button
							type="button"
							onClick={() => handleRenameChat(chat.id)}
							style={{
								background: "rgba(79,140,255,0.1)",
								border: "none",
								borderRadius: "4px",
								color: "var(--accent)",
								cursor: "pointer",
								padding: "4px",
							}}
						>
							<Save size={12} />
						</button>
					</div>
				) : (
					<div onClick={() => handleSwitchChat(chat.id)} style={{ cursor: "pointer" }}>
						<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
							<MessageSquare size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
							<span
								style={{
									fontSize: "12px",
									fontWeight: isActive ? 600 : 400,
									color: "var(--text-main)",
									flex: 1,
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}}
							>
								{chat.title}
							</span>
						</div>
						{chat.lastMessage && (
							<div
								style={{
									fontSize: "10px",
									color: "var(--text-dim)",
									marginLeft: "18px",
									marginTop: "2px",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}}
							>
								{chat.lastMessage}
							</div>
						)}
						{chat.messageCount !== undefined && (
							<div
								style={{
									fontSize: "10px",
									color: "var(--text-dim)",
									marginLeft: "18px",
									marginTop: "2px",
									display: "flex",
									alignItems: "center",
									gap: "4px",
								}}
							>
								<MessageSquare size={9} />
								<span>
									{chat.messageCount} mensaje{chat.messageCount === 1 ? "" : "s"}
								</span>
							</div>
						)}
						{isActive && (
							<div style={{ display: "flex", gap: "2px", marginTop: "4px", marginLeft: "18px" }}>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										setRenamingChat(chat.id);
										setRenameValue(chat.title);
									}}
									style={{
										background: "none",
										border: "none",
										color: "var(--text-muted)",
										cursor: "pointer",
										padding: "2px 4px",
									}}
									title="Renombrar"
								>
									<Edit3 size={10} />
								</button>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										handlePinChat(chat.id);
									}}
									style={{
										background: "none",
										border: "none",
										color: chat.pinned ? "var(--accent)" : "var(--text-muted)",
										cursor: "pointer",
										padding: "2px 4px",
									}}
									title={chat.pinned ? "Desfijar" : "Fijar"}
								>
									{chat.pinned ? <PinOff size={10} /> : <Pin size={10} />}
								</button>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										setConfirmDelete(chat.id);
									}}
									style={{
										background: "none",
										border: "none",
										color: "var(--error)",
										cursor: "pointer",
										padding: "2px 4px",
									}}
									title="Eliminar"
								>
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







