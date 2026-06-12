import {
	BookOpen,
	Brain,
	Clock,
	FileText,
	Loader2,
	Plus,
	Save,
	Search,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../contexts/ToastContext";
import { useWs } from "../contexts/WebSocketContext";
import { config } from "../config";
import { ConfirmModal } from "./ConfirmModal";

// ─── Types ──────────────────────────────────────────────────────────

interface KnowledgeFile {
	name: string;
	size: number;
	ext: string;
	modifiedAt: string;
	chunks: number;
}

interface SearchResult {
	id: string;
	title: string;
	content: string;
	type: string;
	tags: string;
	similarity?: number;
}

interface Memory {
	id: string;
	project: string;
	type: string;
	title: string;
	content: string;
	tags: string;
	phase: string;
	agent: string;
	createdAt: number;
	updatedAt: number;
}

interface MemoryStats {
	total?: number;
	byType?: Record<string, number>;
}

// ─── Constants ──────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
	knowledge: "var(--accent)",
	decision: "#7c3aed",
	feature: "var(--success)",
	"bug-fix": "var(--error)",
	architecture: "#f59e0b",
	configuration: "#06b6d4",
	discovery: "#ec4899",
	learning: "#14b8a6",
	prompt: "#8b5cf6",
	note: "#6b7280",
	system_alert: "#ef4444",
};

const MEMORY_TYPES = [
	"knowledge",
	"feature",
	"bug-fix",
	"architecture",
	"decision",
	"discovery",
	"note",
	"learning",
	"configuration",
	"prompt",
];

const apiHeaders = { "X-API-Key": config.apiKey };
const engine = config.engineUrl;

// ─── Archivos RAG Tab ───────────────────────────────────────────────

