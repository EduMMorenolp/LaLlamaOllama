import {
	AlertCircle,
	Calendar,
	CheckCircle,
	Clock,
	List,
	Loader2,
	Plus,
	X,
	XCircle,
	ChevronDown,
	ChevronRight,
	Tag,
	FileText,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { config } from "../config";
import { useToast } from "../contexts/ToastContext";
import { useWs } from "../contexts/WebSocketContext";

interface Run {
	id: number;
	chatId: string;
	userText: string;
	origin: string;
	status: string;
	model?: string | null;
	resultText?: string | null;
	errorText?: string | null;
	latencyMs?: number | null;
	priority?: string;
	preferred_model?: string | null;
	tags?: string | null;
	due_date?: string | null;
	description?: string | null;
	scheduled_at?: string | null;
	cron_expression?: string | null;
	is_recurring?: number;
	created_at?: string;
	updated_at?: string;
}

interface RunEvent {
	id: number;
	runId: number;
	type: string;
	payload: string;
	created_at?: string;
}

const apiHeaders = { "X-API-Key": config.apiKey };

const ORIGIN_ICONS: Record<string, string> = {
	web: String.fromCodePoint(0x1f310),
	telegram: String.fromCodePoint(0x1f4f1),
	scheduler: String.fromCodePoint(0x23f0),
	tool: String.fromCodePoint(0x1f527),
};

export const Tareas: React.FC = () => {
	const { send: sendWs, subscribe, connected } = useWs();
	const { show: showToast } = useToast();

	const [runs, setRuns] = useState<Run[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedRun, setSelectedRun] = useState<Run | null>(null);
	const [selectedEvents, setSelectedEvents] = useState<RunEvent[]>([]);
	const [detailLoading, setDetailLoading] = useState(false);
	const offsetRef = useRef(0);
	const [hasMore, setHasMore] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [isDraggingOverCancel, setIsDraggingOverCancel] = useState(false);
	const [isDraggingOverBacklog, setIsDraggingOverBacklog] = useState(false);
	const [isDraggingOverQueued, setIsDraggingOverQueued] = useState(false);
	const [isDraggingOverScheduled, setIsDraggingOverScheduled] = useState(false);
	const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
	const [availableModels, setAvailableModels] = useState<string[]>([]);

	// Nueva Tarea modal
	const [showNewTaskModal, setShowNewTaskModal] = useState(false);
	const [newTaskText, setNewTaskText] = useState("");
	const [newTaskInBacklog, setNewTaskInBacklog] = useState(false);
	const [newTaskIsScheduled, setNewTaskIsScheduled] = useState(false);
	const [newTaskScheduledAt, setNewTaskScheduledAt] = useState("");
	const [newTaskPriority, setNewTaskPriority] = useState("medium");
	const [newTaskPreferredModel, setNewTaskPreferredModel] = useState("default");
	const [newTaskTags, setNewTaskTags] = useState("");
	const [newTaskDueDate, setNewTaskDueDate] = useState("");
	const [newTaskDescription, setNewTaskDescription] = useState("");
	// Recurrence state
	const [newTaskIsRecurring, setNewTaskIsRecurring] = useState(false);
	const [recurPreset, setRecurPreset] = useState<"daily" | "weekly" | "monthly" | "custom">("daily");
	const [recurHour, setRecurHour] = useState("09");
	const [recurMinute, setRecurMinute] = useState("00");
	const [recurWeekDays, setRecurWeekDays] = useState<string[]>(["1"]); // Mon by default
	const [recurMonthDay, setRecurMonthDay] = useState("1");
	const [recurCustomCron, setRecurCustomCron] = useState("");

	// Editar Tarea properties (Notion style detail editor)
	const [editTitle, setEditTitle] = useState("");
	const [editDescription, setEditDescription] = useState("");
	const [editPriority, setEditPriority] = useState("");
	const [editModel, setEditModel] = useState("");
	const [editTags, setEditTags] = useState("");
	const [editDueDate, setEditDueDate] = useState("");
	const [editScheduledAt, setEditScheduledAt] = useState("");

	// Fetch runs (history)
	const fetchRuns = useCallback(
		async (append = false) => {
			try {
				const currentOffset = append ? offsetRef.current : 0;
				const params = new URLSearchParams();
				params.set("limit", "100");
				params.set("offset", String(currentOffset));
				const res = await fetch(`${config.engineUrl}/api/runs?${params}`, { headers: apiHeaders });
				if (!res.ok) {
					throw new Error(`Error HTTP ${res.status}: ${res.statusText}`);
				}
				const data = await res.json();
				const newRuns = data.runs || [];
				if (append) {
					setRuns((prev) => [...prev, ...newRuns]);
				} else {
					setRuns(newRuns);
				}
				offsetRef.current = currentOffset + newRuns.length;
				setHasMore(newRuns.length === 100);
			} catch (err) {
				console.error("Failed to fetch runs", err);
			} finally {
				setLoading(false);
				setLoadingMore(false);
			}
		},
		[]
	);

	useEffect(() => {
		setLoading(true);
		offsetRef.current = 0;
		setHasMore(true);
		fetchRuns(false);
	}, [fetchRuns]);

	useEffect(() => {
		if (connected) {
			sendWs("list_ollama_models", {});
		}
	}, [connected, sendWs]);

	// WS subscriptions
	useEffect(() => {
		const unsub = subscribe((msg: { type: string; payload?: Record<string, unknown> }) => {
			const p = (msg.payload || {}) as Record<string, unknown>;
			const runId = p.runId != null ? Number(p.runId) : undefined;

			switch (msg.type) {
				case "task_created": {
					const task: Run = {
						id: Number(p.runId),
						chatId: (p.chatId as string) || "",
						userText: (p.text as string) || "",
						origin: (p.origin as string) || "web",
						status: (p.status as string) || "queued",
						model: p.model as string | null | undefined,
						resultText: p.resultText as string | null | undefined,
						latencyMs: p.latencyMs != null ? Number(p.latencyMs) : undefined,
						priority: p.priority as string | undefined,
						preferred_model: p.preferredModel as string | null | undefined,
						tags: p.tags as string | null | undefined,
						due_date: p.dueDate as string | null | undefined,
						description: p.description as string | null | undefined,
						scheduled_at: p.scheduledAt as string | null | undefined,
					};
					setRuns((prev) => {
						if (prev.some((r) => r.id === task.id)) return prev; // dedup
						return [task, ...prev];
					});
					showToast("Nueva tarea creada", "success");
					break;
				}
				case "ollama_models": {
					const models = (p.models as Array<{ name: string }>) || [];
					setAvailableModels(models.map((m) => m.name));
					break;
				}
				case "task_updated": {
					if (runId != null && p.run) {
						const updatedTask = p.run as Run;
						setRuns((prev) =>
							prev.map((r) => (r.id === runId ? { ...r, ...updatedTask } : r))
						);
						setSelectedRun((current) => {
							if (current && current.id === runId) {
								setEditTitle(updatedTask.userText || "");
								setEditDescription(updatedTask.description || "");
								setEditPriority(updatedTask.priority || "medium");
								setEditModel(updatedTask.preferred_model || "default");
								setEditTags(updatedTask.tags || "");
								setEditDueDate(updatedTask.due_date || "");
								setEditScheduledAt(updatedTask.scheduled_at || "");
								return { ...current, ...updatedTask };
							}
							return current;
						});
						showToast(`Tarea #${runId} actualizada`, "success");
					}
					break;
				}
				case "task_status":
				case "task_completed":
				case "task_failed": {
					const status = p.status as string | undefined;
					if (runId != null && status) {
						setRuns((prev) => {
							const exists = prev.find((r) => r.id === runId);
							if (exists) {
								// Update existing entry with ALL available fields
								return prev.map((r) =>
									r.id === runId
										? {
												...r,
												status,
												...(p.model != null ? { model: p.model as string } : {}),
												...(p.resultText != null ? { resultText: p.resultText as string } : {}),
												...(p.latencyMs != null ? { latencyMs: Number(p.latencyMs) } : {}),
												...(p.error != null ? { errorText: p.error as string } : {}),
											}
										: r,
								);
							}
							// Task not in list yet (e.g. from tool/scheduler) — create entry
							return [
								{
									id: runId,
									chatId: (p.chatId as string) || "",
									userText: (p.text as string) || "",
									origin: (p.origin as string) || "tool",
									status,
									model: p.model as string | null | undefined,
									resultText: p.resultText as string | null | undefined,
									errorText: p.error as string | null | undefined,
									latencyMs: p.latencyMs != null ? Number(p.latencyMs) : undefined,
								},
								...prev,
							];
						});
						if (status === "completed" || status === "failed") {
							showToast(
								`Tarea #${runId} ${status === "completed" ? "completada" : "falló"}`,
								status === "completed" ? "success" : "error",
							);
						}
					}
					break;
				}
				case "task_cancelled": {
					if (runId != null) {
						setRuns((prev) =>
							prev.map((r) => (r.id === Number(runId) ? { ...r, status: "cancelled" } : r)),
						);
						showToast("Tarea cancelada", "info");
					}
					break;
				}
			}
		});
		return () => {
			unsub();
		};
	}, [subscribe, showToast]);

	const openDetail = async (run: Run) => {
		setSelectedRun(run);
		setEditTitle(run.userText || "");
		setEditDescription(run.description || "");
		setEditPriority(run.priority || "medium");
		setEditModel(run.preferred_model || "default");
		setEditTags(run.tags || "");
		setEditDueDate(run.due_date || "");
		setEditScheduledAt(run.scheduled_at || "");
		setDetailLoading(true);
		try {
			const res = await fetch(`${config.engineUrl}/api/runs/${run.id}`, { headers: apiHeaders });
			const data = await res.json();
			setSelectedEvents(data.events || []);
		} catch {
			setSelectedEvents([]);
		} finally {
			setDetailLoading(false);
		}
	};

	const handleCancelTask = (runId: number) => {
		const ok = sendWs("cancel_task", { runId });
		if (ok) {
			showToast("Cancelando tarea...", "info");
		} else {
			showToast("Error: No hay conexión WebSocket.", "error");
		}
	};

	const handleStartTask = (runId: number) => {
		const ok = sendWs("start_task", { runId });
		if (ok) {
			showToast("Iniciando tarea...", "info");
		} else {
			showToast("Error: No hay conexión WebSocket.", "error");
		}
	};

	const handleMoveToBacklog = (runId: number) => {
		const ok = sendWs("move_to_backlog", { runId });
		if (ok) {
			showToast("Moviendo a Backlog...", "info");
		} else {
			showToast("Error: No hay conexión WebSocket.", "error");
		}
	};

	const buildCronExpression = (): string => {
		const h = recurHour.padStart(2, "0");
		const m = recurMinute.padStart(2, "0");
		switch (recurPreset) {
			case "daily":
				return `${m} ${h} * * *`;
			case "weekly": {
				const days = recurWeekDays.length > 0 ? recurWeekDays.join(",") : "1";
				return `${m} ${h} * * ${days}`;
			}
			case "monthly":
				return `${m} ${h} ${recurMonthDay} * *`;
			case "custom":
				return recurCustomCron.trim();
			default:
				return `${m} ${h} * * *`;
		}
	};

	const resetNewTaskModal = () => {
		setNewTaskText("");
		setNewTaskInBacklog(false);
		setNewTaskIsScheduled(false);
		setNewTaskScheduledAt("");
		setNewTaskPriority("medium");
		setNewTaskPreferredModel("default");
		setNewTaskTags("");
		setNewTaskDueDate("");
		setNewTaskDescription("");
		setNewTaskIsRecurring(false);
		setRecurPreset("daily");
		setRecurHour("09");
		setRecurMinute("00");
		setRecurWeekDays(["1"]);
		setRecurMonthDay("1");
		setRecurCustomCron("");
	};

	const handleNewTask = () => {
		if (!newTaskText.trim()) return;
		const isRecurring = newTaskIsScheduled && newTaskIsRecurring;
		const cronExpression = isRecurring ? buildCronExpression() : undefined;
		const status = newTaskIsScheduled ? "scheduled" : (newTaskInBacklog ? "backlog" : "queued");
		const scheduledAt = newTaskIsScheduled && newTaskScheduledAt && !isRecurring
			? new Date(newTaskScheduledAt).toISOString()
			: newTaskIsScheduled && newTaskScheduledAt && isRecurring
				? new Date(newTaskScheduledAt).toISOString()
				: null;
		const ok = sendWs("new_task", {
			text: newTaskText.trim(),
			backlog: newTaskInBacklog,
			status,
			scheduledAt,
			priority: newTaskPriority,
			preferredModel: newTaskPreferredModel === "default" ? null : newTaskPreferredModel,
			tags: newTaskTags.trim() ? newTaskTags.trim() : null,
			dueDate: newTaskDueDate || null,
			description: newTaskDescription.trim() ? newTaskDescription.trim() : null,
			isRecurring,
			cronExpression: cronExpression || null,
		});
		resetNewTaskModal();
		setShowNewTaskModal(false);
		if (ok) {
			showToast("Tarea enviada", "success");
		} else {
			showToast("Error: No hay conexión WebSocket. Verifica la conexión.", "error");
		}
	};

	const renderCard = (run: Run, canCancel: boolean) => {
		const priorityColors: Record<string, { bg: string; text: string; label: string }> = {
			low: { bg: "rgba(255, 255, 255, 0.05)", text: "#a0a0a0", label: "Baja" },
			medium: { bg: "rgba(79, 140, 255, 0.1)", text: "var(--accent)", label: "Media" },
			high: { bg: "rgba(245, 158, 11, 0.15)", text: "#f59e0b", label: "Alta" },
			urgent: { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444", label: "Urgente" },
		};

		const prio = run.priority || "medium";
		const pColor = priorityColors[prio] || priorityColors.medium;

		// Tags parsing
		const tagList = run.tags
			? run.tags
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean)
			: [];

		// Due date evaluation
		let isOverdue = false;
		if (run.due_date && run.status !== "completed") {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const due = new Date(run.due_date);
			due.setHours(0, 0, 0, 0);
			isOverdue = due < today;
		}

		// Scheduled date evaluation
		let isPastScheduled = false;
		if (run.scheduled_at && run.status === "scheduled") {
			const now = new Date();
			const sched = new Date(run.scheduled_at);
			isPastScheduled = sched < now;
		}

		return (
			<div
				key={run.id}
				onClick={() => openDetail(run)}
				draggable={true}
				onDragStart={(e) => {
					e.dataTransfer.setData("text/plain", run.id.toString());
				}}
				style={{
					padding: "12px",
					borderRadius: "10px",
					background: "rgba(255,255,255,0.02)",
					border: "1px solid var(--border-light)",
					cursor: "grab",
					transition: "all 0.15s ease",
					position: "relative",
					display: "flex",
					flexDirection: "column",
					gap: "8px",
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.borderColor = "var(--accent-glow)";
					e.currentTarget.style.background = "rgba(255,255,255,0.04)";
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.borderColor = "var(--border-light)";
					e.currentTarget.style.background = "rgba(255,255,255,0.02)";
				}}
			>
				{/* Top line: Task ID & Priority */}
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
					<span style={{ fontSize: "9px", fontWeight: 700, color: "var(--text-dim)" }}>
						#{run.id}
					</span>
					<span
						style={{
							fontSize: "9px",
							fontWeight: 600,
							padding: "2px 6px",
							borderRadius: "4px",
							background: pColor.bg,
							color: pColor.text,
						}}
					>
						{pColor.label}
					</span>
				</div>

				{/* Title / User text */}
				<div
					style={{
						fontSize: "11px",
						fontWeight: 600,
						color: "var(--text-main)",
						wordBreak: "break-word",
						lineHeight: "1.4",
						display: "-webkit-box",
						WebkitLineClamp: 3,
						WebkitBoxOrient: "vertical",
						overflow: "hidden",
					}}
					title={run.userText}
				>
					{run.userText || "(sin texto)"}
				</div>

				{/* Preferred Model & Description flag */}
				{(run.preferred_model || run.description) && (
					<div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
						{run.preferred_model && run.preferred_model !== "default" && (
							<span
								title="Modelo preferido"
								style={{
									fontSize: "9px",
									fontFamily: "var(--font-mono)",
									color: "var(--text-dim)",
									background: "rgba(255,255,255,0.04)",
									padding: "1px 5px",
									borderRadius: "3px",
									display: "inline-flex",
									alignItems: "center",
									gap: "3px",
								}}
							>
								🤖 {run.preferred_model.split("/").pop()}
							</span>
						)}
						{run.description && (
							<span
								title="Tiene descripción detallada"
								style={{
									display: "inline-flex",
									color: "var(--text-muted)",
								}}
							>
								<FileText size={10} />
							</span>
						)}
					</div>
				)}

				{/* Due date & Tags */}
				{(run.due_date || run.scheduled_at || tagList.length > 0) && (
					<div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "2px" }}>
						{run.is_recurring && run.cron_expression && (
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "4px",
									fontSize: "9px",
									color: "#a78bfa",
									fontWeight: 600,
									background: "rgba(167, 139, 250, 0.1)",
									padding: "2px 6px",
									borderRadius: "4px",
									border: "1px solid rgba(167, 139, 250, 0.2)",
								}}
							>
								🔁 Recurrente
								<span style={{ opacity: 0.7, fontFamily: "var(--font-mono)" }}>{run.cron_expression}</span>
							</div>
						)}
						{run.scheduled_at && (
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "4px",
									fontSize: "9px",
									color: isPastScheduled ? "var(--warning)" : "var(--accent)",
									fontWeight: 600,
								}}
							>
								<Clock size={10} />
								<span>Ejecución: {new Date(run.scheduled_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
							</div>
						)}
						{run.due_date && (
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "4px",
									fontSize: "9px",
									color: isOverdue ? "var(--error)" : "var(--text-dim)",
									fontWeight: isOverdue ? 600 : 500,
								}}
							>
								<Calendar size={10} />
								<span>Límite: {new Date(run.due_date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
								{isOverdue && <span style={{ fontSize: "8px", textTransform: "uppercase" }}>(Vencida)</span>}
							</div>
						)}
						{tagList.length > 0 && (
							<div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
								{tagList.map((tag, i) => (
									<span
										key={i}
										style={{
											fontSize: "8px",
											fontWeight: 600,
											padding: "1px 5px",
											borderRadius: "3px",
											background: "rgba(255, 255, 255, 0.03)",
											border: "1px solid var(--border-light)",
											color: "var(--text-dim)",
											display: "inline-flex",
											alignItems: "center",
											gap: "2px",
										}}
									>
										<Tag size={6} />
										{tag}
									</span>
								))}
							</div>
						)}
					</div>
				)}

				{/* Card Footer Metadata */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						marginTop: "4px",
						borderTop: "1px solid rgba(255,255,255,0.02)",
						paddingTop: "6px",
						fontSize: "9px",
						color: "var(--text-dim)",
					}}
				>
					<div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
						<span title={run.origin} style={{ fontSize: "11px" }}>
							{ORIGIN_ICONS[run.origin] || `(${run.origin})`}
						</span>
						{run.model && (
							<span
								style={{
									color: "var(--accent)",
									fontFamily: "var(--font-mono)",
								}}
							>
								{run.model.split("/").pop()}
							</span>
						)}
						{run.latencyMs != null && (
							<span>{(run.latencyMs / 1000).toFixed(1)}s</span>
						)}
					</div>

					{canCancel && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								handleCancelTask(run.id);
							}}
							title="Cancelar tarea"
							style={{
								background: "rgba(239,68,68,0.1)",
								border: "1px solid rgba(239,68,68,0.2)",
								borderRadius: "4px",
								color: "var(--error)",
								cursor: "pointer",
								padding: "3px",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<X size={10} />
						</button>
					)}
				</div>
			</div>
		);
	};



	const statusIcon = (status: string) => {
		switch (status) {
			case "completed":
				return <CheckCircle size={14} style={{ color: "var(--success)" }} />;
			case "running":
				return <Loader2 size={14} style={{ color: "var(--accent)" }} className="animate-spin" />;
			case "queued":
				return <Clock size={14} style={{ color: "var(--warning)" }} />;
			case "failed":
				return <XCircle size={14} style={{ color: "var(--error)" }} />;
			case "cancelled":
				return <XCircle size={14} style={{ color: "var(--text-muted)" }} />;
			default:
				return <AlertCircle size={14} style={{ color: "var(--text-muted)" }} />;
		}
	};

	const toLocalDatetimeLocal = (isoString?: string | null) => {
		if (!isoString) return "";
		try {
			const date = new Date(isoString);
			if (Number.isNaN(date.getTime())) return "";
			const offset = date.getTimezoneOffset();
			const localDate = new Date(date.getTime() - offset * 60 * 1000);
			return localDate.toISOString().slice(0, 16);
		} catch {
			return "";
		}
	};

	return (
		<div style={{ height: "calc(100vh - 160px)", display: "flex", flexDirection: "column" }}>
			{/* Tab bar + Nueva Tarea */}
			<div style={{ display: "flex", gap: "8px", padding: "0 0 12px", flexWrap: "wrap", alignItems: "center" }}>
				{/* Connection indicator */}
				<span
					title={connected ? "Conectado" : "Desconectado"}
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: "4px",
						fontSize: "10px",
						color: connected ? "var(--success)" : "var(--error)",
						fontWeight: 600,
					}}
				>
					<span
						style={{
							width: 8,
							height: 8,
							borderRadius: "50%",
							background: connected ? "var(--success)" : "var(--error)",
							display: "inline-block",
						}}
					/>
					{connected ? "Conectado" : "Desconectado"}
				</span>
				<span style={{ flex: 1 }} />
				{hasMore && (
					<button
						type="button"
						disabled={loadingMore}
						onClick={() => {
							setLoadingMore(true);
							fetchRuns(true);
						}}
						style={{
							padding: "6px 14px",
							borderRadius: "6px",
							border: "1px solid rgba(79,140,255,0.2)",
							background: "rgba(79,140,255,0.05)",
							color: "var(--accent)",
							cursor: "pointer",
							fontSize: "11px",
							fontWeight: 600,
							display: "flex",
							alignItems: "center",
							gap: "6px",
							opacity: loadingMore ? 0.6 : 1,
						}}
					>
						{loadingMore ? (
							<Loader2 size={12} className="animate-spin" />
						) : (
							<List size={12} />
						)}
						Cargar más ({runs.length})
					</button>
				)}
				<button
					type="button"
					disabled={!connected}
					onClick={() => setShowNewTaskModal(true)}
					style={{
						padding: "6px 14px",
						borderRadius: "6px",
						border: `1px solid ${connected ? "var(--accent)" : "var(--border-light)"}`,
						background: connected ? "rgba(79,140,255,0.15)" : "rgba(255,255,255,0.02)",
						color: connected ? "var(--accent)" : "var(--text-muted)",
						cursor: connected ? "pointer" : "not-allowed",
						fontSize: "11px",
						fontWeight: 600,
						display: "flex",
						alignItems: "center",
						gap: "6px",
						opacity: connected ? 1 : 0.5,
					}}
				>
					<Plus size={14} />
					Nueva Tarea
				</button>
			</div>

			{/* History tab */}
			<>
					{/* Kanban Board */}
					<div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
						{loading ? (
							<div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", flex: 1 }}>
								<Loader2
									size={24}
									className="animate-spin"
									style={{ margin: "0 auto 12px", display: "block" }}
								/>
								Cargando tareas...
							</div>
						) : runs.length === 0 ? (
							<div
								style={{
									textAlign: "center",
									padding: "40px",
									color: "var(--text-dim)",
									fontSize: "13px",
									flex: 1,
								}}
							>
								No hay tareas en el historial. Crea una nueva tarea para comenzar.
							</div>
						) : (() => {
							const runsByStatus = {
								backlog: runs.filter((r) => r.status === "backlog"),
								queued: runs.filter((r) => r.status === "queued"),
								running: runs.filter((r) => r.status === "running"),
								completed: runs.filter((r) => r.status === "completed"),
								failed: runs.filter((r) => r.status === "failed"),
								scheduled: runs.filter((r) => r.status === "scheduled"),
								cancelled: runs.filter((r) => r.status === "cancelled"),
							};

							const columns: { id: string; label: string; icon: React.ReactNode; color: string; list: Run[] }[] = [
								{
									id: "backlog",
									label: "Backlog",
									icon: <List size={13} style={{ color: "var(--text-muted)" }} />,
									color: "var(--text-muted)",
									list: runsByStatus.backlog,
								},
								{
									id: "scheduled",
									label: "Programadas",
									icon: <Calendar size={13} style={{ color: "var(--accent)" }} />,
									color: "var(--accent)",
									list: runsByStatus.scheduled,
								},
								{
									id: "queued",
									label: "En cola",
									icon: <Clock size={13} style={{ color: "var(--warning)" }} />,
									color: "var(--warning)",
									list: runsByStatus.queued,
								},
								{
									id: "running",
									label: "Ejecutando",
									icon: <Loader2 size={13} style={{ color: "var(--accent)" }} className="animate-spin" />,
									color: "var(--accent)",
									list: runsByStatus.running,
								},
								{
									id: "completed",
									label: "Completado",
									icon: <CheckCircle size={13} style={{ color: "var(--success)" }} />,
									color: "var(--success)",
									list: runsByStatus.completed,
								},
								{
									id: "failed",
									label: "Fallido",
									icon: <XCircle size={13} style={{ color: "var(--error)" }} />,
									color: "var(--error)",
									list: runsByStatus.failed,
								},
								{
									id: "cancelled",
									label: "Cancelado",
									icon: <XCircle size={13} style={{ color: "var(--text-muted)" }} />,
									color: "var(--text-muted)",
									list: runsByStatus.cancelled,
								},
							];

							return (
								<>
									<div
										style={{
											padding: "10px 14px",
											marginBottom: "12px",
											borderRadius: "8px",
											background: "rgba(79, 140, 255, 0.04)",
											border: "1px solid rgba(79, 140, 255, 0.1)",
											fontSize: "11px",
											color: "var(--text-dim)",
											display: "flex",
											alignItems: "center",
											gap: "8px",
										}}
									>
										<span style={{ fontSize: "14px" }}>💡</span>
										<span>
											Tip: Arrastra tareas a <strong>En cola</strong> para ejecutarlas, a <strong>Backlog</strong> para guardarlas, a <strong>Programadas</strong> para definir ejecución diferida, o a <strong>Cancelado</strong> para abortar.
										</span>
									</div>

									<div
										className="custom-scrollbar"
										style={{
											display: "flex",
											gap: "12px",
											flex: 1,
											overflowX: "auto",
											minHeight: 0,
											paddingBottom: "10px",
										}}
									>
										{columns.map((col) => {
											const isCancelCol = col.id === "cancelled";
											const isBacklogCol = col.id === "backlog";
											const isQueuedCol = col.id === "queued";
											const isScheduledCol = col.id === "scheduled";

											let isDragOver = false;
											if (isCancelCol) isDragOver = isDraggingOverCancel;
											if (isBacklogCol) isDragOver = isDraggingOverBacklog;
											if (isQueuedCol) isDragOver = isDraggingOverQueued;
											if (isScheduledCol) isDragOver = isDraggingOverScheduled;

											return (
												<div
													key={col.id}
													onDragOver={(e) => {
														if (isCancelCol || isBacklogCol || isQueuedCol || isScheduledCol) {
															e.preventDefault();
														}
													}}
													onDragEnter={(e) => {
														if (isCancelCol) {
															e.preventDefault();
															setIsDraggingOverCancel(true);
														} else if (isBacklogCol) {
															e.preventDefault();
															setIsDraggingOverBacklog(true);
														} else if (isQueuedCol) {
															e.preventDefault();
															setIsDraggingOverQueued(true);
														} else if (isScheduledCol) {
															e.preventDefault();
															setIsDraggingOverScheduled(true);
														}
													}}
													onDragLeave={() => {
														if (isCancelCol) {
															setIsDraggingOverCancel(false);
														} else if (isBacklogCol) {
															setIsDraggingOverBacklog(false);
														} else if (isQueuedCol) {
															setIsDraggingOverQueued(false);
														} else if (isScheduledCol) {
															setIsDraggingOverScheduled(false);
														}
													}}
													onDrop={(e) => {
														e.preventDefault();
														setIsDraggingOverCancel(false);
														setIsDraggingOverBacklog(false);
														setIsDraggingOverQueued(false);
														setIsDraggingOverScheduled(false);
														const runId = Number.parseInt(e.dataTransfer.getData("text/plain"), 10);
														if (Number.isNaN(runId)) return;

														if (isCancelCol) {
															handleCancelTask(runId);
														} else if (isBacklogCol) {
															handleMoveToBacklog(runId);
														} else if (isQueuedCol) {
															handleStartTask(runId);
														} else if (isScheduledCol) {
															const nowIso = new Date().toISOString();
															sendWs("update_task_properties", { runId, status: "scheduled", scheduledAt: nowIso });
															showToast("Tarea programada para ejecutar ahora", "info");
														}
													}}
													style={{
														flex: "1 1 0px",
														minWidth: "220px",
														display: "flex",
														flexDirection: "column",
														background: isDragOver
															? (isCancelCol ? "rgba(239, 68, 68, 0.05)" : isQueuedCol ? "rgba(245, 158, 11, 0.05)" : "rgba(79, 140, 255, 0.05)")
															: "rgba(255, 255, 255, 0.01)",
														border: `1px solid ${
															isDragOver
																? (isCancelCol ? "var(--error)" : isQueuedCol ? "var(--warning)" : "var(--accent)")
																: "var(--border-light)"
														}`,
														borderRadius: "10px",
														padding: "12px",
														minHeight: 0,
														transition: "all 0.2s ease",
														boxShadow: isDragOver
															? `0 0 12px ${isCancelCol ? "rgba(239, 68, 68, 0.2)" : isQueuedCol ? "rgba(245, 158, 11, 0.2)" : "rgba(79, 140, 255, 0.2)"}`
															: "none",
													}}
												>
													{/* Column Header */}
													<div
														style={{
															display: "flex",
															alignItems: "center",
															gap: "8px",
															marginBottom: "12px",
															borderBottom: "1px solid var(--border-light)",
															paddingBottom: "8px",
														}}
													>
														{col.icon}
														<span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-main)" }}>
															{col.label}
														</span>
														<span
															style={{
																fontSize: "10px",
																color: "var(--text-muted)",
																marginLeft: "auto",
																background: "rgba(255,255,255,0.04)",
																padding: "2px 6px",
																borderRadius: "10px",
																fontWeight: 600,
															}}
														>
															{col.list.length}
														</span>
													</div>

													{/* Column Task Cards */}
													<div
														style={{
															display: "flex",
															flexDirection: "column",
															gap: "8px",
															flex: 1,
															overflowY: "auto",
															paddingRight: "2px",
														}}
													>
														{col.list.length === 0 ? (
															<div
																style={{
																	textAlign: "center",
																	padding: "24px 8px",
																	fontSize: "11px",
																	color: "var(--text-muted)",
																	border: "1px dashed var(--border-light)",
																	borderRadius: "6px",
																	background: "rgba(255,255,255,0.005)",
																}}
															>
																Sin tareas
															</div>
																												) : col.id === "completed" ? (
															(() => {
																// Group completed runs by day
																const groups: Record<string, Run[]> = {};
																for (const run of col.list) {
																	const dateStr = run.created_at
																		? new Date(run.created_at).toLocaleDateString(undefined, {
																				year: "numeric",
																				month: "short",
																				day: "numeric",
																			})
																		: "Sin fecha";
																	if (!groups[dateStr]) {
																		groups[dateStr] = [];
																	}
																	groups[dateStr].push(run);
																}

																return Object.entries(groups).map(([dateStr, items]) => {
																	const isExpanded = expandedDates[dateStr] ?? true;
																	return (
																		<div key={dateStr} style={{ marginBottom: "6px" }}>
																			{/* Accordion Header */}
																			<div
																				onClick={() =>
																					setExpandedDates((prev) => ({
																						...prev,
																						[dateStr]: !isExpanded,
																					}))
																				}
																				style={{
																					display: "flex",
																					alignItems: "center",
																					gap: "6px",
																					padding: "6px 10px",
																					background: "rgba(255, 255, 255, 0.02)",
																					border: "1px solid var(--border-light)",
																					borderRadius: "6px",
																					cursor: "pointer",
																					fontSize: "11px",
																					fontWeight: 600,
																					color: "var(--text-main)",
																					transition: "background 0.2s ease",
																				}}
																				onMouseEnter={(e) => {
																					e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
																				}}
																				onMouseLeave={(e) => {
																					e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
																				}}
																			>
																				{isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
																				<span>{dateStr}</span>
																				<span
																					style={{
																						fontSize: "9px",
																						color: "var(--text-muted)",
																						marginLeft: "auto",
																						background: "rgba(255,255,255,0.04)",
																						padding: "1px 5px",
																						borderRadius: "8px",
																					}}
																				>
																					{items.length}
																				</span>
																			</div>

																			{/* Accordion Body */}
																			{isExpanded && (
																				<div
																					style={{
																						display: "flex",
																						flexDirection: "column",
																						gap: "6px",
																						marginTop: "6px",
																						paddingLeft: "8px",
																						borderLeft: "1px dashed var(--border-light)",
																					}}
																				>
																					{items.map((run) => renderCard(run, false))}
																				</div>
																			)}
																		</div>
																	);
																});
															})()
														) : (
															col.list.map((run) => {
																const canCancel = run.status === "queued" || run.status === "running";
																return renderCard(run, canCancel);
															})
														)}
													</div>
												</div>
											);
										})}
									</div>
								</>
							);
						})()}
					</div>
				</>

			{/* Detail Modal */}
			{selectedRun && (
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
					onClick={() => setSelectedRun(null)}
				>
					<div
						style={{
							background: "var(--bg-surface)",
							border: "1px solid var(--border)",
							borderRadius: "16px",
							width: "750px",
							maxWidth: "90vw",
							maxHeight: "85vh",
							overflowY: "auto",
							padding: "28px",
							display: "flex",
							flexDirection: "column",
							gap: "16px",
						}}
						onClick={(e) => e.stopPropagation()}
					>
						{/* Title input (Notion-style borderless header) */}
						<div>
							<div
								style={{
									fontSize: "9px",
									fontWeight: 700,
									color: "var(--text-muted)",
									textTransform: "uppercase",
									marginBottom: "4px",
								}}
							>
								Título de la Tarea (Haz clic para editar)
							</div>
							<input
								type="text"
								value={editTitle}
								onChange={(e) => setEditTitle(e.target.value)}
								onBlur={() => {
									if (editTitle.trim() && editTitle !== selectedRun.userText) {
										sendWs("update_task_properties", { runId: selectedRun.id, userText: editTitle.trim() });
									}
								}}
								style={{
									background: "transparent",
									border: "none",
									borderBottom: "1px dashed rgba(255,255,255,0.15)",
									color: "var(--text-main)",
									fontSize: "18px",
									fontWeight: 700,
									width: "100%",
									outline: "none",
									padding: "4px 0 8px",
									boxSizing: "border-box",
								}}
							/>
						</div>

						{/* Properties Grid (Notion-style) */}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "1fr 1fr",
								gap: "14px",
								background: "rgba(255,255,255,0.01)",
								border: "1px solid var(--border-light)",
								borderRadius: "10px",
								padding: "16px",
							}}
						>
							{/* Estado */}
							<div>
								<span
									style={{
										fontSize: "10px",
										fontWeight: 600,
										color: "var(--text-muted)",
										textTransform: "uppercase",
										display: "block",
										marginBottom: "4px",
									}}
								>
									Estado
								</span>
								<div
									style={{
										fontSize: "12px",
										color: "var(--text-main)",
										display: "flex",
										alignItems: "center",
										gap: "6px",
										background: "rgba(255,255,255,0.03)",
										padding: "6px 12px",
										borderRadius: "6px",
										border: "1px solid var(--border-light)",
									}}
								>
									{statusIcon(selectedRun.status)}
									<span style={{ textTransform: "capitalize", fontWeight: 600 }}>{selectedRun.status}</span>
								</div>
							</div>

							{/* Prioridad */}
							<div>
								<span
									style={{
										fontSize: "10px",
										fontWeight: 600,
										color: "var(--text-muted)",
										textTransform: "uppercase",
										display: "block",
										marginBottom: "4px",
									}}
								>
									Prioridad
								</span>
								<select
									value={editPriority}
									onChange={(e) => {
										const val = e.target.value;
										setEditPriority(val);
										sendWs("update_task_properties", { runId: selectedRun.id, priority: val });
									}}
									style={{
										width: "100%",
										background: "rgba(255,255,255,0.03)",
										border: "1px solid var(--border-light)",
										borderRadius: "6px",
										padding: "6px 12px",
										color: "var(--text-main)",
										fontSize: "12px",
										fontWeight: 600,
										outline: "none",
										cursor: "pointer",
									}}
								>
									<option value="low">Low (Baja)</option>
									<option value="medium">Medium (Media)</option>
									<option value="high">High (Alta)</option>
									<option value="urgent">Urgent (Urgente)</option>
								</select>
							</div>

							{/* Modelo LLM */}
							<div>
								<span
									style={{
										fontSize: "10px",
										fontWeight: 600,
										color: "var(--text-muted)",
										textTransform: "uppercase",
										display: "block",
										marginBottom: "4px",
									}}
								>
									Modelo LLM Asignado
								</span>
								<select
									value={editModel}
									onChange={(e) => {
										const val = e.target.value;
										setEditModel(val);
										sendWs("update_task_properties", { runId: selectedRun.id, preferredModel: val === "default" ? null : val });
									}}
									style={{
										width: "100%",
										background: "rgba(255,255,255,0.03)",
										border: "1px solid var(--border-light)",
										borderRadius: "6px",
										padding: "6px 12px",
										color: "var(--text-main)",
										fontSize: "12px",
										fontWeight: 600,
										outline: "none",
										cursor: "pointer",
									}}
								>
									<option value="default">Por defecto del modo</option>
									{availableModels.map((m) => (
										<option key={m} value={m}>
											{m}
										</option>
									))}
								</select>
							</div>

							{/* Fecha Límite */}
							<div>
								<span
									style={{
										fontSize: "10px",
										fontWeight: 600,
										color: "var(--text-muted)",
										textTransform: "uppercase",
										display: "block",
										marginBottom: "4px",
									}}
								>
									Fecha Límite
								</span>
								<input
									type="date"
									value={editDueDate}
									onChange={(e) => {
										const val = e.target.value;
										setEditDueDate(val);
										sendWs("update_task_properties", { runId: selectedRun.id, dueDate: val || null });
									}}
									style={{
										width: "100%",
										background: "rgba(255,255,255,0.03)",
										border: "1px solid var(--border-light)",
										borderRadius: "6px",
										padding: "5px 12px",
										color: "var(--text-main)",
										fontSize: "12px",
										fontWeight: 600,
										outline: "none",
										boxSizing: "border-box",
									}}
								/>
							</div>

							{/* Fecha de Ejecución (Programada) */}
							<div>
								<span
									style={{
										fontSize: "10px",
										fontWeight: 600,
										color: "var(--text-muted)",
										textTransform: "uppercase",
										display: "block",
										marginBottom: "4px",
									}}
								>
									Fecha de Ejecución (Programada)
								</span>
								<input
									type="datetime-local"
									value={toLocalDatetimeLocal(editScheduledAt)}
									onChange={(e) => {
										const val = e.target.value;
										const isoVal = val ? new Date(val).toISOString() : null;
										setEditScheduledAt(isoVal || "");
										sendWs("update_task_properties", { runId: selectedRun.id, scheduledAt: isoVal });
									}}
									style={{
										width: "100%",
										background: "rgba(255,255,255,0.03)",
										border: "1px solid var(--border-light)",
										borderRadius: "6px",
										padding: "5px 12px",
										color: "var(--text-main)",
										fontSize: "12px",
										fontWeight: 600,
										outline: "none",
										boxSizing: "border-box",
									}}
								/>
							</div>

							{/* Etiquetas */}
							<div>
								<span
									style={{
										fontSize: "10px",
										fontWeight: 600,
										color: "var(--text-muted)",
										textTransform: "uppercase",
										display: "block",
										marginBottom: "4px",
									}}
								>
									Etiquetas (separadas por coma)
								</span>
								<input
									type="text"
									value={editTags}
									onChange={(e) => setEditTags(e.target.value)}
									onBlur={() => {
										if (editTags !== (selectedRun.tags || "")) {
											sendWs("update_task_properties", { runId: selectedRun.id, tags: editTags.trim() || null });
										}
									}}
									placeholder="code, debug, docs"
									style={{
										width: "100%",
										background: "rgba(255,255,255,0.03)",
										border: "1px solid var(--border-light)",
										borderRadius: "6px",
										padding: "6px 12px",
										color: "var(--text-main)",
										fontSize: "12px",
										outline: "none",
										boxSizing: "border-box",
									}}
								/>
							</div>

							{/* Metadata */}
							<div>
								<span
									style={{
										fontSize: "10px",
										fontWeight: 600,
										color: "var(--text-muted)",
										textTransform: "uppercase",
										display: "block",
										marginBottom: "4px",
									}}
								>
									Origen / Latencia / Creado
								</span>
								<div
									style={{
										fontSize: "11px",
										color: "var(--text-dim)",
										display: "flex",
										alignItems: "center",
										gap: "10px",
										padding: "6px 2px",
									}}
								>
									<span>Origen: {ORIGIN_ICONS[selectedRun.origin] || selectedRun.origin}</span>
									{selectedRun.latencyMs != null && (
										<span>Latencia: {(selectedRun.latencyMs / 1000).toFixed(1)}s</span>
									)}
									{selectedRun.created_at && (
										<span>
											{new Date(selectedRun.created_at).toLocaleString(undefined, {
												month: "short",
												day: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</span>
									)}
								</div>
							</div>
						</div>

						{/* Descripción detallada (Notion page body content) */}
						<div>
							<div
								style={{
									fontSize: "10px",
									fontWeight: 600,
									color: "var(--text-muted)",
									textTransform: "uppercase",
									marginBottom: "6px",
									display: "flex",
									alignItems: "center",
									gap: "4px",
								}}
							>
								<FileText size={12} />
								Instrucciones / Notas Detalladas (Haz clic para editar)
							</div>
							<textarea
								value={editDescription}
								onChange={(e) => setEditDescription(e.target.value)}
								onBlur={() => {
									if (editDescription !== (selectedRun.description || "")) {
										sendWs("update_task_properties", { runId: selectedRun.id, description: editDescription.trim() || null });
									}
								}}
								placeholder="Escribe notas adicionales o instrucciones detalladas aquí..."
								rows={4}
								style={{
									width: "100%",
									background: "rgba(255,255,255,0.02)",
									border: "1px solid var(--border-light)",
									borderRadius: "8px",
									padding: "10px 14px",
									color: "var(--text-main)",
									fontSize: "13px",
									fontFamily: "inherit",
									resize: "vertical",
									outline: "none",
									boxSizing: "border-box",
									lineHeight: "1.5",
								}}
							/>
						</div>

						{/* Output: Result or Error */}
						{selectedRun.resultText && (
							<div>
								<div
									style={{
										fontSize: "10px",
										fontWeight: 600,
										color: "var(--text-muted)",
										textTransform: "uppercase",
										marginBottom: "6px",
									}}
								>
									Resultado de la Ejecución (Modelo: {selectedRun.model || "system"})
								</div>
								<div
									style={{
										padding: "12px 16px",
										background: "rgba(79,140,255,0.03)",
										borderRadius: "8px",
										border: "1px solid rgba(79,140,255,0.1)",
										fontSize: "12px",
										color: "var(--text-main)",
										whiteSpace: "pre-wrap",
										maxHeight: "180px",
										overflowY: "auto",
										fontFamily: "monospace",
										lineHeight: "1.4",
									}}
								>
									{selectedRun.resultText}
								</div>
							</div>
						)}

						{selectedRun.errorText && (
							<div>
								<div
									style={{
										fontSize: "10px",
										fontWeight: 600,
										color: "var(--text-muted)",
										textTransform: "uppercase",
										marginBottom: "6px",
									}}
								>
									Error de Ejecución
								</div>
								<div
									style={{
										padding: "12px 16px",
										background: "rgba(239,68,68,0.05)",
										borderRadius: "8px",
										border: "1px solid rgba(239,68,68,0.15)",
										fontSize: "12px",
										color: "var(--error)",
										whiteSpace: "pre-wrap",
										maxHeight: "150px",
										overflowY: "auto",
										fontFamily: "monospace",
									}}
								>
									{selectedRun.errorText}
								</div>
							</div>
						)}

						{/* Events Timeline */}
						<div>
							<div
								style={{
									fontSize: "10px",
									fontWeight: 600,
									color: "var(--text-muted)",
									textTransform: "uppercase",
									marginBottom: "8px",
								}}
							>
								Eventos del Timeline ({selectedEvents.length})
							</div>
							{detailLoading ? (
								<div style={{ textAlign: "center", padding: "12px" }}>
									<Loader2
										size={16}
										className="animate-spin"
										style={{ color: "var(--text-muted)" }}
									/>
								</div>
							) : selectedEvents.length === 0 ? (
								<div style={{ fontSize: "12px", color: "var(--text-dim)", padding: "4px 0" }}>
									Sin eventos registrados.
								</div>
							) : (
								<div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "150px", overflowY: "auto", paddingRight: "4px" }}>
									{selectedEvents.map((evt) => (
										<div
											key={evt.id}
											style={{
												padding: "8px 10px",
												borderRadius: "6px",
												background: "rgba(255,255,255,0.02)",
												border: "1px solid var(--border-light)",
												fontSize: "11px",
											}}
										>
											<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
												<span
													style={{
														padding: "1px 6px",
														borderRadius: "3px",
														fontSize: "9px",
														fontWeight: 700,
														textTransform: "uppercase",
														background:
															evt.type === "tool_call"
																? "rgba(79,140,255,0.15)"
																: evt.type === "error"
																	? "rgba(239,68,68,0.15)"
																	: "rgba(255,255,255,0.05)",
														color:
															evt.type === "tool_call"
																? "var(--accent)"
																: evt.type === "error"
																	? "var(--error)"
																	: "var(--text-muted)",
													}}
												>
													{evt.type}
												</span>
												<span style={{ color: "var(--text-dim)", fontSize: "10px" }}>
													{evt.created_at
														? new Date(evt.created_at).toLocaleTimeString()
														: ""}
												</span>
											</div>
											<div
												style={{
													color: "var(--text-dim)",
													marginTop: "4px",
													fontSize: "10px",
													maxHeight: "60px",
													overflow: "hidden",
												}}
											>
												{JSON.stringify(evt.payload).substring(0, 200)}
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Footer Actions */}
						<div style={{ display: "flex", justifyContent: "flex-end" }}>
							<button
								type="button"
								onClick={() => setSelectedRun(null)}
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
								Cerrar
							</button>
						</div>
					</div>
				</div>
			)}

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
					onClick={() => {
						resetNewTaskModal();
						setShowNewTaskModal(false);
					}}
				>
					<div
						style={{
							background: "var(--bg-surface)",
							border: "1px solid var(--border)",
							borderRadius: "16px",
							width: "600px",
							maxWidth: "90vw",
							maxHeight: "90vh",
							overflowY: "auto",
							padding: "24px",
							display: "flex",
							flexDirection: "column",
							gap: "16px",
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<h3
							style={{ margin: "0", fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}
						>
							Nueva Tarea
						</h3>

						{/* Título de la tarea */}
						<div>
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
								Título / Tarea
							</label>
							<input
								type="text"
								value={newTaskText}
								onChange={(e) => setNewTaskText(e.target.value)}
								placeholder="Ej: Corregir errores de compilación..."
								style={{
									width: "100%",
									background: "rgba(255,255,255,0.03)",
									border: "1px solid var(--border-light)",
									borderRadius: "6px",
									padding: "8px 12px",
									color: "var(--text-main)",
									fontSize: "13px",
									fontFamily: "inherit",
									outline: "none",
									boxSizing: "border-box",
								}}
							/>
						</div>

						{/* Descripción */}
						<div>
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
								Instrucciones / Notas detalladas (opcional)
							</label>
							<textarea
								value={newTaskDescription}
								onChange={(e) => setNewTaskDescription(e.target.value)}
								placeholder="Instrucciones adicionales para el agente..."
								rows={3}
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

						{/* Grid properties */}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "1fr 1fr",
								gap: "12px",
							}}
						>
							{/* Prioridad */}
							<div>
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
									Prioridad
								</label>
								<select
									value={newTaskPriority}
									onChange={(e) => setNewTaskPriority(e.target.value)}
									style={{
										width: "100%",
										background: "var(--bg-surface)",
										border: "1px solid var(--border-light)",
										borderRadius: "6px",
										padding: "8px 12px",
										color: "var(--text-main)",
										fontSize: "13px",
										outline: "none",
										cursor: "pointer",
										boxSizing: "border-box",
									}}
								>
									<option value="low">Low (Baja)</option>
									<option value="medium">Medium (Media)</option>
									<option value="high">High (Alta)</option>
									<option value="urgent">Urgent (Urgente)</option>
								</select>
							</div>

							{/* Modelo */}
							<div>
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
									Modelo LLM Asignado
								</label>
								<select
									value={newTaskPreferredModel}
									onChange={(e) => setNewTaskPreferredModel(e.target.value)}
									style={{
										width: "100%",
										background: "var(--bg-surface)",
										border: "1px solid var(--border-light)",
										borderRadius: "6px",
										padding: "8px 12px",
										color: "var(--text-main)",
										fontSize: "13px",
										outline: "none",
										cursor: "pointer",
										boxSizing: "border-box",
									}}
								>
									<option value="default">Por defecto del modo</option>
									{availableModels.map((m) => (
										<option key={m} value={m}>
											{m}
										</option>
									))}
								</select>
							</div>

							{/* Tags */}
							<div>
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
									Etiquetas (separadas por coma)
								</label>
								<input
									type="text"
									value={newTaskTags}
									onChange={(e) => setNewTaskTags(e.target.value)}
									placeholder="Ej: code, refactor, backend"
									style={{
										width: "100%",
										background: "rgba(255,255,255,0.03)",
										border: "1px solid var(--border-light)",
										borderRadius: "6px",
										padding: "8px 12px",
										color: "var(--text-main)",
										fontSize: "13px",
										outline: "none",
										boxSizing: "border-box",
									}}
								/>
							</div>

							{/* Fecha Límite */}
							<div>
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
									Fecha Límite
								</label>
								<input
									type="date"
									value={newTaskDueDate}
									onChange={(e) => setNewTaskDueDate(e.target.value)}
									style={{
										width: "100%",
										background: "rgba(255,255,255,0.03)",
										border: "1px solid var(--border-light)",
										borderRadius: "6px",
										padding: "7px 12px",
										color: "var(--text-main)",
										fontSize: "13px",
										outline: "none",
										boxSizing: "border-box",
									}}
								/>
							</div>
						</div>

						{/* Backlog option */}
						<div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
							<label className="custom-checkbox">
								<input
									type="checkbox"
									checked={newTaskInBacklog}
									onChange={(e) => {
										const checked = e.target.checked;
										setNewTaskInBacklog(checked);
										if (checked) {
											setNewTaskIsScheduled(false);
										}
									}}
								/>
								<span className="checkmark" />
							</label>
							<span style={{ fontSize: "12px", color: "var(--text-main)", fontWeight: 500 }}>
								Crear en Backlog (guardar sin ejecutar)
							</span>
						</div>

						{/* Programar option */}
						<div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
							{/* Programar checkbox */}
							<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
								<label className="custom-checkbox">
									<input
										type="checkbox"
										checked={newTaskIsScheduled}
										onChange={(e) => {
											const checked = e.target.checked;
											setNewTaskIsScheduled(checked);
											if (checked) {
												setNewTaskInBacklog(false);
												// Set default scheduled date/time to now + 5 minutes
												const defaultDate = new Date(Date.now() + 5 * 60 * 1000);
												const offset = defaultDate.getTimezoneOffset();
												const localDate = new Date(defaultDate.getTime() - offset * 60 * 1000);
												setNewTaskScheduledAt(localDate.toISOString().slice(0, 16));
											} else {
												setNewTaskIsRecurring(false);
											}
										}}
									/>
									<span className="checkmark" />
								</label>
								<span style={{ fontSize: "12px", color: "var(--text-main)", fontWeight: 500 }}>
									Programar ejecución (ejecutar en fecha/hora específica)
								</span>
							</div>

							{newTaskIsScheduled && (
								<div
									style={{
										paddingLeft: "24px",
										display: "flex",
										flexDirection: "column",
										gap: "12px",
										borderLeft: "2px solid rgba(79,140,255,0.2)",
									}}
								>
									{/* Primera ejecución datetime */}
									<div>
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
											{newTaskIsRecurring ? "Primera ejecución" : "Fecha y hora de ejecución"}
										</label>
										<input
											type="datetime-local"
											value={newTaskScheduledAt}
											onChange={(e) => setNewTaskScheduledAt(e.target.value)}
											style={{
												background: "rgba(255,255,255,0.03)",
												border: "1px solid var(--border-light)",
												borderRadius: "6px",
												padding: "6px 12px",
												color: "var(--text-main)",
												fontSize: "13px",
												fontFamily: "inherit",
												outline: "none",
												boxSizing: "border-box",
											}}
										/>
									</div>

									{/* Recurrente checkbox */}
									<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
										<label className="custom-checkbox">
											<input
												type="checkbox"
												checked={newTaskIsRecurring}
												onChange={(e) => setNewTaskIsRecurring(e.target.checked)}
											/>
											<span className="checkmark" />
										</label>
										<span style={{ fontSize: "12px", color: "#a78bfa", fontWeight: 600 }}>
											🔁 Tarea Recurrente (se repite según frecuencia)
										</span>
									</div>

									{/* Recurrence configurator */}
									{newTaskIsRecurring && (
										<div
											style={{
												background: "rgba(167, 139, 250, 0.05)",
												border: "1px solid rgba(167, 139, 250, 0.2)",
												borderRadius: "10px",
												padding: "14px",
												display: "flex",
												flexDirection: "column",
												gap: "12px",
											}}
										>
											{/* Preset selector */}
											<div>
												<label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
													Frecuencia
												</label>
												<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
													{(["daily", "weekly", "monthly", "custom"] as const).map((p) => (
														<button
															key={p}
															type="button"
															onClick={() => setRecurPreset(p)}
															style={{
																padding: "5px 12px",
																borderRadius: "6px",
																fontSize: "11px",
																fontWeight: 600,
																cursor: "pointer",
																border: recurPreset === p ? "1px solid #a78bfa" : "1px solid var(--border-light)",
																background: recurPreset === p ? "rgba(167, 139, 250, 0.2)" : "rgba(255,255,255,0.02)",
																color: recurPreset === p ? "#a78bfa" : "var(--text-dim)",
																transition: "all 0.15s ease",
															}}
														>
															{p === "daily" && "📅 Diario"}
															{p === "weekly" && "🗓️ Semanal"}
															{p === "monthly" && "📆 Mensual"}
															{p === "custom" && "⚙️ Personalizado"}
														</button>
													))}
												</div>
											</div>

											{/* Hour/Minute selector (not for custom) */}
											{recurPreset !== "custom" && (
												<div>
													<label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
														Hora de ejecución
													</label>
													<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
														<select
															value={recurHour}
															onChange={(e) => setRecurHour(e.target.value)}
															style={{
																background: "var(--bg-surface)",
																border: "1px solid var(--border-light)",
																borderRadius: "6px",
																padding: "6px 10px",
																color: "var(--text-main)",
																fontSize: "13px",
																outline: "none",
															}}
														>
															{Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
																<option key={h} value={h}>{h}:00</option>
															))}
														</select>
														<span style={{ color: "var(--text-muted)", fontWeight: 700 }}>:</span>
														<select
															value={recurMinute}
															onChange={(e) => setRecurMinute(e.target.value)}
															style={{
																background: "var(--bg-surface)",
																border: "1px solid var(--border-light)",
																borderRadius: "6px",
																padding: "6px 10px",
																color: "var(--text-main)",
																fontSize: "13px",
																outline: "none",
															}}
														>
															{["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((min) => (
																<option key={min} value={min}>{min}</option>
															))}
														</select>
													</div>
												</div>
											)}

											{/* Weekly: day selector */}
											{recurPreset === "weekly" && (
												<div>
													<label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
														Días de la semana
													</label>
													<div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
														{[
															{ v: "1", l: "Lun" }, { v: "2", l: "Mar" }, { v: "3", l: "Mié" },
															{ v: "4", l: "Jue" }, { v: "5", l: "Vie" }, { v: "6", l: "Sáb" }, { v: "0", l: "Dom" },
														].map(({ v, l }) => {
															const selected = recurWeekDays.includes(v);
															return (
																<button
																	key={v}
																	type="button"
																	onClick={() => {
																		if (selected) {
																			if (recurWeekDays.length === 1) return; // at least one day
																			setRecurWeekDays((prev) => prev.filter((d) => d !== v));
																		} else {
																			setRecurWeekDays((prev) => [...prev, v].sort());
																		}
																	}}
																	style={{
																		padding: "5px 10px",
																		borderRadius: "6px",
																		fontSize: "11px",
																		fontWeight: 700,
																		cursor: "pointer",
																		border: selected ? "1px solid #a78bfa" : "1px solid var(--border-light)",
																		background: selected ? "rgba(167, 139, 250, 0.25)" : "rgba(255,255,255,0.02)",
																		color: selected ? "#a78bfa" : "var(--text-dim)",
																		transition: "all 0.15s ease",
																	}}
																>
																	{l}
																</button>
															);
														})}
													</div>
												</div>
											)}

											{/* Monthly: day of month */}
											{recurPreset === "monthly" && (
												<div>
													<label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
														Día del mes
													</label>
													<select
														value={recurMonthDay}
														onChange={(e) => setRecurMonthDay(e.target.value)}
														style={{
															background: "var(--bg-surface)",
															border: "1px solid var(--border-light)",
															borderRadius: "6px",
															padding: "6px 10px",
															color: "var(--text-main)",
															fontSize: "13px",
															outline: "none",
														}}
													>
														{Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => (
															<option key={d} value={d}>Día {d}</option>
														))}
													</select>
												</div>
											)}

											{/* Custom cron input */}
											{recurPreset === "custom" && (
												<div>
													<label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
														Expresión Cron
													</label>
													<input
														type="text"
														value={recurCustomCron}
														onChange={(e) => setRecurCustomCron(e.target.value)}
														placeholder="Ej: 0 9 * * 1-5 (L-V a las 9:00)"
														style={{
															width: "100%",
															background: "rgba(255,255,255,0.03)",
															border: "1px solid var(--border-light)",
															borderRadius: "6px",
															padding: "6px 12px",
															color: "var(--text-main)",
															fontSize: "12px",
															fontFamily: "var(--font-mono)",
															outline: "none",
															boxSizing: "border-box",
														}}
													/>
													<span style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
														Formato: minuto hora día-mes mes día-semana
													</span>
												</div>
											)}

											{/* Preview of generated cron */}
											<div
												style={{
													background: "rgba(0,0,0,0.2)",
													borderRadius: "6px",
													padding: "8px 12px",
													display: "flex",
													alignItems: "center",
													gap: "8px",
												}}
											>
												<span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600 }}>Cron:</span>
												<code
													style={{
														fontFamily: "var(--font-mono)",
														fontSize: "12px",
														color: "#a78bfa",
														fontWeight: 700,
													}}
												>
													{buildCronExpression() || "—"}
												</code>
											</div>
										</div>
									)}
								</div>
							)}
						</div>

						{/* Action Buttons */}
						<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
							<button
								type="button"
								onClick={() => {
									resetNewTaskModal();
									setShowNewTaskModal(false);
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
								onClick={handleNewTask}
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
		</div>
	);
};
