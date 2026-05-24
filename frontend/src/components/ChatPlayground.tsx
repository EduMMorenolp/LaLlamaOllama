import {
	Bot,
	Check,
	ChevronDown,
	Clock,
	Copy,
	Cpu,
	FileText,
	Paperclip,
	RefreshCw,
	Send,
	Settings2,
	Trash2,
	X,
	Zap,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { OllamaModel } from "../types/api";

interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	model?: string;
	timestamp: number;
	latencyMs?: number;
	inputTokens?: number;
	outputTokens?: number;
	isError?: boolean;
}

interface ChatPlaygroundProps {
	models: OllamaModel[];
	onSendMessage: (
		model: string,
		message: string,
		options: Record<string, any>
	) => Promise<any>;
}

interface AttachmentFile {
	id: string;
	name: string;
	type: string;
	size: number;
	content: string;
	truncated: boolean;
}



interface ChatState {
    selectedModel: string;
    message: string;
    history: Message[];
    temperature: number;
    numCtx: number;
    loading: boolean;
    showSettings: boolean;
    totalTokensSession: number;
    totalTimeSession: number;
    attachments: AttachmentFile[];
}

type ChatAction =
    | { type: "SET_SELECTED_MODEL"; payload: string }
    | { type: "SET_MESSAGE"; payload: string }
    | { type: "ADD_MESSAGE"; payload: Message }
    | { type: "UPDATE_LAST_MESSAGE"; payload: Partial<Message> }
    | { type: "SET_HISTORY"; payload: Message[] }
    | { type: "SET_TEMPERATURE"; payload: number }
    | { type: "SET_NUM_CTX"; payload: number }
    | { type: "SET_LOADING"; payload: boolean }
    | { type: "SET_SHOW_SETTINGS"; payload: boolean }
    | { type: "ADD_TOKENS"; payload: number }
    | { type: "ADD_TIME"; payload: number }
    | { type: "SET_ATTACHMENTS"; payload: AttachmentFile[] }
    | { type: "ADD_ATTACHMENT"; payload: AttachmentFile }
    | { type: "REMOVE_ATTACHMENT"; payload: string }
    | { type: "LOAD_PERSISTED"; payload: Partial<ChatState> }
    | { type: "CLEAR_HISTORY" };

function chatReducer(state: ChatState, action: ChatAction): ChatState {
    switch (action.type) {
        case "SET_SELECTED_MODEL": return { ...state, selectedModel: action.payload };
        case "SET_MESSAGE": return { ...state, message: action.payload };
        case "ADD_MESSAGE": return { ...state, history: [...state.history, action.payload] };
        case "UPDATE_LAST_MESSAGE": {
            const h = [...state.history];
            if (h.length > 0) h[h.length - 1] = { ...h[h.length - 1], ...action.payload };
            return { ...state, history: h };
        }
        case "SET_HISTORY": return { ...state, history: action.payload };
        case "SET_TEMPERATURE": return { ...state, temperature: action.payload };
        case "SET_NUM_CTX": return { ...state, numCtx: action.payload };
        case "SET_LOADING": return { ...state, loading: action.payload };
        case "SET_SHOW_SETTINGS": return { ...state, showSettings: action.payload };
        case "ADD_TOKENS": return { ...state, totalTokensSession: state.totalTokensSession + action.payload };
        case "ADD_TIME": return { ...state, totalTimeSession: state.totalTimeSession + action.payload };
        case "SET_ATTACHMENTS": return { ...state, attachments: action.payload };
        case "ADD_ATTACHMENT": return { ...state, attachments: [...state.attachments, action.payload] };
        case "REMOVE_ATTACHMENT": return { ...state, attachments: state.attachments.filter(a => a.id !== action.payload) };
        case "LOAD_PERSISTED": return { ...state, ...action.payload };
        case "CLEAR_HISTORY": return { ...state, history: [], totalTokensSession: 0, totalTimeSession: 0 };
        default: return state;
    }
}
const MAX_ATTACHMENT_SIZE_BYTES = 512 * 1024;
const MAX_ATTACHMENT_CHARS = 12000;
const MAX_ATTACHMENTS = 4;

