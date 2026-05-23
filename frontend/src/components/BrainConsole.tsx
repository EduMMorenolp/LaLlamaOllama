import { Activity, BookOpen, Brain, Database, GitMerge, HeartPulse, Layers, RefreshCw, Search, Settings, Trash2 } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { brainApi } from "../services/api.service";
import { BrainAuditor } from "./BrainAuditor";
import { BrainDirectives } from "./BrainDirectives";
import { BrainScaffold } from "./BrainScaffold";
import { BrainSettings } from "./BrainSettings";
import { MemoryExplorer } from "./MemoryExplorer";
import { ProjectMerger } from "./ProjectMerger";

interface BrainStats {
	total: number;
	types: { type: string; count: number }[];
}

interface Toast {
	id: number;
	message: string;
	type: "success" | "error" | "info";
	detail?: string;
}

interface HealthStatus {
	status?: string;
	online?: boolean;
	[key: string]: unknown;
}

let toastCounter = 0;

export const BrainConsole: React.FC = () => {
	const [stats, setStats] = useState<BrainStats>({ total: 0, types: [] });
	const [project, setProject] = useState("lallamaollama");
	const [projectsList, setProjectsList] = useState<string[]>(["lallamaollama"]);
	const [activeTab, setActiveTab] = useState<"auditor" | "directives" | "settings" | "scaffold" | "explorer" | "merge">("auditor");
	const [toasts, setToasts] = useState<Toast[]>([]);
	const [deletingProject, setDeletingProject] = useState(false);
	const [health, setHealth] = useState<HealthStatus | null>(null);
	const [healthLoading, setHealthLoading] = useState(false);

	const addToast = useCallback((message: string, type: Toast["type"], detail?: string) => {
		const id = ++toastCounter;
		setToasts((prev) => [...prev, { id, message, type, detail }]);
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id));
		}, 5000);
	}, []);

	const fetchStats = useCallback(async () => {
		try {
			const res = await brainApi.get(`/api/memory/stats?project=${project}`);
			setStats(res.data);
		} catch (error) {
			console.error("Error fetching brain stats", error);
		}
	}, [project]);

	const fetchProjects = useCallback(async () => {
		try {
			const res = await brainApi.get("/api/projects");
			if (res.data && Array.isArray(res.data)) {
				setProjectsList(res.data);
			}
		} catch (error) {
			console.error("Error fetching projects", error);
		}
	}, []);

	const fetchHealth = useCallback(async () => {
		setHealthLoading(true);
		try {
			const res = await brainApi.get("/api/health");
			setHealth(res.data);
		} catch (error) {
			console.error("Error fetching brain health", error);
			setHealth(null);
		} finally {
			setHealthLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchStats();
		fetchProjects();
		fetchHealth();
	}, [fetchStats, fetchProjects, fetchHealth]);

	const handleAddProject = () => {
		const name = window.prompt("Ingresa el nombre del nuevo proyecto:");
		if (name?.trim()) {
			const cleanName = name
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-");
			setProjectsList((prev) => Array.from(new Set([...prev, cleanName])));
			setProject(cleanName);
		}
	};

	const handleDeleteProject = async () => {
		if (project === "lallamaollama") {
			addToast("No se puede eliminar el proyecto principal.", "error");
			return;
		}
		const confirmed = window.confirm(
			`¿Eliminar el proyecto "${project}" y TODAS sus memorias?\n\nEsta acción es irreversible.`,
		);
		if (!confirmed) return;

		setDeletingProject(true);
		try {
			const res = await brainApi.delete(`/api/projects/${encodeURIComponent(project)}`);
			const { deletedMemories, deletedDirectives } = res.data;
			addToast(
				`Proyecto "${project}" eliminado`,
				"success",
				`${deletedMemories} recuerdos y ${deletedDirectives} directivas borrados.`,
			);
			setProjectsList((prev) => prev.filter((p) => p !== project));
			setProject("lallamaollama");
			await fetchStats();
		} catch (error: unknown) {
			const msg =
				error instanceof Error
					? error.message
					: (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
						"Error desconocido";
			addToast("Error al eliminar proyecto", "error", msg);
		} finally {
			setDeletingProject(false);
		}
	};

	const toastColors: Record<Toast["type"], { bg: string; border: string; icon: string }> = {
		success: { bg: "rgba(34, 197, 94, 0.12)", border: "rgba(34, 197, 94, 0.4)", icon: "✓" },
		error: { bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.4)", icon: "✕" },
		info: { bg: "rgba(79, 140, 255, 0.12)", border: "rgba(79, 140, 255, 0.4)", icon: "ℹ" },
	};

	const isOnline = health !== null && (health.status === "ok" || health.online === true);

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
			{/* Toast Notifications */}
			<div
				style={{
					position: "fixed",
					bottom: "24px",
					right: "24px",
					zIndex: 9999,
					display: "flex",
					flexDirection: "column",
					gap: "10px",
					pointerEvents: "none",
				}}
			>
				{toasts.map((toast) => {
					const colors = toastColors[toast.type];
					return (
						<div
							key={toast.id}
							style={{
								background: colors.bg,
								border: `1px solid ${colors.border}`,
								backdropFilter: "blur(16px)",
								WebkitBackdropFilter: "blur(16px)",
								borderRadius: "10px",
								padding: "12px 16px",
								minWidth: "280px",
								maxWidth: "360px",
								display: "flex",
								alignItems: "flex-start",
								gap: "10px",
								boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
								animation: "toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
								pointerEvents: "auto",
							}}
						>
							<span
								style={{
									width: "20px",
									height: "20px",
									borderRadius: "50%",
									background: colors.border,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: "11px",
									fontWeight: 700,
									flexShrink: 0,
									marginTop: "1px",
								}}
							>
								{colors.icon}
							</span>
							<div>
								<div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
									{toast.message}
								</div>
								{toast.detail && (
									<div
										style={{
											fontSize: "11px",
											color: "var(--text-dim)",
											marginTop: "3px",
											lineHeight: 1.4,
										}}
									>
										{toast.detail}
									</div>
								)}
							</div>
						</div>
					);
				})}
			</div>

			{/* Toast animation keyframes */}
			<style>{`
				@keyframes toastSlideIn {
					from { opacity: 0; transform: translateX(20px) scale(0.95); }
					to   { opacity: 1; transform: translateX(0)    scale(1); }
				}
			`}</style>

			{/* Navegación de Pestañas */}
			<div
				style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}
			>
				<button
					onClick={() => setActiveTab("auditor")}
					type="button"
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						padding: "10px 20px",
						borderRadius: "8px",
						fontSize: "13px",
						fontWeight: 600,
						border: "none",
						background: activeTab === "auditor" ? "rgba(79, 140, 255, 0.15)" : "transparent",
						color: activeTab === "auditor" ? "var(--accent)" : "var(--text-dim)",
						cursor: "pointer",
						transition: "var(--transition)",
					}}
				>
					<Brain size={16} /> Auditor de Memoria
				</button>
				<button
					onClick={() => setActiveTab("explorer")}
					type="button"
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						padding: "10px 20px",
						borderRadius: "8px",
						fontSize: "13px",
						fontWeight: 600,
						border: "none",
						background: activeTab === "explorer" ? "rgba(79, 140, 255, 0.15)" : "transparent",
						color: activeTab === "explorer" ? "var(--accent)" : "var(--text-dim)",
						cursor: "pointer",
						transition: "var(--transition)",
					}}
				>
					<Search size={16} /> Explorador de Memorias
				</button>
				<button
					onClick={() => setActiveTab("directives")}
					type="button"
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						padding: "10px 20px",
						borderRadius: "8px",
						fontSize: "13px",
						fontWeight: 600,
						border: "none",
						background: activeTab === "directives" ? "rgba(79, 140, 255, 0.15)" : "transparent",
						color: activeTab === "directives" ? "var(--accent)" : "var(--text-dim)",
						cursor: "pointer",
						transition: "var(--transition)",
					}}
				>
					<BookOpen size={16} /> Directivas Centrales
				</button>
				<button
					onClick={() => setActiveTab("merge")}
					type="button"
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						padding: "10px 20px",
						borderRadius: "8px",
						fontSize: "13px",
						fontWeight: 600,
						border: "none",
						background: activeTab === "merge" ? "rgba(79, 140, 255, 0.15)" : "transparent",
						color: activeTab === "merge" ? "var(--accent)" : "var(--text-dim)",
						cursor: "pointer",
						transition: "var(--transition)",
					}}
				>
					<GitMerge size={16} /> Fusionar Proyectos
				</button>
				<button
					onClick={() => setActiveTab("settings")}
					type="button"
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						padding: "10px 20px",
						borderRadius: "8px",
						fontSize: "13px",
						fontWeight: 600,
						border: "none",
						background: activeTab === "settings" ? "rgba(79, 140, 255, 0.15)" : "transparent",
						color: activeTab === "settings" ? "var(--accent)" : "var(--text-dim)",
						cursor: "pointer",
						transition: "var(--transition)",
					}}
				>
					<Settings size={16} /> Ajustes Cognitivos
				</button>
				<button
					onClick={() => setActiveTab("scaffold")}
					type="button"
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						padding: "10px 20px",
						borderRadius: "8px",
						fontSize: "13px",
						fontWeight: 600,
						border: "none",
						background: activeTab === "scaffold" ? "rgba(79, 140, 255, 0.15)" : "transparent",
						color: activeTab === "scaffold" ? "var(--accent)" : "var(--text-dim)",
						cursor: "pointer",
						transition: "var(--transition)",
					}}
				>
					<Layers size={16} /> Scaffold
				</button>
			</div>

			<div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "24px", alignItems: "start" }}>
				{/* Panel Principal dinámico */}
				<div style={{ minWidth: 0 }}>
					{activeTab === "auditor" && <BrainAuditor project={project} />}
					{activeTab === "explorer" && <MemoryExplorer project={project} onToast={addToast} />}
					{activeTab === "directives" && <BrainDirectives project={project} />}
					{activeTab === "merge" && (
						<ProjectMerger
							projectsList={projectsList}
							onToast={addToast}
							onRefresh={() => {
								fetchProjects();
								fetchStats();
							}}
						/>
					)}
					{activeTab === "settings" && <BrainSettings project={project} />}
					{activeTab === "scaffold" && <BrainScaffold project={project} onToast={addToast} />}
				</div>

				{/* Panel Lateral: KPIs y Estadísticas */}
				<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
					<div
						className="card-glass"
						style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}
					>
						<div
							style={{
								width: "48px",
								height: "48px",
								borderRadius: "12px",
								background: "rgba(79, 140, 255, 0.15)",
								color: "var(--accent)",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Brain size={24} />
						</div>
						<div>
							<h3
								style={{
									fontSize: "11px",
									textTransform: "uppercase",
									letterSpacing: "1px",
									color: "var(--text-muted)",
									marginBottom: "4px",
								}}
							>
								Total Recuerdos
							</h3>
							<div style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-1px" }}>
								{stats.total}
							</div>
						</div>
					</div>

					<div className="card-glass" style={{ padding: "20px" }}>
						<h3
							style={{
								fontSize: "11px",
								fontWeight: 700,
								letterSpacing: "1.5px",
								color: "var(--text-muted)",
								marginBottom: "16px",
								textTransform: "uppercase",
								display: "flex",
								alignItems: "center",
								gap: "8px",
							}}
						>
							<Database size={14} /> Distribución de Conocimiento
						</h3>
						{stats.types.length === 0 ? (
							<p
								style={{
									fontSize: "12px",
									color: "var(--text-dim)",
									textAlign: "center",
									padding: "12px 0",
								}}
							>
								Sin datos registrados
							</p>
						) : (
							<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
								{stats.types.map((type) => (
									<div key={type.type}>
										<div className="flex-between" style={{ marginBottom: "6px" }}>
											<span style={{ fontSize: "12px", textTransform: "capitalize" }}>
												{type.type}
											</span>
											<span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)" }}>
												{type.count}
											</span>
										</div>
										<div
											style={{
												height: "4px",
												background: "var(--bg-input)",
												borderRadius: "2px",
												overflow: "hidden",
											}}
										>
											<div
												style={{
													height: "100%",
													background: "var(--accent)",
													width: `${(type.count / stats.total) * 100}%`,
													borderRadius: "2px",
												}}
											/>
										</div>
									</div>
								))}
							</div>
						)}
					</div>

					<div className="card-glass" style={{ padding: "20px" }}>
						<h3
							style={{
								fontSize: "11px",
								fontWeight: 700,
								letterSpacing: "1.5px",
								color: "var(--text-muted)",
								marginBottom: "16px",
								textTransform: "uppercase",
								display: "flex",
								alignItems: "center",
								gap: "8px",
							}}
						>
							<Activity size={14} /> Contexto Activo
						</h3>
						<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
							<div>
								<div className="flex-between" style={{ alignItems: "center", marginBottom: "4px" }}>
									<span
										style={{
											fontSize: "10px",
											color: "var(--text-dim)",
											textTransform: "uppercase",
										}}
									>
										Proyecto Target
									</span>
									<div style={{ display: "flex", gap: "4px" }}>
										<button
											onClick={() => {
												fetchProjects();
												fetchStats();
											}}
											type="button"
											title="Refrescar lista de proyectos"
											style={{
												fontSize: "10px",
												background: "rgba(255,255,255,0.08)",
												color: "var(--text-dim)",
												border: "none",
												borderRadius: "4px",
												padding: "2px 6px",
												cursor: "pointer",
												fontWeight: 600,
												display: "flex",
												alignItems: "center",
												gap: "3px",
											}}
										>
											<RefreshCw size={11} />
										</button>
										<button
											onClick={handleAddProject}
											type="button"
											style={{
												fontSize: "10px",
												background: "rgba(79, 140, 255, 0.2)",
												color: "var(--accent)",
												border: "none",
												borderRadius: "4px",
												padding: "2px 6px",
												cursor: "pointer",
												fontWeight: 600,
											}}
										>
											+ Nuevo
										</button>
									</div>
								</div>
								<select
									value={project}
									onChange={(e) => setProject(e.target.value)}
									style={{
										width: "100%",
										padding: "8px",
										background: "var(--bg-input)",
										border: "1px solid var(--border)",
										borderRadius: "6px",
										color: "white",
										fontSize: "12px",
										fontFamily: "var(--font-mono)",
										cursor: "pointer",
									}}
								>
									{projectsList.map((p) => (
										<option key={p} value={p}>
											{p}
										</option>
									))}
								</select>

								{/* Delete Project Button */}
								{project !== "lallamaollama" && (
									<button
										onClick={handleDeleteProject}
										type="button"
										disabled={deletingProject}
										title={`Eliminar proyecto "${project}" y todas sus memorias`}
										style={{
											marginTop: "8px",
											width: "100%",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											gap: "6px",
											padding: "7px 12px",
											borderRadius: "6px",
											fontSize: "11px",
											fontWeight: 600,
											border: "1px solid rgba(239, 68, 68, 0.35)",
											background: deletingProject
												? "rgba(239, 68, 68, 0.05)"
												: "rgba(239, 68, 68, 0.08)",
											color: deletingProject ? "rgba(239,68,68,0.4)" : "rgba(239, 68, 68, 0.85)",
											cursor: deletingProject ? "not-allowed" : "pointer",
											transition: "all 0.2s ease",
										}}
										onMouseEnter={(e) => {
											if (!deletingProject) {
												(e.currentTarget as HTMLButtonElement).style.background =
													"rgba(239, 68, 68, 0.18)";
												(e.currentTarget as HTMLButtonElement).style.color = "rgb(239, 68, 68)";
												(e.currentTarget as HTMLButtonElement).style.borderColor =
													"rgba(239, 68, 68, 0.6)";
											}
										}}
										onMouseLeave={(e) => {
											if (!deletingProject) {
												(e.currentTarget as HTMLButtonElement).style.background =
													"rgba(239, 68, 68, 0.08)";
												(e.currentTarget as HTMLButtonElement).style.color =
													"rgba(239, 68, 68, 0.85)";
												(e.currentTarget as HTMLButtonElement).style.borderColor =
													"rgba(239, 68, 68, 0.35)";
											}
										}}
									>
										<Trash2 size={12} />
										{deletingProject ? "Eliminando..." : "Eliminar proyecto"}
									</button>
								)}
							</div>
														{/* Health Status Indicator */}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									padding: "10px 12px",
									background: isOnline
										? "rgba(34, 197, 94, 0.08)"
										: "rgba(239, 68, 68, 0.08)",
									border: isOnline
										? "1px solid rgba(34, 197, 94, 0.25)"
										: "1px solid rgba(239, 68, 68, 0.25)",
									borderRadius: "8px",
								}}
							>
								<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
									<HeartPulse
										size={16}
										style={{
											color: isOnline
												? "rgb(34, 197, 94)"
												: "rgb(239, 68, 68)",
										}}
									/>
									<div>
										<div
											style={{
												fontSize: "11px",
												fontWeight: 600,
												color: isOnline
													? "rgb(34, 197, 94)"
													: "rgb(239, 68, 68)",
											}}
										>
											{isOnline ? "Online" : "Offline"}
										</div>
										<div
											style={{
												fontSize: "9px",
												color: "var(--text-muted)",
												textTransform: "uppercase",
												letterSpacing: "0.5px",
											}}
										>
											Brain Health
										</div>
									</div>
								</div>
								{!isOnline && (
									<button
										type="button"
										onClick={fetchHealth}
										disabled={healthLoading}
										title="Reintentar health check"
										style={{
											background: "rgba(239, 68, 68, 0.15)",
											border: "1px solid rgba(239, 68, 68, 0.3)",
											borderRadius: "4px",
											padding: "4px 8px",
											color: "rgb(239, 68, 68)",
											cursor: "pointer",
											display: "flex",
											alignItems: "center",
											gap: "4px",
											fontSize: "10px",
											fontWeight: 600,
										}}
									>
										<RefreshCw size={12} className={healthLoading ? "animate-spin" : ""} />
										Reintentar
									</button>
								)}
							</div>

<div
								style={{
									fontSize: "11px",
									color: "var(--text-dim)",
									lineHeight: 1.5,
									background: "rgba(0,0,0,0.2)",
									padding: "10px",
									borderRadius: "6px",
								}}
							>
								El Cerebro usa <b>SQLite FTS5</b> para búsquedas instantáneas y{" "}
								<b>Vector Embeddings (Ollama)</b> para entender el contexto semántico entre recuerdos.
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
