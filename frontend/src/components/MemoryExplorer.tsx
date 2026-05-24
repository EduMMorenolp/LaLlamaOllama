import { RefreshCw, Search, Trash2 } from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import { brainApi } from "../services/api.service";

interface Memory {
	id: string;
	project: string;
	type: string;
	title: string;
	content: string;
	tags: string;
	phase?: string;
	agent?: string;
	createdAt: number;
	score?: number;
}

interface MemoryExplorerProps {
	project: string;
	onToast: (message: string, type: "success" | "error" | "info", detail?: string) => void;
}

export const MemoryExplorer: React.FC<MemoryExplorerProps> = ({ project, onToast }) => {
	const [query, setQuery] = useState("");
	const [memories, setMemories] = useState<Memory[]>([]);
	const [loading, setLoading] = useState(false);
	const [searched, setSearched] = useState(false);

	const handleSearch = useCallback(
		async (e?: React.FormEvent) => {
			e?.preventDefault();
			if (!query.trim()) return;
			setLoading(true);
			setSearched(true);
			try {
				const res = await brainApi.get(
					`/api/memory/search?q=${encodeURIComponent(query.trim())}&project=${project}`
				);
				setMemories(res.data);
			} catch (error: unknown) {
				const msg =
					error instanceof Error
						? error.message
						: (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
							"Error al buscar memorias";
				onToast("Error al buscar", "error", msg);
			} finally {
				setLoading(false);
			}
		},
		[query, project, onToast]
	);

	const handleDelete = useCallback(
		async (id: string, title: string) => {
			if (!window.confirm(`¿Eliminar la memoria "${title}"?\n\nEsta acción es irreversible.`)) return;
			try {
				await brainApi.delete(`/api/memory/${id}`);
				setMemories((prev) => prev.filter((m) => m.id !== id));
				onToast("Memoria eliminada", "success", `"${title}" ha sido borrada del cerebro.`);
			} catch (error: unknown) {
				const msg =
					error instanceof Error
						? error.message
						: (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
							"Error al eliminar memoria";
				onToast("Error al eliminar", "error", msg);
			}
		},
		[onToast]
	);

	const contentPreview = (content: string, maxLen = 120): string => {
		const stripped = content.replace(/[*#_`\[\]]/g, "").replace(/\s+/g, " ").trim();
		return stripped.length > maxLen ? `${stripped.slice(0, maxLen)}...` : stripped;
	};

	return (
		<div className="card-glass" style={{ padding: "24px", minHeight: "calc(100vh - 200px)" }}>
			<form onSubmit={handleSearch} className="model-search-bar" style={{ marginBottom: "24px" }}>
				<div className="input-container" style={{ flex: 1 }}>
					<Search size={18} style={{ color: "var(--text-muted)" }} />
					<input
						type="text"
						placeholder="Buscar memorias por texto..."
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						className="input-field"
					/>
				</div>
				<button
					type="submit"
					className="btn-send"
					disabled={loading || !query.trim()}
					style={{ width: "auto", padding: "0 20px" }}
				>
					{loading ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
					<span>{loading ? "Buscando..." : "Buscar"}</span>
				</button>
			</form>

			{!searched ? (
				<div style={{ textAlign: "center", padding: "80px 0", opacity: 0.3 }}>
					<Search size={48} style={{ margin: "0 auto 16px", display: "block" }} />
					<p style={{ fontSize: "14px" }}>Ingresa un texto y presiona "Buscar" para explorar memorias.</p>
				</div>
			) : memories.length === 0 ? (
				<div style={{ textAlign: "center", padding: "64px 0", opacity: 0.3 }}>
					<p style={{ fontSize: "14px" }}>No se encontraron memorias para esta búsqueda.</p>
				</div>
			) : (
				<>
					<div
						className="flex-between"
						style={{ marginBottom: "16px", padding: "0 4px", fontSize: "12px", color: "var(--text-dim)" }}
					>
						<span>
							Mostrando {memories.length} resultado{memories.length !== 1 ? "s" : ""}
						</span>
					</div>
					<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
						{memories.map((mem) => (
							<div
								key={mem.id}
								style={{
									background: "rgba(255,255,255,0.02)",
									border: "1px solid var(--border-light)",
									borderRadius: "10px",
									padding: "14px 16px",
									transition: "var(--transition)",
								}}
							>
								<div className="flex-between" style={{ marginBottom: "8px" }}>
									<div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
										<span
											style={{
												fontSize: "10px",
												fontWeight: 600,
												padding: "2px 8px",
												borderRadius: "4px",
												background: "rgba(79, 140, 255, 0.15)",
												color: "var(--accent)",
												textTransform: "uppercase",
											}}
										>
											{mem.type}
										</span>
										<h4 style={{ fontSize: "14px", fontWeight: 600 }}>{mem.title}</h4>
									</div>
									<div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
										<span
											style={{
												fontSize: "10px",
												color: "var(--text-muted)",
												fontFamily: "var(--font-mono)",
											}}
										>
											{new Date(mem.createdAt).toLocaleDateString()}
										</span>
										<button
											type="button"
											onClick={() => handleDelete(mem.id, mem.title)}
											title="Eliminar memoria"
											style={{
												background: "none",
												border: "none",
												color: "rgba(239, 68, 68, 0.6)",
												cursor: "pointer",
												padding: "4px",
												borderRadius: "4px",
												display: "flex",
												transition: "all 0.2s",
											}}
											onMouseEnter={(e) => {
												e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
												e.currentTarget.style.color = "rgb(239, 68, 68)";
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.background = "transparent";
												e.currentTarget.style.color = "rgba(239, 68, 68, 0.6)";
											}}
										>
											<Trash2 size={14} />
										</button>
									</div>
								</div>

								{mem.content && (
									<p
										style={{
											fontSize: "12px",
											color: "var(--text-dim)",
											lineHeight: 1.5,
											marginBottom: "8px",
										}}
									>
										{contentPreview(mem.content)}
									</p>
								)}

								<div
									className="flex-between"
									style={{
										borderTop: "1px solid var(--border)",
										paddingTop: "8px",
										fontSize: "10px",
										color: "var(--text-muted)",
									}}
								>
									<span style={{ fontFamily: "var(--font-mono)" }}>
										ID: {mem.id.slice(0, 12)}...
									</span>
									{mem.agent && <span>agente: {mem.agent}</span>}
								</div>
							</div>
						))}
					</div>
				</>
			)}
		</div>
	);
};