function TypingDots() {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 0" }}>
			{[0, 1, 2].map((i) => (
				<span
					key={i}
					style={{
						width: "6px",
						height: "6px",
						borderRadius: "50%",
						background: "var(--accent)",
						animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
						display: "block",
					}}
				/>
			))}
		</div>
	);
}

function formatLatency(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
	return `${(ms / 60000).toFixed(1)}m`;
}

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	const handleCopy = () => {
		navigator.clipboard.writeText(text).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	};
	return (
		<button
			type="button"
			onClick={handleCopy}
			style={{
				background: "transparent",
				border: "none",
				cursor: "pointer",
				color: copied ? "var(--success)" : "var(--text-muted)",
				padding: "2px 4px",
				borderRadius: "4px",
				display: "flex",
				alignItems: "center",
				gap: "3px",
				fontSize: "10px",
				transition: "color 0.2s",
			}}
		>
			{copied ? <Check size={11} /> : <Copy size={11} />}
			{copied ? "Copiado" : "Copiar"}
		</button>
	);
}

const STORAGE_KEY = "llama-chat-playground";

interface PlaygroundState {
	history: Message[];
	selectedModel: string;
	temperature: number;
	numCtx: number;
	totalTokensSession: number;
	totalTimeSession: number;
}

export const ChatPlayground: React.FC<ChatPlaygroundProps> = ({ models, onSendMessage }) => {
	// Load persisted state from localStorage
	const loadPersistedState = (): Partial<PlaygroundState> => {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			return stored ? JSON.parse(stored) : {};
		} catch {
			return {};
		}
	};

	const persistedState = loadPersistedState();
	const [state, dispatch] = useReducer(chatReducer, {
		selectedModel: persistedState.selectedModel || models[0]?.name || "",
		message: "",
		history: persistedState.history || [],
		temperature: persistedState.temperature ?? 0.7,
		numCtx: persistedState.numCtx ?? 4096,
		loading: false,
		showSettings: false,
		totalTokensSession: persistedState.totalTokensSession ?? 0,
		totalTimeSession: persistedState.totalTimeSession ?? 0,
		attachments: [],
	});

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// ─── PERSIST STATE TO LOCALSTORAGE ────────────────────────
	useEffect(() => {
		const persistState: PlaygroundState = {
			history: state.history,
			selectedModel: state.selectedModel,
			temperature: state.state.temperature,
			numCtx: state.numCtx,
			totalTokensSession: state.totalTokensSession,
			totalTimeSession: state.totalTimeSession,
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(persistState));
	}, [state.history, state.selectedModel, state.state.temperature, state.numCtx, state.totalTokensSession, state.totalTimeSession]);

	// Sync selected model if models load after component
	useEffect(() => {
		if (!state.selectedModel && models.length > 0) dispatch({ type: "SET_SELECTED_MODEL", payload: models[0].name });
	}, [models, state.selectedModel]);

	// Auto-scroll
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	// Auto-resize textarea
	const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		dispatch({ type: "SET_MESSAGE", payload: e.target.value });
		const ta = textareaRef.current;
		if (ta) {
			ta.style.height = "auto";
			ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
		}
	};

	const handleSend = useCallback(async () => {
		if ((!state.message.trim() && state.attachments.length === 0) || state.loading || !state.selectedModel) return;

		const attachmentSummary = state.attachments.length
			? `\n\n[Adjuntos: ${state.attachments.map((f) => f.name).join(", ")}]`
			: "";
		const baseMessage = state.message.trim() || "Analiza los archivos adjuntos y responde en espanol.";
		const attachmentPayload = state.attachments.length
			? `\n\n=== ARCHIVOS ADJUNTOS ===\n${state.attachments
					.map(
						(file, index) =>
							`Archivo ${index + 1}: ${file.name}\nTipo: ${file.type || "text/plain"}\nTamano: ${file.size} bytes${file.truncated ? " (truncado)" : ""}\nContenido:\n${file.content}`
					)
					.join("\n\n---\n\n")}`
			: "";
		const promptWithAttachments = `${baseMessage}${attachmentPayload}`;

		const id = Math.random().toString(36).slice(2);
		const userMsg: Message = {
			id,
			role: "user",
			content: `${baseMessage}${attachmentSummary}`,
			timestamp: Date.now(),
		};

		dispatch({ type: "ADD_MESSAGE", payload: userMsg });
		dispatch({ type: "SET_MESSAGE", payload: "" });
		dispatch({ type: "SET_ATTACHMENTS", payload: [] });
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
		dispatch({ type: "SET_LOADING", payload: true });

		const start = Date.now();
		const assistantId = Math.random().toString(36).slice(2);

		try {
			const response = await onSendMessage(state.selectedModel, promptWithAttachments, {
				temperature: state.temperature,
				num_ctx: state.numCtx,
			});

			if (response.isStream) {
				// Streaming mode: add assistant message and update as tokens arrive
				const assistantMsg: Message = {
					id: assistantId,
					role: "assistant",
					content: "", // Start empty, will update
					model: state.selectedModel,
					timestamp: Date.now(),
					latencyMs: 0,
					inputTokens: 0,
					outputTokens: 0,
				};
				dispatch({ type: "ADD_MESSAGE", payload: assistantMsg });

				// Consume the async generator
				let fullContent = "";
				if (response.stream) {
					for await (const chunk of response.stream) {
						fullContent = chunk.full_content;
						dispatch({ type: "UPDATE_LAST_MESSAGE", payload: { content: fullContent } });
					}
				}

				// Update with final stats
				const latencyMs = Date.now() - start;
				const inputTok = response.prompt_eval_count || 0;
				const outputTok = response.eval_count || 0;

				dispatch({ type: "UPDATE_LAST_MESSAGE", payload: { latencyMs, inputTokens: inputTok, outputTokens: outputTok } });

				dispatch({ type: "ADD_TOKENS", payload: inputTok + outputTok });
				dispatch({ type: "ADD_TIME", payload: latencyMs });
			} else {
				// Non-streaming mode (fallback)
				const latencyMs = Date.now() - start;
				const inputTok = response.prompt_eval_count || 0;
				const outputTok = response.eval_count || 0;

				const assistantMsg: Message = {
					id: assistantId,
					role: "assistant",
					content: response.content || response.message?.content || response.text || "",
					model: state.selectedModel,
					timestamp: Date.now(),
					latencyMs,
					inputTokens: inputTok,
					outputTokens: outputTok,
				};

				dispatch({ type: "ADD_MESSAGE", payload: assistantMsg });
				dispatch({ type: "ADD_TOKENS", payload: inputTok + outputTok });
				dispatch({ type: "ADD_TIME", payload: latencyMs });
			}
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : "Sin respuesta del servidor";
			dispatch({ type: "ADD_MESSAGE", payload: {
				id: Math.random().toString(36).slice(2),
				role: "assistant",
				content: `Error: ${errorMessage}`,
				model: state.selectedModel,
				timestamp: Date.now(),
				latencyMs: Date.now() - start,
				isError: true,
			} });
		} finally {
			dispatch({ type: "SET_LOADING", payload: false });
		}
	}, [state.message, state.attachments, state.loading, state.selectedModel, state.state.temperature, state.numCtx, onSendMessage]);

	const handlePickFiles = () => {
		fileInputRef.current?.click();
	};

	const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const picked = Array.from(e.target.files || []);
		if (picked.length === 0) return;

		const remainingSlots = Math.max(0, MAX_ATTACHMENTS - state.attachments.length);
		const filesToProcess = picked.slice(0, remainingSlots);
		const loadedFiles: AttachmentFile[] = [];

		for (const file of filesToProcess) {
			if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
				continue;
			}

			try {
				const text = await file.text();
				const truncated = text.length > MAX_ATTACHMENT_CHARS;
				loadedFiles.push({
					id: Math.random().toString(36).slice(2),
					name: file.name,
					type: file.type,
					size: file.size,
					content: truncated ? text.slice(0, MAX_ATTACHMENT_CHARS) : text,
					truncated,
				});
			} catch {
				// Ignore unreadable files and continue with the rest.
			}
		}

		if (loadedFiles.length > 0) {
			dispatch({ type: "SET_ATTACHMENTS", payload: [...state.attachments, ...loadedFiles] });
		}

		e.target.value = "";
	};

	const removeAttachment = (id: string) => {
		dispatch({ type: "REMOVE_ATTACHMENT", payload: id });
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const clearChat = () => {
		dispatch({ type: "CLEAR_HISTORY" });
		// Clear persisted state
		localStorage.removeItem(STORAGE_KEY);
	};

	const modelShortName = state.selectedModel.split(":")[0] || state.selectedModel;

	// Suggestions for empty state
	const suggestions = [
		"¿Qué puedes hacer?",
		"Explica la diferencia entre LLaMA y Mistral",
		"Escribe un script Python para leer un CSV",
		"Resume el concepto de cuantizacion de modelos",
	];

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				height: "calc(100vh - 160px)",
				minHeight: "500px",
				gap: 0,
			}}
		>
			<style>{`
                @keyframes typing-dot {
                    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                    30% { transform: translateY(-6px); opacity: 1; }
                }
                .chat-msg-user { display: flex; justify-content: flex-end; padding: 6px 0; }
                .chat-msg-bot { display: flex; justify-content: flex-start; padding: 6px 0; }
                .bubble-user {
                    max-width: 72%; background: var(--accent);
                    color: white; padding: 12px 16px; border-radius: 18px 18px 4px 18px;
                    font-size: 14px; line-height: 1.6; word-break: break-word;
                    box-shadow: 0 4px 20px rgba(79,140,255,0.3);
                }
                .bubble-bot {
                    max-width: 80%; background: rgba(255,255,255,0.04);
                    border: 1px solid var(--border-light);
                    padding: 14px 16px; border-radius: 4px 18px 18px 18px;
                    font-size: 14px; line-height: 1.7; word-break: break-word;
                }
                .bubble-error { border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.06); }
                .playground-textarea {
                    width: 100%; background: transparent; border: none; outline: none; resize: none;
                    color: var(--text-main); font-size: 14px; line-height: 1.6; font-family: inherit;
                    min-height: 24px; max-height: 160px; overflow-y: auto;
                }
                .playground-textarea::placeholder { color: var(--text-muted); }
                .msg-footer-bar { display: flex; align-items: center; gap: 12px; margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.05); flex-wrap: wrap; }
                .msg-meta { font-size: 10px; color: var(--text-muted); display: flex; align-items: center; gap: 3px; }
                .model-selector-dropdown {
                    background: rgba(255,255,255,0.04); border: 1px solid var(--border-light);
                    color: var(--text-main); border-radius: 8px; padding: 6px 10px 6px 12px;
                    font-size: 12px; font-weight: 700; cursor: pointer; outline: none;
                    appearance: none; min-width: 160px;
                }
				.markdown-content {
					color: var(--text-main);
					line-height: 1.75;
				}
				.markdown-content p { margin: 0 0 12px 0; }
				.markdown-content p:last-child { margin-bottom: 0; }
				.markdown-content h1,
				.markdown-content h2,
				.markdown-content h3,
				.markdown-content h4 {
					margin: 14px 0 10px;
					line-height: 1.3;
					font-weight: 800;
				}
				.markdown-content h1 { font-size: 21px; }
				.markdown-content h2 { font-size: 18px; }
				.markdown-content h3 { font-size: 16px; }
				.markdown-content h4 { font-size: 14px; }
				.markdown-content ul,
				.markdown-content ol {
					margin: 0 0 12px 0;
					padding-left: 22px;
				}
				.markdown-content li { margin-bottom: 6px; }
				.markdown-content blockquote {
					margin: 0 0 12px 0;
					border-left: 3px solid rgba(79,140,255,0.45);
					padding: 8px 12px;
					background: rgba(79,140,255,0.08);
					border-radius: 0 8px 8px 0;
					color: var(--text-dim);
				}
				.markdown-content code {
					font-family: var(--font-mono, monospace);
					font-size: 12px;
					background: rgba(0,0,0,0.28);
					border: 1px solid rgba(255,255,255,0.08);
					border-radius: 6px;
					padding: 2px 6px;
				}
				.markdown-content pre {
					margin: 0 0 12px 0;
					background: rgba(0,0,0,0.42);
					border: 1px solid rgba(255,255,255,0.1);
					border-radius: 10px;
					padding: 12px;
					overflow-x: auto;
				}
				.markdown-content pre code {
					background: transparent;
					border: none;
					border-radius: 0;
					padding: 0;
					display: block;
					white-space: pre;
				}
				.markdown-content a {
					color: var(--accent);
					text-decoration: underline;
					text-underline-offset: 2px;
				}
				.markdown-content hr {
					border: none;
					border-top: 1px solid rgba(255,255,255,0.12);
					margin: 16px 0;
				}
				.markdown-content table {
					width: 100%;
					border-collapse: collapse;
					margin: 0 0 12px 0;
					font-size: 12px;
					background: rgba(255,255,255,0.02);
					border: 1px solid rgba(255,255,255,0.12);
					border-radius: 8px;
					overflow: hidden;
				}
				.markdown-content th,
				.markdown-content td {
					border: 1px solid rgba(255,255,255,0.08);
					padding: 8px 10px;
					text-align: left;
					vertical-align: top;
				}
				.markdown-content th {
					background: rgba(255,255,255,0.06);
					font-weight: 700;
				}
            `}</style>

			{/* ── HEADER ────────────────────────────────────── */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "12px",
					padding: "14px 20px",
					background: "rgba(255,255,255,0.02)",
					borderBottom: "1px solid var(--border-light)",
					flexShrink: 0,
					borderRadius: "12px 12px 0 0",
				}}
			>
				{/* Avatar del modelo */}
				<div
					style={{
						width: "38px",
						height: "38px",
						borderRadius: "10px",
						flexShrink: 0,
						background: state.loading ? "rgba(79,140,255,0.15)" : "rgba(79,140,255,0.1)",
						border: `1px solid ${state.loading ? "var(--accent)" : "rgba(79,140,255,0.2)"}`,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						transition: "all 0.3s ease",
						boxShadow: state.loading ? "0 0 20px rgba(79,140,255,0.3)" : "none",
					}}
				>
					{state.loading ? (
						<RefreshCw size={18} style={{ color: "var(--accent)", animation: "spin 1s linear infinite" }} />
					) : (
						<Bot size={18} style={{ color: "var(--accent)" }} />
					)}
				</div>

				{/* Info del modelo */}
				<div style={{ flex: 1, minWidth: 0 }}>
					<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
						<h3
							style={{
								fontSize: "14px",
								fontWeight: 800,
								color: "var(--text-main)",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{modelShortName || "Sin modelo"}
						</h3>
						<span
							style={{
								fontSize: "9px",
								padding: "2px 8px",
								borderRadius: "4px",
								fontWeight: 800,
								letterSpacing: "1px",
								background: state.loading ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.1)",
								color: state.loading ? "#f59e0b" : "var(--success)",
								border: `1px solid ${state.loading ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.2)"}`,
							}}
						>
							{state.loading ? "PROCESANDO..." : "LISTO"}
						</span>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "2px" }}>
						{state.loading ? (
							<TypingDots />
						) : (
							<span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
								Inferencia via Ollama local
							</span>
						)}
					</div>
				</div>

				{/* Stats de sesion */}
				{state.totalTokensSession > 0 && (
					<div style={{ display: "flex", gap: "16px", flexShrink: 0 }}>
						<div style={{ textAlign: "center" }}>
							<p
								style={{
									fontSize: "13px",
									fontWeight: 800,
									color: "var(--accent)",
									fontFamily: "var(--font-mono)",
								}}
							>
								{state.totalTokensSession > 1000
									? `${(state.totalTokensSession / 1000).toFixed(1)}K`
									: state.totalTokensSession}
							</p>
							<p
								style={{
									fontSize: "9px",
									color: "var(--text-muted)",
									textTransform: "uppercase",
									letterSpacing: "1px",
								}}
							>
								tokens
							</p>
						</div>
						<div style={{ textAlign: "center" }}>
							<p
								style={{
									fontSize: "13px",
									fontWeight: 800,
									color: "var(--success)",
									fontFamily: "var(--font-mono)",
								}}
							>
								{formatLatency(state.totalTimeSession)}
							</p>
							<p
								style={{
									fontSize: "9px",
									color: "var(--text-muted)",
									textTransform: "uppercase",
									letterSpacing: "1px",
								}}
							>
								sesion
							</p>
						</div>
					</div>
				)}

				{/* Acciones */}
				<div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
					{state.history.length > 0 && (
						<button
							type="button"
							className="btn-icon"
							onClick={clearChat}
							title="Limpiar chat"
							style={{ color: "var(--text-muted)" }}
						>
							<Trash2 size={16} />
						</button>
					)}
					<button
						type="button"
						className="btn-icon"
						onClick={() => dispatch({ type: "SET_SHOW_SETTINGS", payload: !showSettings })}
						style={{ color: state.showSettings ? "var(--accent)" : "var(--text-muted)" }}
						title="Configuracion"
					>
						<Settings2 size={18} />
					</button>
				</div>
			</div>

			{/* ── SETTINGS PANEL ────────────────────────────── */}
			{state.showSettings && (
				<div
					style={{
						padding: "16px 20px",
						background: "rgba(10,10,20,0.95)",
						borderBottom: "1px solid var(--border-light)",
						flexShrink: 0,
						display: "grid",
						gridTemplateColumns: "2fr 1fr 1fr",
						gap: "16px",
						alignItems: "end",
					}}
				>
					<div>
						<label
							htmlFor="chat-model-select"
							style={{
								fontSize: "10px",
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "6px",
								textTransform: "uppercase",
								letterSpacing: "1px",
							}}
						>
							<Cpu size={11} style={{ display: "inline", marginRight: "4px", verticalAlign: "middle" }} />
							Modelo Activo
						</label>
						<select
							id="chat-model-select"
							value={state.selectedModel}
							onChange={(e) => dispatch({ type: "SET_SELECTED_MODEL", payload: e.target.value })}
							className="model-selector-dropdown"
							style={{ width: "100%" }}
						>
							{models.length === 0 ? (
								<option>Sin modelos instalados</option>
							) : (
								models.map((m) => (
									<option key={m.name} value={m.name}>
										{m.name}
									</option>
								))
							)}
						</select>
					</div>
					<div>
						<label
							htmlFor="chat-temp"
							style={{
								fontSize: "10px",
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "6px",
								textTransform: "uppercase",
								letterSpacing: "1px",
							}}
						>
							<Zap size={11} style={{ display: "inline", marginRight: "4px", verticalAlign: "middle" }} />
							Temperatura ({state.temperature})
						</label>
						<input
							id="chat-temp"
							type="range"
							min={0}
							max={2}
							step={0.05}
							value={state.temperature}
							onChange={(e) => dispatch({ type: "SET_TEMPERATURE", payload: parseFloat(e.target.value }))}
							style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }}
						/>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								fontSize: "9px",
								color: "var(--text-muted)",
								marginTop: "2px",
							}}
						>
							<span>Preciso</span>
							<span>Creativo</span>
						</div>
					</div>
					<div>
						<label
							htmlFor="chat-ctx"
							style={{
								fontSize: "10px",
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "6px",
								textTransform: "uppercase",
								letterSpacing: "1px",
							}}
						>
							<Clock
								size={11}
								style={{ display: "inline", marginRight: "4px", verticalAlign: "middle" }}
							/>
							Contexto ({state.numCtx >= 1000 ? `${(numCtx / 1024).toFixed(0)}K` : numCtx})
						</label>
						<select
							id="chat-ctx"
							value={state.numCtx}
							onChange={(e) => dispatch({ type: "SET_NUM_CTX", payload: Number(e.target.value }))}
							className="model-selector-dropdown"
							style={{ width: "100%" }}
						>
							{[2048, 4096, 8192, 16384, 32768, 65536].map((v) => (
								<option key={v} value={v}>
									{v >= 1024 ? `${v / 1024}K` : v} tokens
								</option>
							))}
						</select>
					</div>
				</div>
			)}

			{/* ── MESSAGES ──────────────────────────────────── */}
			<div
				style={{
					flex: 1,
					overflowY: "auto",
					padding: "20px",
					display: "flex",
					flexDirection: "column",
					gap: "4px",
				}}
			>
				{/* Empty state */}
				{state.history.length === 0 && !state.loading && (
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							height: "100%",
							gap: "24px",
						}}
					>
						<div style={{ textAlign: "center", opacity: 0.15 }}>
							<div style={{ fontSize: "48px", marginBottom: "12px" }}>🦙</div>
							<p
								style={{
									fontSize: "13px",
									fontWeight: 700,
									letterSpacing: "2px",
									textTransform: "uppercase",
								}}
							>
								LaLlamaOllama Playground
							</p>
							<p style={{ fontSize: "11px", marginTop: "4px", opacity: 0.7 }}>
								Inferencia local con Ollama
							</p>
						</div>
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "1fr 1fr",
								gap: "8px",
								maxWidth: "520px",
								width: "100%",
							}}
						>
							{suggestions.map((s) => (
								<button
									type="button"
									key={s}
									onClick={() => dispatch({ type: "SET_MESSAGE", payload: s })}
									style={{
										padding: "10px 14px",
										background: "rgba(255,255,255,0.03)",
										border: "1px solid var(--border-light)",
										borderRadius: "10px",
										cursor: "pointer",
										color: "var(--text-dim)",
										fontSize: "11px",
										textAlign: "left",
										lineHeight: "1.4",
										transition: "var(--transition)",
									}}
									onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
									onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--border-light)")}
									onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
									onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-light)")}
								>
									{s}
								</button>
							))}
						</div>
					</div>
				)}

				{/* Messages */}
				{state.history.map((msg) => (
					<div key={msg.id} className={msg.role === "user" ? "chat-msg-user" : "chat-msg-bot"}>
						<div
							className={`${msg.role === "user" ? "bubble-user" : `bubble-bot${msg.isError ? " bubble-error" : ""}`}`}
						>
							{/* Content */}
							{msg.role === "assistant" ? (
								<div className="markdown-content">
									<ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
								</div>
							) : (
								<div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
							)}

							{/* Footer con metadatos */}
							<div className="msg-footer-bar">
								{/* Timestamp */}
								<span className="msg-meta">
									<Clock size={9} />
									{new Date(msg.timestamp).toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit",
										second: "2-digit",
									})}
								</span>

								{/* Latencia - solo en respuestas del bot */}
								{msg.role === "assistant" && msg.latencyMs && (
									<span
										className="msg-meta"
										style={{ color: msg.latencyMs > 10000 ? "#f59e0b" : "var(--text-muted)" }}
									>
										<Zap size={9} />
										{formatLatency(msg.latencyMs)}
									</span>
								)}

								{/* Tokens */}
								{msg.role === "assistant" && (msg.inputTokens || msg.outputTokens) ? (
									<span className="msg-meta">
										💎 {(msg.inputTokens || 0) + (msg.outputTokens || 0)} tokens
										<span style={{ opacity: 0.5, fontSize: "9px" }}>
											({msg.inputTokens}↓ {msg.outputTokens}↑)
										</span>
									</span>
								) : null}

								{/* Modelo */}
								{msg.role === "assistant" && msg.model && (
									<span className="msg-meta" style={{ color: "var(--accent)", opacity: 0.5 }}>
										<Cpu size={9} />
										{msg.model.split(":")[0]}
									</span>
								)}

								{/* Copy button - bot only */}
								{msg.role === "assistant" && (
									<span style={{ marginLeft: "auto" }}>
										<CopyButton text={msg.content} />
									</span>
								)}
							</div>
						</div>
					</div>
				))}

				{/* Typing indicator */}
				{state.loading && (
					<div className="chat-msg-bot">
						<div
							className="bubble-bot"
							style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: "12px" }}
						>
							<TypingDots />
							<span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
								{state.selectedModel.split(":")[0]} esta procesando...
							</span>
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* ── INPUT ─────────────────────────────────────── */}
			<div
				style={{
					padding: "12px 16px",
					flexShrink: 0,
					borderRadius: "0 0 12px 12px",
				}}
			>
				<input
					ref={fileInputRef}
					type="file"
					multiple
					hidden
					onChange={handleFilesSelected}
					accept=".txt,.md,.json,.csv,.ts,.tsx,.js,.jsx,.py,.java,.go,.rs,.css,.html,.xml,.yaml,.yml,.log,text/*"
				/>

				{state.attachments.length > 0 && (
					<div
						style={{
							display: "flex",
							flexWrap: "wrap",
							gap: "8px",
							marginBottom: "10px",
						}}
					>
						{state.attachments.map((file) => (
							<div
								key={file.id}
								style={{
									display: "flex",
									alignItems: "center",
									gap: "6px",
									padding: "6px 8px",
									borderRadius: "8px",
									background: "rgba(79,140,255,0.12)",
									border: "1px solid rgba(79,140,255,0.25)",
									maxWidth: "100%",
								}}
							>
								<FileText size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />
								<span
									style={{
										fontSize: "11px",
										color: "var(--text-main)",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
									title={file.name}
								>
									{file.name}
								</span>
								{file.truncated && (
									<span
										style={{ fontSize: "10px", color: "#f59e0b" }}
										title="Contenido truncado por tamano"
									>
										truncado
									</span>
								)}
								<button
									type="button"
									onClick={() => removeAttachment(file.id)}
									style={{
										background: "transparent",
										border: "none",
										color: "var(--text-muted)",
										cursor: "pointer",
										display: "flex",
										alignItems: "center",
										padding: 0,
									}}
									title="Quitar adjunto"
								>
									<X size={12} />
								</button>
							</div>
						))}
					</div>
				)}

				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "10px",
						background: "rgba(255,255,255,0.04)",
						border: "1px solid var(--border-light)",
						borderRadius: "14px",
						padding: "10px 14px",
						transition: "border-color 0.2s",
					}}
				>
					<textarea
						ref={textareaRef}
						className="playground-textarea"
						placeholder={`Habla con ${modelShortName || "el modelo"}... (⏎ enviar, Shift+⏎ nueva linea)`}
						value={state.message}
						onChange={handleTextareaChange}
						onKeyDown={handleKeyDown}
						rows={1}
						disabled={state.loading || models.length === 0}
					/>
					<button
						type="button"
						onClick={handlePickFiles}
						disabled={state.loading || models.length === 0 || state.attachments.length >= MAX_ATTACHMENTS}
						title={
							state.attachments.length >= MAX_ATTACHMENTS
								? `Maximo ${MAX_ATTACHMENTS} adjuntos por mensaje`
								: "Adjuntar archivo"
						}
						style={{
							width: "36px",
							height: "36px",
							borderRadius: "10px",
							flexShrink: 0,
							background: "rgba(255,255,255,0.06)",
							border: "1px solid var(--border-light)",
							cursor:
								state.loading || models.length === 0 || state.attachments.length >= MAX_ATTACHMENTS
									? "not-allowed"
									: "pointer",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: state.attachments.length > 0 ? "var(--accent)" : "var(--text-muted)",
							transition: "all 0.2s ease",
						}}
					>
						<Paperclip size={16} />
					</button>
					<button
						type="button"
						onClick={handleSend}
						disabled={state.loading || (!state.message.trim() && state.attachments.length === 0) || models.length === 0}
						style={{
							width: "36px",
							height: "36px",
							borderRadius: "10px",
							flexShrink: 0,
							background:
								(!state.message.trim() && state.attachments.length === 0) || state.loading
									? "rgba(255,255,255,0.06)"
									: "var(--accent)",
							border: "none",
							cursor:
								(!state.message.trim() && state.attachments.length === 0) || state.loading ? "not-allowed" : "pointer",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "white",
							transition: "all 0.2s ease",
							boxShadow:
								(state.message.trim() || state.attachments.length > 0) && !state.loading
									? "0 4px 16px rgba(79,140,255,0.4)"
									: "none",
						}}
					>
						{state.loading ? (
							<RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
						) : (
							<Send size={16} />
						)}
					</button>
				</div>

				{/* Model quick selector pill */}
				<div
					style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", paddingLeft: "4px" }}
				>
					<span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Modelo:</span>
					<div style={{ position: "relative", display: "flex", alignItems: "center" }}>
						<select
							value={state.selectedModel}
							onChange={(e) => dispatch({ type: "SET_SELECTED_MODEL", payload: e.target.value })}
							style={{
								background: "rgba(79,140,255,0.1)",
								border: "1px solid rgba(79,140,255,0.3)",
								borderRadius: "6px",
								color: "var(--accent)",
								fontSize: "11px",
								fontWeight: 700,
								padding: "3px 24px 3px 8px",
								cursor: "pointer",
								outline: "none",
								appearance: "none",
							}}
						>
							{models.length === 0 ? (
								<option>Sin modelos</option>
							) : (
								models.map((m) => (
									<option key={m.name} value={m.name}>
										{m.name}
									</option>
								))
							)}
						</select>
						<ChevronDown
							size={10}
							style={{
								position: "absolute",
								right: "6px",
								color: "var(--accent)",
								pointerEvents: "none",
							}}
						/>
					</div>
					<span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
						Adjuntos: {state.attachments.length}/{MAX_ATTACHMENTS}
					</span>
					<span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "auto" }}>
						⌨ Shift+Enter = nueva linea
					</span>
				</div>
			</div>
		</div>
	);
};