function ArchivosRag() {
	const [files, setFiles] = useState<KnowledgeFile[]>([]);
	const [loading, setLoading] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [fileName, setFileName] = useState("");
	const [fileContent, setFileContent] = useState("");
	const [showUpload, setShowUpload] = useState(false);
	const [confirmDeleteFile, setConfirmDeleteFile] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
	const [searching, setSearching] = useState(false);

	const fetchFiles = useCallback(async () => {
		try {
			const res = await fetch(`${engine}/api/knowledge`, { headers: apiHeaders });
			const data = await res.json();
			setFiles(data.files || []);
		} catch (err) {
			console.error("Failed to fetch knowledge files", err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { fetchFiles(); }, [fetchFiles]);

	const handleUpload = async () => {
		if (!fileName.trim() || !fileContent.trim()) return;
		setUploading(true);
		try {
			const res = await fetch(`${engine}/api/knowledge/upload`, {
				method: "POST",
				headers: { "Content-Type": "application/json", ...apiHeaders },
				body: JSON.stringify({ name: fileName.trim(), content: fileContent }),
			});
			const data = await res.json();
			if (data.success) {
				setFileName("");
				setFileContent("");
				setShowUpload(false);
				fetchFiles();
			}
		} catch (err) {
			console.error("Upload failed", err);
		} finally {
			setUploading(false);
		}
	};

	const handleDelete = async (name: string) => {
		try {
			await fetch(`${engine}/api/knowledge/${encodeURIComponent(name)}`, {
				method: "DELETE",
				headers: apiHeaders,
			});
			fetchFiles();
		} catch (err) {
			console.error("Delete failed", err);
		}
	};

	const handleSearch = useCallback(async () => {
		if (!searchQuery.trim()) { setSearchResults([]); return; }
		setSearching(true);
		try {
			const res = await fetch(
				`${engine}/api/memory/search?q=${encodeURIComponent(searchQuery)}&limit=10`,
				{ headers: apiHeaders }
			);
			const data = await res.json();
			setSearchResults(data.results || []);
		} catch {
			setSearchResults([]);
		} finally {
			setSearching(false);
		}
	}, [searchQuery]);

	useEffect(() => {
		const timer = setTimeout(handleSearch, 500);
		return () => clearTimeout(timer);
	}, [searchQuery, handleSearch]);

	const formatSize = (bytes: number) => {
		if (bytes < 1024) return `${bytes}B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
	};

	return (
		<div style={{ height: "calc(100vh - 200px)", display: "flex", flexDirection: "column" }}>
			<div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
				<button type="button" onClick={() => setShowUpload(!showUpload)}
					style={{ padding: "8px 16px", background: "rgba(79,140,255,0.1)", border: "1px solid rgba(79,140,255,0.2)", borderRadius: "8px", color: "var(--accent)", cursor: "pointer", fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
					{showUpload ? <X size={14} /> : <Upload size={14} />}
					{showUpload ? "Cancelar" : "Subir Archivo"}
				</button>
				<div style={{ fontSize: "11px", color: "var(--text-dim)" }}>{files.length} archivo{files.length !== 1 ? "s" : ""}</div>
			</div>

			{showUpload && (
				<div style={{ padding: "16px", marginBottom: "16px", borderRadius: "8px", background: "rgba(79,140,255,0.05)", border: "1px solid rgba(79,140,255,0.15)" }}>
					<div style={{ marginBottom: "12px" }}>
						<label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Nombre del archivo</label>
						<input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="documento.txt" style={inputStyle} />
					</div>
					<div style={{ marginBottom: "12px" }}>
						<label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Contenido</label>
						<textarea value={fileContent} onChange={(e) => setFileContent(e.target.value)} rows={8}
							style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: "12px" }}
							placeholder="Pega el contenido del archivo aquí..." />
					</div>
					<button type="button" onClick={handleUpload} disabled={uploading || !fileName.trim() || !fileContent.trim()}
						style={{ padding: "10px 20px", background: "linear-gradient(135deg, var(--accent), #7c3aed)", border: "none", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 600, opacity: uploading ? 0.6 : 1, display: "flex", alignItems: "center", gap: "6px" }}>
						{uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
						{uploading ? "Subiendo..." : "Subir e Indexar"}
					</button>
					<div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "8px" }}>El archivo se dividirá en chunks y se indexará vectorialmente en MCP Brain.</div>
				</div>
			)}

			<div style={{ flex: 1, display: "flex", gap: "16px", overflow: "hidden" }}>
				<div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
					{loading ? (
						<div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
							<Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 12px", display: "block" }} />
						</div>
					) : files.length === 0 ? (
						<div style={{ textAlign: "center", padding: "40px", color: "var(--text-dim)", fontSize: "13px" }}>
							<BookOpen size={32} style={{ margin: "0 auto 12px", opacity: 0.3, display: "block" }} />
							No hay archivos de conocimiento. Sube archivos para que el agente tenga contexto.
						</div>
					) : (
						files.map((file) => (
							<div key={file.name} style={{ padding: "12px 16px", marginBottom: "6px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: "12px" }}>
								<FileText size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
								<div style={{ flex: 1, minWidth: 0 }}>
									<div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
									<div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "2px" }}>
										{formatSize(file.size)} · {file.modifiedAt ? new Date(file.modifiedAt).toLocaleDateString() : ""}
										{file.chunks > 0 && <> · {file.chunks} chunks</>}
									</div>
								</div>
								<button type="button" onClick={() => setConfirmDeleteFile(file.name)}
									style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", opacity: 0.5, padding: "4px" }} title="Eliminar">
									<Trash2 size={14} />
								</button>
							</div>
					))
				)}
			</div>

				<div style={{ width: "360px", flexShrink: 0, display: "flex", flexDirection: "column" }}>
					<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", borderRadius: "8px", marginBottom: "12px" }}>
						<Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
						<input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Buscar en el conocimiento..."
							style={{ flex: 1, background: "none", border: "none", color: "var(--text-main)", fontSize: "12px", fontFamily: "inherit", outline: "none" }} />

					</div>
					<div style={{ flex: 1, overflowY: "auto" }}>
						{searchQuery.trim() && searchResults.length === 0 && !searching && (
							<div style={{ textAlign: "center", padding: "24px", color: "var(--text-dim)", fontSize: "12px" }}>
								Sin resultados. Sube archivos primero.
							</div>
						)}
						{searchResults.map((result) => (
							<div key={result.id} style={{ padding: "10px 12px", marginBottom: "6px", borderRadius: "6px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)" }}>
								<div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-main)", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{result.title}</div>
								<div style={{ fontSize: "10px", color: "var(--text-dim)", maxHeight: "60px", overflow: "hidden" }}>{result.content}</div>
								{result.similarity != null && (
									<div style={{ fontSize: "9px", color: "var(--accent)", marginTop: "4px" }}>
										{(result.similarity * 100).toFixed(0)}% match
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			</div>

			<ConfirmModal open={!!confirmDeleteFile} title="Eliminar archivo"
				message={confirmDeleteFile ? `¿Estás seguro de eliminar "${confirmDeleteFile}" del conocimiento?` : ""}
				confirmText="Eliminar" onConfirm={() => { if (confirmDeleteFile) { handleDelete(confirmDeleteFile); setConfirmDeleteFile(null); } }}
				onCancel={() => setConfirmDeleteFile(null)} danger />
		</div>
	);
}

// ─── Cerebro Tab ────────────────────────────────────────────────────

const PAGE_SIZE = 50;

function Cerebro() {
	const { show: showToast } = useToast();
	const { subscribe } = useWs();
	const [memories, setMemories] = useState<Memory[]>([]);
	const [stats, setStats] = useState<MemoryStats>({});
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [filterType, setFilterType] = useState("");
	const [tagsFilter, setTagsFilter] = useState("");
	const [sortBy, setSortBy] = useState<"date" | "type">("date");
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
	const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
	const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
	const [editTitle, setEditTitle] = useState("");
	const [editContent, setEditContent] = useState("");
	const [editTags, setEditTags] = useState("");
	const [editType, setEditType] = useState("");
	const [saving, setSaving] = useState(false);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
	const [showNewMemo, setShowNewMemo] = useState(false);
	const [newTitle, setNewTitle] = useState("");
	const [newContent, setNewContent] = useState("");
	const [newType, setNewType] = useState("note");
	const [newTags, setNewTags] = useState("");
	const [creating, setCreating] = useState(false);
	const [consolidating, setConsolidating] = useState(false);
	const [consolidateResult, setConsolidateResult] = useState("");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const sentinelRef = useRef<HTMLDivElement | null>(null);
	const offsetRef = useRef(0);

	const fetchMemories = useCallback(async (append = false) => {
		if (!append) { setLoading(true); offsetRef.current = 0; }
		else setLoadingMore(true);
		try {
			const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offsetRef.current) });
			if (filterType) params.set("type", filterType);
			let data: Memory[];
			if (searchQuery.trim()) {
				params.set("q", searchQuery.trim());
				const res = await fetch(`${engine}/api/memory/search?${params}`, { headers: apiHeaders });
				data = (await res.json()).results || [];
			} else {
				const res = await fetch(`${engine}/api/memory/timeline?${params}`, { headers: apiHeaders });
				data = (await res.json()) || [];
			}
			if (append) {
				setMemories((prev) => [...prev, ...data]);
			} else {
				setMemories(data);
			}
			setHasMore(data.length >= PAGE_SIZE);
			offsetRef.current += data.length;
		} catch (err) {
			console.error("Failed to fetch memories", err);
		} finally {
			setLoading(false);
			setLoadingMore(false);
		}
	}, [searchQuery, filterType]);

	const fetchStats = useCallback(async () => {
		try {
			const res = await fetch(`${engine}/api/memory/stats`, { headers: apiHeaders });
			const data = await res.json();
			setStats(data);
		} catch { /* ignore */ }
	}, []);

	useEffect(() => { fetchStats(); }, [fetchStats]);
	useEffect(() => { fetchMemories(); }, [fetchMemories]);

	// Infinite scroll via IntersectionObserver
	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
					fetchMemories(true);
				}
			},
			{ root: scrollRef.current, rootMargin: "200px" }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [hasMore, loadingMore, loading, fetchMemories]);

	// WS sync: refresh when another client changes memories
	useEffect(() => {
		const unsub = subscribe((msg: { type: string }) => {
			if (msg.type === "memory_changed") {
				fetchMemories();
				fetchStats();
			}
		});
		return unsub;
	}, [subscribe, fetchMemories, fetchStats]);

	const handleDelete = async (id: string) => {
		try {
			await fetch(`${engine}/api/memory/${encodeURIComponent(id)}`, {
				method: "DELETE",
				headers: apiHeaders,
			});
			setMemories((prev) => prev.filter((m) => m.id !== id));
			setConfirmDeleteId(null);
			setSelectedMemory(null);
			fetchStats();
			showToast("Memoria eliminada", "success");
		} catch (err) {
			showToast("Error al eliminar memoria", "error");
		}
	};

	const handleBulkDelete = async () => {
		for (const id of selectedIds) {
			await fetch(`${engine}/api/memory/${encodeURIComponent(id)}`, {
				method: "DELETE",
				headers: apiHeaders,
			});
		}
		setMemories((prev) => prev.filter((m) => !selectedIds.has(m.id)));
		setSelectedIds(new Set());
		fetchStats();
		showToast(`${selectedIds.size} memorias eliminadas`, "success");
	};

	const openEdit = (mem: Memory) => {
		setEditingMemory(mem);
		setEditTitle(mem.title);
		setEditContent(mem.content);
		setEditTags(mem.tags || "");
		setEditType(mem.type);
	};

	const handleSaveEdit = async () => {
		if (!editingMemory) return;
		setSaving(true);
		try {
			const res = await fetch(`${engine}/api/memory/${encodeURIComponent(editingMemory.id)}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json", ...apiHeaders },
				body: JSON.stringify({ title: editTitle, content: editContent, tags: editTags, type: editType }),
			});
			if (res.ok) {
				setMemories((prev) => prev.map((m) => m.id === editingMemory.id ? { ...m, title: editTitle, content: editContent, tags: editTags, type: editType, updatedAt: Date.now() } : m));
				if (selectedMemory?.id === editingMemory.id) {
					setSelectedMemory({ ...selectedMemory, title: editTitle, content: editContent, tags: editTags, type: editType });
				}
				setEditingMemory(null);
				showToast("Memoria actualizada", "success");
			}
		} catch (err) {
			showToast("Error al guardar memoria", "error");
		} finally {
			setSaving(false);
		}
	};

	const handleCreateMemo = async () => {
		if (!newTitle.trim() || !newContent.trim()) return;
		setCreating(true);
		try {
			await fetch(`${engine}/api/memory`, {
				method: "POST",
				headers: { "Content-Type": "application/json", ...apiHeaders },
				body: JSON.stringify({ type: newType, title: newTitle.trim(), content: newContent.trim(), tags: newTags.trim() }),
			});
			setNewTitle("");
			setNewContent("");
			setNewTags("");
			setShowNewMemo(false);
			fetchMemories();
			fetchStats();
			showToast("Memoria creada", "success");
		} catch (err) {
			showToast("Error al crear memoria", "error");
		} finally {
			setCreating(false);
		}
	};

	const handleConsolidate = async () => {
		setConsolidating(true);
		setConsolidateResult("");
		try {
			const res = await fetch(`${engine}/api/memory/consolidate`, {
				method: "POST",
				headers: { "Content-Type": "application/json", ...apiHeaders },
				body: JSON.stringify({ project: "lallamaollama" }),
			});
			const data = await res.json();
			const msg = data.message || data.summary || "Consolidación completada";
			setConsolidateResult(msg);
			showToast(`Consolidación: ${data.consolidatedGroups || 0} grupos consolidados`, "success");
			fetchMemories();
			fetchStats();
		} catch (err) {
			setConsolidateResult("Error al consolidar");
			showToast("Error al consolidar memorias", "error");
		} finally {
			setConsolidating(false);
		}
	};

	const toggleSelect = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const formatDate = (ts: number) => new Date(ts).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

	// Client-side sort + tags filter
	const filteredMemories = memories
		.filter((m) => {
			if (!tagsFilter.trim()) return true;
			const tagList = tagsFilter.split(",").map((t) => t.trim().toLowerCase());
			return tagList.some((tag) => (m.tags || "").toLowerCase().includes(tag));
		})
		.sort((a, b) => {
			if (sortBy === "type") {
				const cmp = a.type.localeCompare(b.type);
				return sortOrder === "asc" ? cmp : -cmp;
			}
			return sortOrder === "asc" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
		});

	return (
		<div style={{ height: "calc(100vh - 200px)", display: "flex", flexDirection: "column" }}>
			{/* Stats Bar */}
			<div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
				<div style={{ padding: "8px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)" }}>
					<div style={{ fontSize: "9px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Total</div>
					<div style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent)" }}>{stats.total || 0}</div>
				</div>
				{stats.byType && Object.entries(stats.byType).slice(0, 6).map(([type, count]) => (
					<div key={type} style={{ padding: "8px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", cursor: "pointer", opacity: filterType === type ? 1 : 0.6, outline: filterType === type ? `1px solid ${TYPE_COLORS[type] || "var(--accent)"}` : undefined }}
						onClick={() => setFilterType(filterType === type ? "" : type)}>
						<div style={{ fontSize: "9px", fontWeight: 600, color: TYPE_COLORS[type] || "var(--text-dim)", textTransform: "capitalize" }}>{type}</div>
						<div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>{count as number}</div>
					</div>
				))}
			</div>

			{/* Actions + Filters */}
			<div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center", flexWrap: "wrap" }}>
				<button type="button" onClick={() => setShowNewMemo(true)}
					style={{ padding: "6px 14px", background: "rgba(79,140,255,0.1)", border: "1px solid rgba(79,140,255,0.2)", borderRadius: "8px", color: "var(--accent)", cursor: "pointer", fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
					<Plus size={14} /> Nueva Memoria
				</button>
				<button type="button" onClick={handleConsolidate} disabled={consolidating}
					style={{ padding: "6px 14px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "8px", color: "var(--success)", cursor: "pointer", fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", opacity: consolidating ? 0.6 : 1 }}>
					{consolidating ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
					{consolidating ? "Consolidando..." : "Consolidar"}
				</button>
				{selectedIds.size > 0 && (
					<button type="button" onClick={handleBulkDelete}
						style={{ padding: "6px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", color: "var(--error)", cursor: "pointer", fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
						<Trash2 size={14} /> Eliminar {selectedIds.size}
					</button>
				)}
				{filterType && (
					<button type="button" onClick={() => setFilterType("")}
						style={{ padding: "4px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", borderRadius: "6px", color: "var(--text-muted)", cursor: "pointer", fontSize: "10px" }}>
						<X size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} /> Limpiar filtro
					</button>
				)}
				<div style={{ flex: 1 }} />
				<input type="text" value={tagsFilter} onChange={(e) => setTagsFilter(e.target.value)}
					placeholder="Filtrar por tags..."
					style={{ width: "140px", padding: "6px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text-main)", fontSize: "10px", fontFamily: "inherit", outline: "none" }} />
				<select value={sortBy === "date" ? (sortOrder === "desc" ? "date_desc" : "date_asc") : "type"}
					onChange={(e) => {
						const v = e.target.value;
						if (v === "type") { setSortBy("type"); setSortOrder("asc"); }
						else if (v === "date_asc") { setSortBy("date"); setSortOrder("asc"); }
						else { setSortBy("date"); setSortOrder("desc"); }
					}}
					style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text-main)", fontSize: "10px", fontFamily: "inherit", outline: "none", cursor: "pointer" }}>
					<option value="date_desc">Fecha ↓</option>
					<option value="date_asc">Fecha ↑</option>
					<option value="type">Tipo</option>
				</select>
				<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", borderRadius: "8px", maxWidth: "220px" }}>
					<Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
					<input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Buscar..."
						style={{ flex: 1, background: "none", border: "none", color: "var(--text-main)", fontSize: "10px", fontFamily: "inherit", outline: "none", width: "100%" }} />
				</div>
			</div>

			{consolidateResult && (
				<div style={{ padding: "10px 14px", marginBottom: "12px", borderRadius: "8px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", fontSize: "11px", color: "var(--success)", display: "flex", alignItems: "center", gap: "8px" }}>
					<Brain size={14} /> {consolidateResult}
					<button type="button" onClick={() => setConsolidateResult("")} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px" }}><X size={12} /></button>
				</div>
			)}

			{/* New Memory Form */}
			{showNewMemo && (
				<div style={{ padding: "16px", marginBottom: "12px", borderRadius: "8px", background: "rgba(79,140,255,0.05)", border: "1px solid rgba(79,140,255,0.15)" }}>
					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
						<div>
							<label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Título</label>
							<input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Título de la memoria" style={inputStyle} />
						</div>
						<div>
							<label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Tipo</label>
							<select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
								{MEMORY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
							</select>
						</div>
					</div>
					<div style={{ marginBottom: "12px" }}>
						<label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Contenido</label>
						<textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={4} placeholder="Contenido de la memoria..."
							style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: "12px" }} />
					</div>
					<div style={{ marginBottom: "12px" }}>
						<label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Tags (separados por coma)</label>
						<input type="text" value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="tag1, tag2, tag3" style={inputStyle} />
					</div>
					<div style={{ display: "flex", gap: "8px" }}>
						<button type="button" onClick={handleCreateMemo} disabled={creating || !newTitle.trim() || !newContent.trim()}
							style={{ padding: "8px 20px", background: "linear-gradient(135deg, var(--accent), #7c3aed)", border: "none", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "11px", fontWeight: 600, opacity: creating ? 0.6 : 1, display: "flex", alignItems: "center", gap: "6px" }}>
							{creating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
							{creating ? "Guardando..." : "Guardar Memoria"}
						</button>
						<button type="button" onClick={() => setShowNewMemo(false)}
							style={{ padding: "8px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text-muted)", cursor: "pointer", fontSize: "11px" }}>
							Cancelar
						</button>
					</div>
				</div>
			)}

			{/* Memory List */}
			<div ref={scrollRef} style={{ flex: 1, overflowY: "auto" }}>
				{loading ? (
					<div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
						<Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 12px", display: "block" }} />
					</div>
				) : filteredMemories.length === 0 ? (
					<div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-dim)", fontSize: "13px" }}>
						<Brain size={48} style={{ margin: "0 auto 16px", opacity: 0.15, display: "block" }} />
						{searchQuery || filterType || tagsFilter ? "Sin resultados para esta búsqueda." : "No hay memorias en el Cerebro. Las memorias se crean automáticamente cuando el agente trabaja."}
					</div>
				) : (
					filteredMemories.map((mem) => (
						<div key={mem.id}
							style={{
								padding: "10px 14px",
								marginBottom: "4px",
								borderRadius: "8px",
								background: "rgba(255,255,255,0.02)",
								border: "1px solid var(--border-light)",
								display: "flex",
								alignItems: "center",
								gap: "10px",
								cursor: "pointer",
								...(selectedIds.has(mem.id) ? { outline: "2px solid var(--accent)" } : {}),
							}}
							onClick={() => setSelectedMemory(mem)}>
							<input type="checkbox" checked={selectedIds.has(mem.id)}
								onChange={(e) => { e.stopPropagation(); toggleSelect(mem.id); }}
								style={{ accentColor: "var(--accent)", cursor: "pointer", flexShrink: 0 }} />
							<span style={{
								padding: "2px 6px",
								borderRadius: "4px",
								fontSize: "8px",
								fontWeight: 700,
								textTransform: "uppercase",
								background: `${TYPE_COLORS[mem.type] || "var(--text-muted)"}20`,
								color: TYPE_COLORS[mem.type] || "var(--text-muted)",
								flexShrink: 0,
								minWidth: "50px",
								textAlign: "center",
							}}>{mem.type}</span>
							<div style={{ flex: 1, minWidth: 0 }}>
								<div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mem.title}</div>
							</div>
							<div style={{ fontSize: "9px", color: "var(--text-dim)", flexShrink: 0 }}>{formatDate(mem.createdAt)}</div>
							<button type="button" onClick={(e) => { e.stopPropagation(); openEdit(mem); }}
								style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", opacity: 0.5, padding: "4px" }} title="Editar">
								<Save size={12} />
							</button>
							<button type="button" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(mem.id); }}
								style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", opacity: 0.5, padding: "4px" }} title="Eliminar">
								<Trash2 size={12} />
							</button>
						</div>
					))
				)}
				{loadingMore && (
					<div style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)" }}>
						<Loader2 size={16} className="animate-spin" style={{ margin: "0 auto", display: "block" }} />
					</div>
				)}
				<div ref={sentinelRef} style={{ height: 1 }} />
			</div>

			{/* Detail Modal */}
			{selectedMemory && !editingMemory && (
				<div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
					onClick={() => setSelectedMemory(null)}>
					<div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "16px", width: "640px", maxWidth: "90vw", maxHeight: "80vh", overflow: "auto", padding: "24px" }}
						onClick={(e) => e.stopPropagation()}>
						<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
							<span style={{ padding: "2px 10px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", background: `${TYPE_COLORS[selectedMemory.type] || "var(--text-muted)"}20`, color: TYPE_COLORS[selectedMemory.type] || "var(--text-muted)" }}>
								{selectedMemory.type}
							</span>
							{selectedMemory.phase && (
								<span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "9px", fontWeight: 600, background: "rgba(139,92,246,0.15)", color: "#8b5cf6" }}>
									{selectedMemory.phase}
								</span>
							)}
						</div>
						<h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>{selectedMemory.title}</h3>
						<div style={{ fontSize: "10px", color: "var(--text-dim)", marginBottom: "16px" }}>
							{formatDate(selectedMemory.createdAt)}
							{selectedMemory.agent && <> · por {selectedMemory.agent}</>}
							{selectedMemory.id && <> · ID: {selectedMemory.id}</>}
						</div>
						<div style={{ padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--border-light)", fontSize: "13px", color: "var(--text-main)", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: "300px", overflow: "auto" }}>
							{selectedMemory.content}
						</div>
						{selectedMemory.tags && (
							<div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "12px" }}>
								{selectedMemory.tags.split(",").map((tag) => (
									<span key={tag} style={{ fontSize: "9px", padding: "2px 8px", borderRadius: "4px", background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>{tag.trim()}</span>
								))}
							</div>
						)}
						<div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
							<button type="button" onClick={() => openEdit(selectedMemory)}
								style={{ padding: "8px 20px", background: "rgba(79,140,255,0.1)", border: "1px solid rgba(79,140,255,0.2)", borderRadius: "8px", color: "var(--accent)", cursor: "pointer", fontSize: "11px", fontWeight: 600 }}>
								<Save size={14} style={{ marginRight: "6px", verticalAlign: "middle" }} /> Editar
							</button>
							<button type="button" onClick={() => { setConfirmDeleteId(selectedMemory.id); }}
								style={{ padding: "8px 20px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", color: "var(--error)", cursor: "pointer", fontSize: "11px", fontWeight: 600 }}>
								<Trash2 size={14} style={{ marginRight: "6px", verticalAlign: "middle" }} /> Eliminar
							</button>
							<button type="button" onClick={() => setSelectedMemory(null)}
								style={{ padding: "8px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text-muted)", cursor: "pointer", fontSize: "11px" }}>
								Cerrar
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Edit Modal */}
			{editingMemory && (
				<div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
					onClick={() => setEditingMemory(null)}>
					<div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "16px", width: "640px", maxWidth: "90vw", maxHeight: "80vh", overflow: "auto", padding: "24px" }}
						onClick={(e) => e.stopPropagation()}>
						<h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>Editar Memoria</h3>
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
							<div>
								<label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Título</label>
								<input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={inputStyle} />
							</div>
							<div>
								<label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Tipo</label>
								<select value={editType} onChange={(e) => setEditType(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
									{MEMORY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
								</select>
							</div>
						</div>
						<div style={{ marginBottom: "12px" }}>
							<label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Contenido</label>
							<textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={8}
								style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: "12px" }} />
						</div>
						<div style={{ marginBottom: "16px" }}>
							<label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Tags</label>
							<input type="text" value={editTags} onChange={(e) => setEditTags(e.target.value)} style={inputStyle} />
						</div>
						<div style={{ display: "flex", gap: "8px" }}>
							<button type="button" onClick={handleSaveEdit} disabled={saving}
								style={{ padding: "10px 24px", background: "linear-gradient(135deg, var(--accent), #7c3aed)", border: "none", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 600, opacity: saving ? 0.6 : 1, display: "flex", alignItems: "center", gap: "6px" }}>
								{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
								{saving ? "Guardando..." : "Guardar Cambios"}
							</button>
							<button type="button" onClick={() => setEditingMemory(null)}
								style={{ padding: "10px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", borderRadius: "8px", color: "var(--text-muted)", cursor: "pointer", fontSize: "12px" }}>
								Cancelar
							</button>
						</div>
					</div>
				</div>
			)}

			<ConfirmModal open={!!confirmDeleteId} title="Eliminar memoria"
				message={"¿Estás seguro de eliminar esta memoria? No se puede deshacer."}
				confirmText="Eliminar" onConfirm={() => { if (confirmDeleteId) { handleDelete(confirmDeleteId); } }}
				onCancel={() => setConfirmDeleteId(null)} danger />
		</div>
	);
}

