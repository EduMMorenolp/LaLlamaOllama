import { Brain, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { config } from "../config";

interface MemoryResult {
	id: string;
	title: string;
	content: string;
	type: string;
	tags: string;
	createdAt: number;
	similarity?: number;
}

interface MemoryStats {
	total?: number;
	byType?: Record<string, number>;
}

const PAGE_SIZE = 20;

export const Memoria: React.FC = () => {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<MemoryResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [stats, setStats] = useState<MemoryStats>({});
	const [selectedMemory, setSelectedMemory] = useState<MemoryResult | null>(null);
	const [searchMode, setSearchMode] = useState<"semantic" | "lexical" | "hybrid">("semantic");
	const [offset, setOffset] = useState(0);
	const [loadingMore, setLoadingMore] = useState(false);

	const apiHeaders = { "X-API-Key": config.apiKey };

	const fetchStats = useCallback(async () => {
		try {
			const res = await fetch(`${config.engineUrl}/api/memory/stats`, {
				headers: apiHeaders,
			});
			const data = await res.json();
			setStats(data);
		} catch { /* ignore */ }
	}, []);

	useEffect(() => {
		fetchStats();
	}, [fetchStats]);

	const handleSearch = useCallback(async (append = false) => {
		if (!query.trim()) {
			setResults([]);
			return;
		}
		if (append) {
			setLoadingMore(true);
		} else {
			setLoading(true);
			setOffset(0);
		}
		try {
			const currentOffset = append ? offset : 0;
			const res = await fetch(
				`${config.engineUrl}/api/memory/search?q=${encodeURIComponent(query)}&mode=${searchMode}&limit=${PAGE_SIZE}&offset=${currentOffset}`,
				{ headers: apiHeaders }
			);
			const data = await res.json();
			const newResults = data.results || [];
			if (append) {
				setResults((prev) => [...prev, ...newResults]);
			} else {
				setResults(newResults);
			}
			setOffset(currentOffset + newResults.length);
		} catch {
			setResults([]);
		} finally {
			setLoading(false);
			setLoadingMore(false);
		}
	}, [query, searchMode, offset]);

	useEffect(() => {
		const timer = setTimeout(() => handleSearch(false), 400);
		return () => clearTimeout(timer);
	}, [query, searchMode]);

	const typeColors: Record<string, string> = {
		knowledge: "var(--accent)",
		decision: "#7c3aed",
		feature: "var(--success)",
		"bug-fix": "var(--error)",
		architecture: "#f59e0b",
		configuration: "#06b6d4",
		discovery: "#ec4899",
		learning: "#14b8a6",
		prompt: "#8b5cf6",
	};

	return (
		<div style={{ height: "calc(100vh - 160px)", display: "flex", flexDirection: "column" }}>
			{/* Stats */}
			<div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
				<div style={{
					padding: "12px 16px",
					borderRadius: "8px",
					background: "rgba(255,255,255,0.02)",
					border: "1px solid var(--border-light)",
				}}>
					<div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Total</div>
					<div style={{ fontSize: "24px", fontWeight: 700, color: "var(--accent)", marginTop: "4px" }}>{stats.total || 0}</div>
				</div>
				{stats.byType && Object.entries(stats.byType).slice(0, 4).map(([type, count]) => (
					<div key={type} style={{
						padding: "12px 16px",
						borderRadius: "8px",
						background: "rgba(255,255,255,0.02)",
						border: "1px solid var(--border-light)",
						minWidth: "80px",
					}}>
						<div style={{ fontSize: "9px", fontWeight: 600, color: typeColors[type] || "var(--text-dim)", textTransform: "capitalize" }}>{type}</div>
						<div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-main)", marginTop: "2px" }}>{count as number}</div>
					</div>
				))}
			</div>

			{/* Search */}
			<div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
				<div
					style={{
						flex: 1,
						display: "flex",
						alignItems: "center",
						gap: "8px",
						padding: "10px 14px",
						background: "rgba(255,255,255,0.03)",
						border: "1px solid var(--border-light)",
						borderRadius: "8px",
					}}
				>
					<Search size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
					<input
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Buscar en la memoria del agente..."
						style={{
							flex: 1,
							background: "none",
							border: "none",
							color: "var(--text-main)",
							fontSize: "13px",
							fontFamily: "inherit",
							outline: "none",
						}}
					/>
					{loading && <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-muted)" }} />}
				</div>

				{(["semantic", "lexical", "hybrid"] as const).map((mode) => (
					<button
						key={mode}
						type="button"
						onClick={() => setSearchMode(mode)}
						style={{
							padding: "6px 12px",
							borderRadius: "6px",
							border: "1px solid var(--border-light)",
							background: searchMode === mode ? "rgba(79,140,255,0.1)" : "rgba(255,255,255,0.02)",
							color: searchMode === mode ? "var(--accent)" : "var(--text-muted)",
							cursor: "pointer",
							fontSize: "10px",
							fontWeight: 600,
							textTransform: "capitalize",
						}}
					>
						{mode}
					</button>
				))}
			</div>

			{/* Results */}
			<div style={{ flex: 1, overflowY: "auto" }}>
				{!query.trim() ? (
					<div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-dim)", fontSize: "13px" }}>
						<Brain size={48} style={{ margin: "0 auto 16px", opacity: 0.15, display: "block" }} />
						Busca en la memoria del agente. Usa b\u00fasqueda sem\u00e1ntica, l\u00e9xica o h\u00edbrida.
					</div>
				) : results.length === 0 && !loading ? (
					<div style={{ textAlign: "center", padding: "40px", color: "var(--text-dim)", fontSize: "13px" }}>
						Sin resultados para "{query}".
					</div>
				) : (
					<>
						{results.map((mem) => (
							<div
								key={mem.id}
								onClick={() => setSelectedMemory(mem)}
								style={{
									padding: "12px 16px",
									marginBottom: "6px",
									borderRadius: "8px",
									background: "rgba(255,255,255,0.02)",
									border: "1px solid var(--border-light)",
									cursor: "pointer",
								}}
							>
								<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
									<span style={{
										padding: "2px 8px",
										borderRadius: "4px",
										fontSize: "9px",
										fontWeight: 700,
										textTransform: "uppercase",
										background: `${typeColors[mem.type] || "var(--text-muted)"}20`,
										color: typeColors[mem.type] || "var(--text-muted)",
									}}>
										{mem.type}
									</span>
									<span style={{ fontSize: "10px", color: "var(--text-dim)" }}>
										{mem.createdAt ? new Date(mem.createdAt).toLocaleDateString() : ""}
									</span>
									{mem.similarity != null && (
										<span style={{ fontSize: "9px", color: "var(--accent)", marginLeft: "auto" }}>
											{(mem.similarity * 100).toFixed(0)}%
										</span>
									)}
								</div>
								<div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)", marginBottom: "2px" }}>
									{mem.title}
								</div>
								<div style={{ fontSize: "11px", color: "var(--text-dim)", maxHeight: "40px", overflow: "hidden" }}>
									{mem.content}
								</div>
								{mem.tags && (
									<div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
										{mem.tags.split(",").map((tag) => (
											<span key={tag} style={{
												fontSize: "8px",
												padding: "1px 5px",
												borderRadius: "3px",
												background: "rgba(255,255,255,0.05)",
												color: "var(--text-muted)",
											}}>
												{tag.trim()}
											</span>
										))}
									</div>
								)}
							</div>
						))}
						{results.length === PAGE_SIZE && (
							<div style={{ textAlign: "center", padding: "16px" }}>
								<button
									type="button"
									onClick={() => handleSearch(true)}
									disabled={loadingMore}
									style={{
										padding: "8px 20px",
										background: "rgba(79,140,255,0.1)",
										border: "1px solid rgba(79,140,255,0.2)",
										borderRadius: "8px",
										color: "var(--accent)",
										cursor: "pointer",
										fontSize: "11px",
										fontWeight: 600,
										opacity: loadingMore ? 0.6 : 1,
									}}
								>
									{loadingMore ? "Cargando..." : "Cargar m\u00e1s"}
								</button>
							</div>
						)}
					</>
				)}
			</div>

			{/* Detail Modal */}
			{selectedMemory && (
				<div
					style={{
						position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
						background: "rgba(0,0,0,0.7)",
						backdropFilter: "blur(4px)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						zIndex: 1000,
					}}
					onClick={() => setSelectedMemory(null)}
				>
					<div
						style={{
							background: "var(--bg-surface)",
							border: "1px solid var(--border)",
							borderRadius: "16px",
							width: "600px",
							maxWidth: "90vw",
							maxHeight: "70vh",
							overflow: "auto",
							padding: "24px",
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<span style={{
							padding: "2px 10px",
							borderRadius: "4px",
							fontSize: "10px",
							fontWeight: 700,
							textTransform: "uppercase",
							background: `${typeColors[selectedMemory.type] || "var(--text-muted)"}20`,
							color: typeColors[selectedMemory.type] || "var(--text-muted)",
						}}>
							{selectedMemory.type}
						</span>
						<h3 style={{ margin: "12px 0 8px", fontSize: "18px", fontWeight: 700, color: "var(--text-main)" }}>
							{selectedMemory.title}
						</h3>
						<div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "16px" }}>
							{selectedMemory.createdAt ? new Date(selectedMemory.createdAt).toLocaleString() : ""}
							{selectedMemory.id && <> \u00b7 ID: {selectedMemory.id}</>}
						</div>
						<div style={{
							padding: "16px",
							background: "rgba(255,255,255,0.02)",
							borderRadius: "8px",
							border: "1px solid var(--border-light)",
							fontSize: "13px",
							color: "var(--text-main)",
							lineHeight: 1.6,
							whiteSpace: "pre-wrap",
						}}>
							{selectedMemory.content}
						</div>
						{selectedMemory.tags && (
							<div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "12px" }}>
								{selectedMemory.tags.split(",").map((tag) => (
									<span key={tag} style={{
										fontSize: "10px",
										padding: "2px 8px",
										borderRadius: "4px",
										background: "rgba(255,255,255,0.05)",
										color: "var(--text-muted)",
									}}>
										{tag.trim()}
									</span>
								))}
							</div>
						)}
						<button
							type="button"
							onClick={() => setSelectedMemory(null)}
							style={{
								marginTop: "20px",
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
			)}
		</div>
	);
};
