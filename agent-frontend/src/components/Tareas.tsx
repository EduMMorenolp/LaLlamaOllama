import { AlertCircle, CheckCircle, Clock, Loader2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { config } from "../config";

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

type StatusFilter = "all" | "queued" | "running" | "completed" | "failed";

export const Tareas: React.FC = () => {
	const [runs, setRuns] = useState<Run[]>([]);
	const [loading, setLoading] = useState(true);
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [selectedRun, setSelectedRun] = useState<Run | null>(null);
	const [selectedEvents, setSelectedEvents] = useState<RunEvent[]>([]);
	const [detailLoading, setDetailLoading] = useState(false);

	const fetchRuns = useCallback(async () => {
		try {
			const params = new URLSearchParams();
			if (statusFilter !== "all") params.set("status", statusFilter);
			params.set("limit", "50");
			const res = await fetch(`${config.engineUrl}/api/runs?${params}`);
			const data = await res.json();
			setRuns(data.runs || []);
		} catch (err) {
			console.error("Failed to fetch runs", err);
		} finally {
			setLoading(false);
		}
	}, [statusFilter]);

	useEffect(() => {
		setLoading(true);
		fetchRuns();
	}, [fetchRuns]);

	const openDetail = async (run: Run) => {
		setSelectedRun(run);
		setDetailLoading(true);
		try {
			const res = await fetch(`${config.engineUrl}/api/runs/${run.id}`);
			const data = await res.json();
			setSelectedEvents(data.events || []);
		} catch {
			setSelectedEvents([]);
		} finally {
			setDetailLoading(false);
		}
	};

	const statusIcon = (status: string) => {
		switch (status) {
			case "completed": return <CheckCircle size={14} style={{ color: "var(--success)" }} />;
			case "running": return <Loader2 size={14} style={{ color: "var(--accent)" }} className="animate-spin" />;
			case "queued": return <Clock size={14} style={{ color: "var(--warning)" }} />;
			case "failed": return <XCircle size={14} style={{ color: "var(--error)" }} />;
			default: return <AlertCircle size={14} style={{ color: "var(--text-muted)" }} />;
		}
	};

	const statusColor = (status: string) => {
		switch (status) {
			case "completed": return "rgba(16,185,129,0.15)";
			case "running": return "rgba(79,140,255,0.15)";
			case "queued": return "rgba(245,158,11,0.15)";
			case "failed": return "rgba(239,68,68,0.15)";
			default: return "rgba(255,255,255,0.03)";
		}
	};

	const filters: StatusFilter[] = ["all", "queued", "running", "completed", "failed"];

	return (
		<div style={{ height: "calc(100vh - 160px)", display: "flex", flexDirection: "column" }}>
			{/* Filters */}
			<div style={{ display: "flex", gap: "8px", padding: "0 0 16px", flexWrap: "wrap" }}>
				{filters.map((f) => (
					<button
						key={f}
						type="button"
						onClick={() => setStatusFilter(f)}
						style={{
							padding: "6px 14px",
							borderRadius: "6px",
							border: "1px solid var(--border-light)",
							background: statusFilter === f ? "rgba(79,140,255,0.1)" : "rgba(255,255,255,0.02)",
							color: statusFilter === f ? "var(--accent)" : "var(--text-muted)",
							cursor: "pointer",
							fontSize: "11px",
							fontWeight: 600,
							textTransform: "capitalize",
						}}
					>
						{f === "all" ? "Todas" : f}
					</button>
				))}
			</div>

			{/* Task List */}
			<div style={{ flex: 1, overflowY: "auto" }}>
				{loading ? (
					<div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
						<Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 12px", display: "block" }} />
						Cargando tareas...
					</div>
				) : runs.length === 0 ? (
					<div style={{ textAlign: "center", padding: "40px", color: "var(--text-dim)", fontSize: "13px" }}>
						No hay tareas {statusFilter !== "all" ? `con estado "${statusFilter}"` : ""}.
					</div>
				) : (
					runs.map((run) => (
						<div
							key={run.id}
							onClick={() => openDetail(run)}
							style={{
								padding: "12px 16px",
								marginBottom: "6px",
								borderRadius: "8px",
								background: "rgba(255,255,255,0.02)",
								border: "1px solid var(--border-light)",
								cursor: "pointer",
								transition: "all 0.15s",
							}}
							onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-glow)"; }}
							onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-light)"; }}
						>
							<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
								{statusIcon(run.status)}
								<div style={{ flex: 1, minWidth: 0 }}>
									<div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
										{run.userText}
									</div>
									<div style={{ display: "flex", gap: "12px", marginTop: "4px", fontSize: "10px", color: "var(--text-dim)" }}>
										{run.created_at && <span>{new Date(run.created_at).toLocaleString()}</span>}
										{run.model && <span style={{ color: "var(--accent)", fontFamily: "monospace" }}>{run.model}</span>}
										{run.latencyMs != null && <span>{(run.latencyMs / 1000).toFixed(1)}s</span>}
									</div>
								</div>
								<span
									style={{
										padding: "2px 8px",
										borderRadius: "4px",
										fontSize: "10px",
										fontWeight: 600,
										textTransform: "capitalize",
										background: statusColor(run.status),
										color: run.status === "completed" ? "var(--success)" : run.status === "failed" ? "var(--error)" : run.status === "running" ? "var(--accent)" : "var(--warning)",
									}}
								>
									{run.status}
								</span>
							</div>
						</div>
					))
				)}
			</div>

			{/* Detail Modal */}
			{selectedRun && (
				<div
					style={{
						position: "fixed",
						top: 0, left: 0, right: 0, bottom: 0,
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
							width: "700px",
							maxWidth: "90vw",
							maxHeight: "80vh",
							overflow: "auto",
							padding: "24px",
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>
							Detalle de Tarea #{selectedRun.id}
						</h3>

						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
							<div>
								<div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Estado</div>
								<div style={{ fontSize: "13px", color: "var(--text-main)", marginTop: "2px" }}>{selectedRun.status}</div>
							</div>
							<div>
								<div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Modelo</div>
								<div style={{ fontSize: "13px", color: "var(--accent)", marginTop: "2px", fontFamily: "monospace" }}>{selectedRun.model || "-"}</div>
							</div>
							<div>
								<div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Latencia</div>
								<div style={{ fontSize: "13px", color: "var(--text-main)", marginTop: "2px" }}>{selectedRun.latencyMs ? `${(selectedRun.latencyMs / 1000).toFixed(1)}s` : "-"}</div>
							</div>
							<div>
								<div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Creado</div>
								<div style={{ fontSize: "13px", color: "var(--text-main)", marginTop: "2px" }}>{selectedRun.created_at ? new Date(selectedRun.created_at).toLocaleString() : "-"}</div>
							</div>
						</div>

						<div style={{ marginBottom: "16px" }}>
							<div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "6px" }}>Mensaje del usuario</div>
							<div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid var(--border-light)", fontSize: "13px", color: "var(--text-main)", whiteSpace: "pre-wrap" }}>
								{selectedRun.userText}
							</div>
						</div>

						{selectedRun.resultText && (
							<div style={{ marginBottom: "16px" }}>
								<div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "6px" }}>Respuesta</div>
								<div style={{ padding: "10px 14px", background: "rgba(79,140,255,0.03)", borderRadius: "8px", border: "1px solid rgba(79,140,255,0.1)", fontSize: "12px", color: "var(--text-main)", whiteSpace: "pre-wrap", maxHeight: "200px", overflow: "auto" }}>
									{selectedRun.resultText}
								</div>
							</div>
						)}

						{selectedRun.errorText && (
							<div style={{ marginBottom: "16px" }}>
								<div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "6px" }}>Error</div>
								<div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.05)", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.15)", fontSize: "12px", color: "var(--error)", whiteSpace: "pre-wrap" }}>
									{selectedRun.errorText}
								</div>
							</div>
						)}

						{/* Events Timeline */}
						<div>
							<div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
								Eventos ({selectedEvents.length})
							</div>
							{detailLoading ? (
								<div style={{ textAlign: "center", padding: "12px" }}>
									<Loader2 size={16} className="animate-spin" style={{ color: "var(--text-muted)" }} />
								</div>
							) : selectedEvents.length === 0 ? (
								<div style={{ fontSize: "12px", color: "var(--text-dim)", padding: "8px 0" }}>Sin eventos registrados.</div>
							) : (
								<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
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
												<span style={{
													padding: "1px 6px",
													borderRadius: "3px",
													fontSize: "9px",
													fontWeight: 700,
													textTransform: "uppercase",
													background: evt.type === "tool_call" ? "rgba(79,140,255,0.15)" : evt.type === "error" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)",
													color: evt.type === "tool_call" ? "var(--accent)" : evt.type === "error" ? "var(--error)" : "var(--text-muted)",
												}}>
													{evt.type}
												</span>
												<span style={{ color: "var(--text-dim)", fontSize: "10px" }}>
													{evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : ""}
												</span>
											</div>
											<div style={{ color: "var(--text-dim)", marginTop: "4px", fontSize: "10px", maxHeight: "60px", overflow: "hidden" }}>
												{JSON.stringify(evt.payload).substring(0, 200)}
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						<div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
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
		</div>
	);
};