// ─── Timeline Tab ───────────────────────────────────────────────────

function Timeline() {
	const [memories, setMemories] = useState<Memory[]>([]);
	const [loading, setLoading] = useState(true);
	const [filterType, setFilterType] = useState("");

	const fetchTimeline = useCallback(async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams({ limit: "100" });
			if (filterType) params.set("type", filterType);
			const res = await fetch(`${engine}/api/memory/timeline?${params}`, { headers: apiHeaders });
			const data = await res.json();
			setMemories(Array.isArray(data) ? data : []);
		} catch (err) {
			console.error("Failed to fetch timeline", err);
		} finally {
			setLoading(false);
		}
	}, [filterType]);

	useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

	const groupedByDay = memories.reduce<Record<string, Memory[]>>((acc, mem) => {
		const day = new Date(mem.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
		if (!acc[day]) acc[day] = [];
		acc[day].push(mem);
		return acc;
	}, {});

	return (
		<div style={{ height: "calc(100vh - 200px)", display: "flex", flexDirection: "column" }}>
			<div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
				<button type="button" onClick={fetchTimeline} style={{ padding: "6px 14px", background: "rgba(79,140,255,0.1)", border: "1px solid rgba(79,140,255,0.2)", borderRadius: "8px", color: "var(--accent)", cursor: "pointer", fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
					<Clock size={14} /> Refrescar
				</button>
				{MEMORY_TYPES.map((t) => (
					<button key={t} type="button" onClick={() => setFilterType(filterType === t ? "" : t)}
						style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border-light)", background: filterType === t ? "rgba(79,140,255,0.1)" : "rgba(255,255,255,0.02)", color: filterType === t ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", fontSize: "9px", fontWeight: 600, textTransform: "capitalize" }}>
						{t}
					</button>
				))}
				{filterType && (
					<button type="button" onClick={() => setFilterType("")}
						style={{ padding: "4px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", borderRadius: "6px", color: "var(--text-muted)", cursor: "pointer", fontSize: "9px" }}>
						<X size={10} style={{ marginRight: "2px", verticalAlign: "middle" }} /> Limpiar
					</button>
				)}
			</div>
			<div style={{ flex: 1, overflowY: "auto" }}>
				{loading ? (
					<div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
						<Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 12px", display: "block" }} />
					</div>
				) : Object.keys(groupedByDay).length === 0 ? (
					<div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-dim)", fontSize: "13px" }}>
						<Clock size={48} style={{ margin: "0 auto 16px", opacity: 0.15, display: "block" }} />
						No hay memorias en la línea de tiempo.
					</div>
				) : (
					Object.entries(groupedByDay).reverse().map(([day, mems]) => (
						<div key={day} style={{ marginBottom: "16px" }}>
							<div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", padding: "4px 0", borderBottom: "1px solid var(--border-light)" }}>
								{day} · {mems.length} memoria{mems.length !== 1 ? "s" : ""}
							</div>
							{mems.map((mem) => (
								<div key={mem.id} style={{ padding: "8px 12px", marginBottom: "4px", borderRadius: "6px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: "8px" }}>
									<span style={{
										padding: "1px 6px",
										borderRadius: "3px",
										fontSize: "8px",
										fontWeight: 700,
										textTransform: "uppercase",
										background: `${TYPE_COLORS[mem.type] || "var(--text-muted)"}20`,
										color: TYPE_COLORS[mem.type] || "var(--text-muted)",
										flexShrink: 0,
									}}>{mem.type}</span>
									<span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-main)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mem.title}</span>
									<span style={{ fontSize: "9px", color: "var(--text-dim)", flexShrink: 0 }}>
										{new Date(mem.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
									</span>
								</div>
							))}
						</div>
					))
				)}
			</div>
		</div>
	);
}

