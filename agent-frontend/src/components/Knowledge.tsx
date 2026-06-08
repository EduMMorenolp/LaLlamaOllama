import { BookOpen, FileText, Loader2, Search, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { config } from "../config";
import { ConfirmModal } from "./ConfirmModal";

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

export const Knowledge: React.FC = () => {
	const [files, setFiles] = useState<KnowledgeFile[]>([]);
	const [loading, setLoading] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [fileName, setFileName] = useState("");
	const [fileContent, setFileContent] = useState("");
	const [showUpload, setShowUpload] = useState(false);
	const [confirmDeleteFile, setConfirmDeleteFile] = useState<string | null>(null);

	// Search
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
	const [searching, setSearching] = useState(false);

	const apiHeaders = { "X-API-Key": config.apiKey };

	const fetchFiles = useCallback(async () => {
		try {
			const res = await fetch(`${config.engineUrl}/api/knowledge`, { headers: apiHeaders });
			const data = await res.json();
			setFiles(data.files || []);
		} catch (err) {
			console.error("Failed to fetch knowledge files", err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchFiles();
	}, [fetchFiles]);

	const handleUpload = async () => {
		if (!fileName.trim() || !fileContent.trim()) return;
		setUploading(true);
		try {
			const res = await fetch(`${config.engineUrl}/api/knowledge/upload`, {
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
			await fetch(`${config.engineUrl}/api/knowledge/${encodeURIComponent(name)}`, {
				method: "DELETE",
				headers: apiHeaders,
			});
			fetchFiles();
		} catch (err) {
			console.error("Delete failed", err);
		}
	};

	const handleSearch = useCallback(async () => {
		if (!searchQuery.trim()) {
			setSearchResults([]);
			return;
		}
		setSearching(true);
		try {
			const res = await fetch(
				`${config.engineUrl}/api/memory/search?q=${encodeURIComponent(searchQuery)}&limit=10`,
				{ headers: apiHeaders }
			);
			const data = await res.json();
			setSearchResults(data.results || []);
		} catch (err) {
			console.error("Search failed", err);
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
		<div style={{ height: "calc(100vh - 160px)", display: "flex", flexDirection: "column" }}>
			{/* Top Actions */}
			<div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
				<button
					type="button"
					onClick={() => setShowUpload(!showUpload)}
					style={{
						padding: "8px 16px",
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
					{showUpload ? <X size={14} /> : <Upload size={14} />}
					{showUpload ? "Cancelar" : "Subir Archivo"}
				</button>
				<div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
					{files.length} archivo{files.length !== 1 ? "s" : ""}
				</div>
			</div>

			{/* Upload Form */}
			{showUpload && (
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
						<label
							style={{
								fontSize: "11px",
								fontWeight: 600,
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "4px",
							}}
						>
							Nombre del archivo
						</label>
						<input
							type="text"
							value={fileName}
							onChange={(e) => setFileName(e.target.value)}
							placeholder="documento.txt"
							style={inputStyle}
						/>
					</div>
					<div style={{ marginBottom: "12px" }}>
						<label
							style={{
								fontSize: "11px",
								fontWeight: 600,
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "4px",
							}}
						>
							Contenido
						</label>
						<textarea
							value={fileContent}
							onChange={(e) => setFileContent(e.target.value)}
							rows={8}
							style={{
								...inputStyle,
								resize: "vertical",
								fontFamily: "var(--font-mono)",
								fontSize: "12px",
							}}
							placeholder="Pega el contenido del archivo aqu\u00ed..."
						/>
					</div>
					<button
						type="button"
						onClick={handleUpload}
						disabled={uploading || !fileName.trim() || !fileContent.trim()}
						style={{
							padding: "10px 20px",
							background: "linear-gradient(135deg, var(--accent), #7c3aed)",
							border: "none",
							borderRadius: "8px",
							color: "white",
							cursor: "pointer",
							fontSize: "12px",
							fontWeight: 600,
							opacity: uploading ? 0.6 : 1,
							display: "flex",
							alignItems: "center",
							gap: "6px",
						}}
					>
						{uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
						{uploading ? "Subiendo..." : "Subir e Indexar"}
					</button>
					<div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "8px" }}>
						El archivo se dividir\u00e1 en chunks y se indexar\u00e1 vectorialmente en MCP Brain.
					</div>
				</div>
			)}

			{/* Content: File list + Search */}
			<div style={{ flex: 1, display: "flex", gap: "16px", overflow: "hidden" }}>
				{/* File List */}
				<div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
					{loading ? (
						<div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
							<Loader2
								size={24}
								className="animate-spin"
								style={{ margin: "0 auto 12px", display: "block" }}
							/>
						</div>
					) : files.length === 0 ? (
						<div
							style={{ textAlign: "center", padding: "40px", color: "var(--text-dim)", fontSize: "13px" }}
						>
							<BookOpen size={32} style={{ margin: "0 auto 12px", opacity: 0.3, display: "block" }} />
							No hay archivos de conocimiento. Sube archivos para que el agente tenga contexto.
						</div>
					) : (
						files.map((file) => (
							<div
								key={file.name}
								style={{
									padding: "12px 16px",
									marginBottom: "6px",
									borderRadius: "8px",
									background: "rgba(255,255,255,0.02)",
									border: "1px solid var(--border-light)",
									display: "flex",
									alignItems: "center",
									gap: "12px",
								}}
							>
								<FileText size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
								<div style={{ flex: 1, minWidth: 0 }}>
									<div
										style={{
											fontSize: "12px",
											fontWeight: 600,
											color: "var(--text-main)",
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
										}}
									>
										{file.name}
									</div>
									<div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "2px" }}>
										{formatSize(file.size)} \u00b7{" "}
										{file.modifiedAt ? new Date(file.modifiedAt).toLocaleDateString() : ""}
									</div>
								</div>
								<button
									type="button"
									onClick={() => setConfirmDeleteFile(file.name)}
									style={{
										background: "none",
										border: "none",
										color: "var(--error)",
										cursor: "pointer",
										opacity: 0.5,
										padding: "4px",
									}}
									title="Eliminar"
								>
									<Trash2 size={14} />
								</button>
							</div>
						))
					)}
				</div>

				{/* Search Panel */}
				<div style={{ width: "360px", flexShrink: 0, display: "flex", flexDirection: "column" }}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "8px",
							padding: "8px 12px",
							background: "rgba(255,255,255,0.03)",
							border: "1px solid var(--border-light)",
							borderRadius: "8px",
							marginBottom: "12px",
						}}
					>
						<Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Buscar en el conocimiento..."
							style={{
								flex: 1,
								background: "none",
								border: "none",
								color: "var(--text-main)",
								fontSize: "12px",
								fontFamily: "inherit",
								outline: "none",
							}}
						/>
						{searching && (
							<Loader2 size={12} className="animate-spin" style={{ color: "var(--text-muted)" }} />
						)}
					</div>

					<div style={{ flex: 1, overflowY: "auto" }}>
						{searchQuery.trim() && searchResults.length === 0 && !searching && (
							<div
								style={{
									textAlign: "center",
									padding: "24px",
									color: "var(--text-dim)",
									fontSize: "12px",
								}}
							>
								Sin resultados. Sube archivos primero.
							</div>
						)}
						{searchResults.map((result) => (
							<div
								key={result.id}
								style={{
									padding: "10px 12px",
									marginBottom: "6px",
									borderRadius: "6px",
									background: "rgba(255,255,255,0.02)",
									border: "1px solid var(--border-light)",
								}}
							>
								<div
									style={{
										fontSize: "11px",
										fontWeight: 600,
										color: "var(--text-main)",
										marginBottom: "4px",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{result.title}
								</div>
								<div
									style={{
										fontSize: "10px",
										color: "var(--text-dim)",
										maxHeight: "60px",
										overflow: "hidden",
									}}
								>
									{result.content}
								</div>
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

			<ConfirmModal
				open={!!confirmDeleteFile}
				title="Eliminar archivo"
				message={
					confirmDeleteFile
						? `\u00bfEst\u00e1s seguro de eliminar "${confirmDeleteFile}" del conocimiento?`
						: ""
				}
				confirmText="Eliminar"
				onConfirm={() => {
					if (confirmDeleteFile) {
						handleDelete(confirmDeleteFile);
						setConfirmDeleteFile(null);
					}
				}}
				onCancel={() => setConfirmDeleteFile(null)}
				danger
			/>
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
};