// ─── Main Component ─────────────────────────────────────────────────

type KnowledgeTab = "archivos" | "cerebro" | "timeline";

export const Knowledge: React.FC = () => {
	const [tab, setTab] = useState<KnowledgeTab>("cerebro");

	return (
		<div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
			{/* Tabs */}
			<div style={{ display: "flex", gap: "4px", marginBottom: "16px", borderBottom: "1px solid var(--border-light)", paddingBottom: "8px" }}>
				{[
					{ id: "cerebro" as const, label: "Cerebro 🧠", sub: "Memorias del agente" },
					{ id: "timeline" as const, label: "Línea de Tiempo 📅", sub: "Historial cronológico" },
					{ id: "archivos" as const, label: "Archivos RAG 📄", sub: "Documentos indexados" },
				].map((t) => (
					<button key={t.id} type="button" onClick={() => setTab(t.id)}
						style={{
							padding: "8px 16px",
							borderRadius: "8px 8px 0 0",
							border: "none",
							borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
							background: tab === t.id ? "rgba(79,140,255,0.06)" : "transparent",
							color: tab === t.id ? "var(--accent)" : "var(--text-muted)",
							cursor: "pointer",
							fontSize: "12px",
							fontWeight: tab === t.id ? 700 : 500,
							transition: "var(--transition)",
						}}>
						{t.label}
					</button>
				))}
			</div>

			{tab === "archivos" && <ArchivosRag />}
			{tab === "cerebro" && <Cerebro />}
			{tab === "timeline" && <Timeline />}
		</div>
	);
};

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
	outline: "none",
};
