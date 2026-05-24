import {
	Brain,
	Check,
	ClipboardCopy,
	Download,
	Eye,
	FileCode,
	FileText,
	FolderOpen,
	Loader2,
	RefreshCw,
	X,
} from "lucide-react";
import { ModalLayout } from "./ModalLayout";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { api, brainApi } from "../services/api.service";

/* ─────────────── Types ─────────────── */

interface LoadedModel {
	name: string;
	size_vram?: number;
	[key: string]: unknown;
}

interface FileNode {
	name: string;
	type: "file" | "directory";
	size?: number;
	children?: FileNode[];
}

interface GeneratedFile {
	path: string;
	content: string;
}

interface GenerateResult {
	projectName: string;
	analysis: string;
	agents: GeneratedFile[];
	rules: GeneratedFile[];
	workflows: GeneratedFile[];
}

type WizardPhase = "config" | "loading" | "results";

/* ─────────────── Helpers ─────────────── */

/**
 * Lee recursivamente un FileSystemDirectoryHandle y construye el árbol FileNode
 */
async function readDirectoryTree(
	dirHandle: FileSystemDirectoryHandle,
	depth = 0
): Promise<FileNode> {
	const MAX_DEPTH = 4;
	const EXCLUDE_DIRS = new Set([
		"node_modules",
		".git",
		"dist",
		"build",
		".next",
		"__pycache__",
		"venv",
		".venv",
		"env",
		".env",
		"coverage",
		".nyc_output",
		".cache",
	]);

	if (depth > MAX_DEPTH) {
		return { name: dirHandle.name, type: "directory", children: [] };
	}

	const children: FileNode[] = [];

	for await (const entry of (dirHandle as any).values()) {
		if (entry.name.startsWith(".") && entry.name !== ".env") continue;
		if (EXCLUDE_DIRS.has(entry.name)) continue;

		if (entry.kind === "file") {
			const fileHandle = await dirHandle.getFileHandle(entry.name);
			const file = await fileHandle.getFile();
			const node: FileNode = { name: entry.name, type: "file", size: file.size };
			children.push(node);
		} else if (entry.kind === "directory") {
			const subDirHandle = await dirHandle.getDirectoryHandle(entry.name);
			const subtree = await readDirectoryTree(subDirHandle, depth + 1);
			children.push(subtree);
		}
	}

	// Sort: directories first, then files, alphabetically
	children.sort((a, b) => {
		if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
		return a.name.localeCompare(b.name);
	});

	return { name: dirHandle.name, type: "directory", children };
}

/**
 * Lee archivos de configuración clave desde el directorio raíz
 */
async function readConfigFiles(
	dirHandle: FileSystemDirectoryHandle
): Promise<Record<string, string>> {
	const configFiles: Record<string, string> = {};
	const importantFiles = [
		"package.json",
		"tsconfig.json",
		"docker-compose.yml",
		"Dockerfile",
		"composer.json",
		"cargo.toml",
		"go.mod",
		"requirements.txt",
		"pyproject.toml",
		"Gemfile",
		".env.example",
		"webpack.config.js",
		"vite.config.ts",
		"next.config.js",
		"nuxt.config.ts",
	];

	for (const fileName of importantFiles) {
		try {
			const fileHandle = await dirHandle.getFileHandle(fileName);
			const file = await fileHandle.getFile();
			// Skip binary files (check size)
			if (file.size > 100_000) continue;
			const text = await file.text();
			if (text.length > 0 && text.length < 50_000) {
				configFiles[fileName] = text;
			}
		} catch {
			// File doesn't exist, skip
		}
	}

	// Also try to read package.json from subdirectories if not in root
	if (!configFiles["package.json"]) {
		for await (const entry of (dirHandle as any).values()) {
			if (entry.kind !== "directory") continue;
			if (entry.name.startsWith(".")) continue;
			if (["node_modules", ".git", "dist", "build"].includes(entry.name)) continue;
			try {
				const subDir = await dirHandle.getDirectoryHandle(entry.name);
				const pkgHandle = await subDir.getFileHandle("package.json");
				const pkgFile = await pkgHandle.getFile();
				if (pkgFile.size < 100_000) {
					const text = await pkgFile.text();
					configFiles[`${entry.name}/package.json`] = text;
				}
			} catch {
				// skip
			}
		}
	}

	return configFiles;
}

/* ─────────────── Component ─────────────── */

interface AIAgentWizardProps {
	project: string;
	onClose: () => void;
	onToast: (message: string, type: "success" | "error" | "info", detail?: string) => void;
}

export const AIAgentWizard: React.FC<AIAgentWizardProps> = ({ project, onClose, onToast }) => {
	const [phase, setPhase] = useState<WizardPhase>("config");

	// Form fields
	const [models, setModels] = useState<LoadedModel[]>([]);
	const [selectedModel, setSelectedModel] = useState("");
	const [projectName, setProjectName] = useState(project);
	const [selectedFolder, setSelectedFolder] = useState<string>("");
	const [fileTree, setFileTree] = useState<FileNode | null>(null);
	const [configContents, setConfigContents] = useState<Record<string, string>>({});

	// Loading / Results
	const [loadingMessage, setLoadingMessage] = useState("");
	const [result, setResult] = useState<GenerateResult | null>(null);
	const [previewFile, setPreviewFile] = useState<GeneratedFile | null>(null);
	const [copiedPath, setCopiedPath] = useState<string | null>(null);
	const [creatingProject, setCreatingProject] = useState(false);

	/* ── Fetch models ── */
	const fetchModels = useCallback(async () => {
		try {
			const res = await api.get("/api/models");
			const list: LoadedModel[] = res.data.models || [];
			setModels(list);
			if (list.length > 0 && !selectedModel) {
				// Prefer a good model for code generation
				const preferred = list.find(
					(m) =>
						m.name.includes("qwen") ||
						m.name.includes("coder") ||
						m.name.includes("deepseek") ||
						m.name.includes("llama3")
				);
				setSelectedModel(preferred?.name || list[0].name);
			}
		} catch {
			onToast("Error al cargar modelos", "error");
		}
	}, [onToast, selectedModel]);

	useEffect(() => {
		fetchModels();
	}, [fetchModels]);

	/* ── Folder picker ── */
	const handlePickFolder = async () => {
		try {
			// Try File System Access API first
			if ("showDirectoryPicker" in window) {
				const dirHandle = await (window as unknown as {
					showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
				}).showDirectoryPicker();
				setSelectedFolder(dirHandle.name);
				setLoadingMessage("Leyendo estructura del proyecto...");
				setPhase("loading");

				// Read tree + configs in parallel
				const [tree, configs] = await Promise.all([
					readDirectoryTree(dirHandle),
					readConfigFiles(dirHandle),
				]);

				setFileTree(tree);
				setConfigContents(configs);
				setPhase("config");
				setLoadingMessage("");
				onToast(`Proyecto "${dirHandle.name}" analizado (${countFiles(tree)} archivos)`, "success");
			} else {
				// Fallback: informar al usuario
				onToast(
					"Tu navegador no soporta el selector de carpetas. Usa Chrome o Edge.",
					"error"
				);
			}
		} catch (err) {
			// User cancelled or error
			setPhase("config");
			setLoadingMessage("");
			if (err instanceof Error && err.name !== "AbortError" && err.name !== "SecurityError") {
				onToast("Error al leer la carpeta", "error", err.message);
			}
		}
	};

	const countFiles = (node: FileNode): number => {
		let count = 0;
		if (node.type === "file") count++;
		if (node.children) {
			for (const child of node.children) {
				count += countFiles(child);
			}
		}
		return count;
	};

	/* ── Generate ── */
	const handleGenerate = async () => {
		if (!selectedModel) {
			onToast("Selecciona un modelo", "error");
			return;
		}
		if (!fileTree) {
			onToast("Selecciona una carpeta de proyecto", "error");
			return;
		}
		if (!projectName.trim()) {
			onToast("Ingresa un nombre de proyecto", "error");
			return;
		}

		setPhase("loading");
		setLoadingMessage("Enviando estructura a la IA...");

		try {
			const res = await api.post("/api/agents/analyze-project", {
				model: selectedModel,
				projectName: projectName.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
				structure: fileTree,
				configFiles: configContents,
			});

			const data = res.data as GenerateResult;
			setResult(data);
			setPhase("results");
			onToast(`¡${data.agents.length + data.rules.length + data.workflows.length} archivos generados!`, "success");
		} catch (err: unknown) {
			const message =
				err instanceof Error
					? err.message
					: (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
						"Error al generar agentes";
			onToast("Error en la generación", "error", message);
			setPhase("config");
			setLoadingMessage("");
		}
	};

	/* ── Save to brain ── */
	const handleEnsureProject = async () => {
		if (!result) return;
		setCreatingProject(true);
		try {
			const brainRes = await brainApi.post("/api/projects/ensure", {
				name: result.projectName,
			});
			const { created } = brainRes.data;
			onToast(
				created
					? `Proyecto "${result.projectName}" creado en el Brain`
					: `Proyecto "${result.projectName}" ya existía en el Brain`,
				"success",
				"Listo para mem_save"
			);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Error desconocido";
			onToast("Error al crear proyecto en Brain", "error", message);
		} finally {
			setCreatingProject(false);
		}
	};

	/* ── Save as template in brain ── */
	/* const handleSaveAsTemplate = async (file: GeneratedFile) => {
		try {
			// Determine tool and type based on path
			const tool = "opencode";
			let type = "agent";
			if (file.path.includes("/rules/")) type = "rule";
			if (file.path.includes("/workflows/")) type = "workflow";

			// Extract a name from the path
			const name = file.path.split("/").pop()?.replace(".md", "") || "generated";

			await brainApi.post("/api/templates", {
				tool,
				type,
				name,
				description: `Generado por AI Agent Wizard para ${result?.projectName || projectName}`,
				content: file.content,
				output_path: file.path,
			});
			onToast(`"${name}" guardado como template`, "success");
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Error desconocido";
			onToast("Error al guardar template", "error", message);
		}
	};

	/* ── Save all as templates ── */
	const handleSaveAllTemplates = async () => {
		if (!result) return;
		onToast("Guardando todos los archivos como templates...", "info");
		const allFiles = [...result.agents, ...result.rules, ...result.workflows];
		let successCount = 0;
		for (const file of allFiles) {
			try {
				const tool = "opencode";
				let type = "agent";
				if (file.path.includes("/rules/")) type = "rule";
				if (file.path.includes("/workflows/")) type = "workflow";
				const name = file.path.split("/").pop()?.replace(".md", "") || "generated";

				await brainApi.post("/api/templates", {
					tool,
					type,
					name,
					description: `Generado por AI Agent Wizard para ${result.projectName}`,
					content: file.content,
					output_path: file.path,
				});
				successCount++;
			} catch {
				// skip individual failures
			}
		}
		onToast(`${successCount}/${allFiles.length} templates guardados`, successCount === allFiles.length ? "success" : "info");
	};

	/* ── Download individual file ── */
	const handleDownload = (file: GeneratedFile) => {
		const filename = file.path.split("/").pop() || "agent.md";
		const blob = new Blob([file.content], { type: "text/markdown" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	};

	/* ── Copy content ── */
	const handleCopy = (file: GeneratedFile) => {
		navigator.clipboard.writeText(file.content);
		setCopiedPath(file.path);
		setTimeout(() => setCopiedPath(null), 2000);
	};

	/* ── Download all as ZIP-like batch ── */
	const handleDownloadAll = () => {
		if (!result) return;
		const allFiles = [...result.agents, ...result.rules, ...result.workflows];
		// Generate a single markdown file with all contents separated by headers
		let combined = `# Archivos generados para ${result.projectName}\n\n`;
		combined += `> ${result.analysis}\n\n---\n\n`;
		for (const file of allFiles) {
			combined += `## ${file.path}\n\n\`\`\`markdown\n${file.content}\n\`\`\`\n\n---\n\n`;
		}
		const blob = new Blob([combined], { type: "text/markdown" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${result.projectName}-agentes.md`;
		a.click();
		URL.revokeObjectURL(url);
	};

	/* ── Styles ── */
	const inputStyle: React.CSSProperties = {
		width: "100%",
		padding: "8px 10px",
		background: "rgba(0,0,0,0.3)",
		border: "1px solid var(--border)",
		borderRadius: "6px",
		color: "white",
		fontSize: "13px",
		boxSizing: "border-box",
	};

	const fileCardStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: "10px",
		padding: "10px 12px",
		borderRadius: "8px",
		background: "rgba(0,0,0,0.2)",
		border: "1px solid var(--border)",
		transition: "all 0.15s",
	};

	/* ── Render loading ── */
	if (phase === "loading") {
		return (
						<ModalLayout onClose={onClose}>
				<div style={{
					padding: "48px", textAlign: "center",
					display: "flex", flexDirection: "column", alignItems: "center", gap: "20px",
					minWidth: "360px",
				}}>

					<Loader2 size={40} className="animate-spin" style={{ color: "var(--accent)" }} />
					<div style={{ fontSize: "14px", fontWeight: 600 }}>Generando Agentes</div>
					<p style={{ fontSize: "12px", color: "var(--text-dim)" }}>{loadingMessage}</p>
					<p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
						Esto puede tomar unos segundos dependiendo del modelo...
					</p>
				
				</div>
<style>{`
					@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
					.animate-spin { animation: spin 1s linear infinite; }
				`}</style>
			</ModalLayout>
		);
	}

	/* ── Render results ── */
	if (phase === "results" && result) {
		const allFiles = [...result.agents, ...result.rules, ...result.workflows];

		return (
						<ModalLayout onClose={onClose} width="780px">

					{/* Header */}
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
						<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
							<Brain size={22} style={{ color: "var(--accent)" }} />
							<div>
								<h3 style={{ fontSize: "16px", fontWeight: 700 }}>Agentes Generados</h3>
								<p style={{ fontSize: "11px", color: "var(--text-dim)" }}>
									Para {result.projectName}
								</p>
							</div>
						</div>
						<button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
							<X size={18} />
						</button>
					</div>

					{/* Analysis */}
					<div style={{
						padding: "14px 16px",
						background: "rgba(79,140,255,0.06)",
						border: "1px solid rgba(79,140,255,0.15)",
						borderRadius: "8px",
						fontSize: "12px",
						color: "var(--text-dim)",
						lineHeight: 1.6,
					}}>
						<div style={{ fontSize: "10px", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: "6px" }}>
							📊 Análisis del Proyecto
						</div>
						{result.analysis}
					</div>

					{/* Files count badge */}
					<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
						<span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: "rgba(34,197,94,0.1)", color: "rgba(74,222,128,0.9)", fontWeight: 600 }}>
							{result.agents.length} agentes
						</span>
						<span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: "rgba(139,92,246,0.1)", color: "rgba(167,139,250,0.9)", fontWeight: 600 }}>
							{result.rules.length} rules
						</span>
						<span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: "rgba(251,191,36,0.1)", color: "rgba(252,211,77,0.9)", fontWeight: 600 }}>
							{result.workflows.length} workflows
						</span>
						<span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: "rgba(79,140,255,0.1)", color: "var(--accent)", fontWeight: 600 }}>
							🔌 Brain MCP incluido
						</span>
					</div>

					{/* Files list */}
					<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
						{allFiles.map((file, idx) => (
							<div key={idx} style={fileCardStyle}>
								<FileCode size={16} style={{ color: "var(--accent)", flexShrink: 0, opacity: 0.7 }} />
								<div style={{ flex: 1, minWidth: 0 }}>
									<div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>
										{file.path}
									</div>
								</div>
								<div style={{ display: "flex", gap: "4px" }}>
									<button
										type="button"
										onClick={() => setPreviewFile(previewFile?.path === file.path ? null : file)}
										title="Previsualizar"
										style={{
											padding: "5px 8px", borderRadius: "5px",
											background: previewFile?.path === file.path ? "rgba(79,140,255,0.2)" : "rgba(255,255,255,0.05)",
											border: previewFile?.path === file.path ? "1px solid rgba(79,140,255,0.3)" : "1px solid transparent",
											color: previewFile?.path === file.path ? "var(--accent)" : "var(--text-dim)",
											cursor: "pointer", display: "flex", fontSize: "11px",
										}}
									>
										<Eye size={13} />
									</button>
									<button
										type="button"
										onClick={() => handleCopy(file)}
										title="Copiar"
										style={{
											padding: "5px 8px", borderRadius: "5px",
											background: "rgba(255,255,255,0.05)", border: "1px solid transparent",
											color: copiedPath === file.path ? "rgba(74,222,128,0.9)" : "var(--text-dim)",
											cursor: "pointer", display: "flex", fontSize: "11px",
										}}
									>
										{copiedPath === file.path ? <Check size={13} /> : <ClipboardCopy size={13} />}
									</button>
									<button
										type="button"
										onClick={() => handleDownload(file)}
										title="Descargar"
										style={{
											padding: "5px 8px", borderRadius: "5px",
											background: "rgba(255,255,255,0.05)", border: "1px solid transparent",
											color: "var(--text-dim)", cursor: "pointer", display: "flex", fontSize: "11px",
										}}
									>
										<Download size={13} />
									</button>
								</div>
							</div>
						))}
					</div>

					{/* Preview panel */}
					{previewFile && (
						<div style={{
							border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden",
						}}>
							<div style={{
								display: "flex", justifyContent: "space-between", alignItems: "center",
								padding: "10px 14px", background: "rgba(0,0,0,0.3)",
								borderBottom: "1px solid var(--border)",
							}}>
								<span style={{ fontSize: "11px", fontWeight: 600, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
									{previewFile.path}
								</span>
								<button
									type="button"
									onClick={() => setPreviewFile(null)}
									style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}
								>
									<X size={14} />
								</button>
							</div>
							<pre style={{
								margin: 0, padding: "16px", fontSize: "11px", lineHeight: 1.7,
								color: "var(--text-dim)", fontFamily: "var(--font-mono)",
								overflowX: "auto", maxHeight: "350px", overflowY: "auto",
								whiteSpace: "pre-wrap", wordBreak: "break-word", background: "rgba(0,0,0,0.4)",
							}}>
								{previewFile.content}
							</pre>
						</div>
					)}

					{/* Action buttons */}
					<div style={{ display: "flex", gap: "10px", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
						<button
							type="button"
							onClick={handleDownloadAll}
							style={{
								display: "flex", alignItems: "center", gap: "6px",
								padding: "9px 16px", borderRadius: "8px",
								background: "var(--accent)", border: "none",
								color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 600,
							}}
						>
							<Download size={14} /> Descargar Todo
						</button>
						<button
							type="button"
							onClick={handleSaveAllTemplates}
							style={{
								display: "flex", alignItems: "center", gap: "6px",
								padding: "9px 16px", borderRadius: "8px",
								background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)",
								color: "rgba(167,139,250,0.9)", cursor: "pointer", fontSize: "12px", fontWeight: 600,
							}}
						>
							<FileText size={14} /> Guardar como Templates
						</button>
						<button
							type="button"
							onClick={handleEnsureProject}
							disabled={creatingProject}
							style={{
								display: "flex", alignItems: "center", gap: "6px",
								padding: "9px 16px", borderRadius: "8px",
								background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)",
								color: "rgba(74,222,128,0.9)", cursor: creatingProject ? "not-allowed" : "pointer",
								fontSize: "12px", fontWeight: 600,
							}}
						>
							{creatingProject ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
							{creatingProject ? "Creando..." : "✨ Crear Proyecto en Brain"}
						</button>
						<button
							type="button"
							onClick={() => { setPhase("config"); setResult(null); setPreviewFile(null); }}
							style={{
								display: "flex", alignItems: "center", gap: "6px",
								padding: "9px 16px", borderRadius: "8px",
								background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)",
								color: "var(--text-dim)", cursor: "pointer", fontSize: "12px",
							}}
						>
							<RefreshCw size={14} /> Nuevo Análisis
						</button>
					</div>
				
			</ModalLayout>
		);
	}

	/* ── Render config phase ── */
	return (
					<ModalLayout onClose={onClose} width="580px">

				{/* Header */}
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
					<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
						<Brain size={22} style={{ color: "var(--accent)" }} />
						<div>
							<h3 style={{ fontSize: "16px", fontWeight: 700 }}>AI Agent Wizard</h3>
							<p style={{ fontSize: "11px", color: "var(--text-dim)" }}>
								Genera agentes OpenCode analizando tu proyecto con IA
							</p>
						</div>
					</div>
					<button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
						<X size={18} />
					</button>
				</div>

				{/* Step 1: Select Model */}
				<div className="card-glass" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
					<div style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
						<span style={{ width: "18px", height: "18px", borderRadius: "50%", background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700 }}>1</span>
						Seleccionar Modelo IA
					</div>
					<div style={{ display: "flex", gap: "8px" }}>
						<select
							value={selectedModel}
							onChange={(e) => setSelectedModel(e.target.value)}
							style={{ ...inputStyle, flex: 1, cursor: "pointer" }}
						>
							{models.length === 0 && <option value="">Sin modelos disponibles</option>}
							{models.map((m) => (
								<option key={m.name} value={m.name}>{m.name}</option>
							))}
						</select>
						<button
							type="button"
							onClick={fetchModels}
							title="Recargar modelos"
							style={{
								padding: "8px 10px", borderRadius: "6px",
								background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)",
								color: "var(--text-dim)", cursor: "pointer", display: "flex",
							}}
						>
							<RefreshCw size={14} />
						</button>
					</div>
				</div>

				{/* Step 2: Project */}
				<div className="card-glass" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
					<div style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
						<span style={{ width: "18px", height: "18px", borderRadius: "50%", background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700 }}>2</span>
						Nombre del Proyecto (Brain)
					</div>
					<input
						value={projectName}
						onChange={(e) => setProjectName(e.target.value)}
						placeholder="ej: mi-proyecto"
						style={inputStyle}
					/>
				</div>

				{/* Step 3: Folder */}
				<div className="card-glass" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
					<div style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
						<span style={{ width: "18px", height: "18px", borderRadius: "50%", background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700 }}>3</span>
						Carpeta del Proyecto
					</div>
					{!fileTree ? (
						<button
							type="button"
							onClick={handlePickFolder}
							style={{
								display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
								padding: "24px", borderRadius: "8px",
								background: "rgba(79,140,255,0.06)", border: "2px dashed rgba(79,140,255,0.25)",
								color: "var(--accent)", cursor: "pointer", fontSize: "13px", fontWeight: 600,
								transition: "all 0.2s",
							}}
							onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(79,140,255,0.12)"; e.currentTarget.style.borderColor = "rgba(79,140,255,0.4)"; }}
							onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(79,140,255,0.06)"; e.currentTarget.style.borderColor = "rgba(79,140,255,0.25)"; }}
						>
							<FolderOpen size={24} />
							Seleccionar Carpeta del Proyecto
						</button>
					) : (
						<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
							<div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
								<FolderOpen size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
								<div style={{ minWidth: 0 }}>
									<div style={{ fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
										{selectedFolder}
									</div>
									<div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
										{countFiles(fileTree)} archivos analizados
									</div>
								</div>
							</div>
							<button
								type="button"
								onClick={() => { setFileTree(null); setSelectedFolder(""); setConfigContents({}); }}
								style={{
									padding: "5px 10px", borderRadius: "6px",
									background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
									color: "rgba(239,68,68,0.8)", cursor: "pointer", fontSize: "11px", flexShrink: 0,
								}}
							>
								Cambiar
							</button>
						</div>
					)}
				</div>

				{/* Config files preview */}
				{Object.keys(configContents).length > 0 && (
					<div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", gap: "6px", flexWrap: "wrap" }}>
						<span>📄 Archivos de configuración leídos:</span>
						{Object.keys(configContents).map((f) => (
							<span key={f} style={{ fontFamily: "var(--font-mono)", fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: "rgba(255,255,255,0.05)" }}>
								{f}
							</span>
						))}
					</div>
				)}

				{/* Generate button */}
				<button
					type="button"
					onClick={handleGenerate}
					disabled={!selectedModel || !fileTree || !projectName.trim()}
					style={{
						width: "100%", padding: "12px", borderRadius: "8px",
						background: (!selectedModel || !fileTree || !projectName.trim()) ? "rgba(79,140,255,0.1)" : "var(--accent)",
						border: "none", color: "white", cursor: (!selectedModel || !fileTree || !projectName.trim()) ? "not-allowed" : "pointer",
						fontSize: "14px", fontWeight: 700,
						display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
					}}
				>
					<Brain size={18} />
					🧠 Generar Agentes con IA
				</button>

				{/* Footer note */}
				<div style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
					Los agentes generados incluirán conexión al Brain MCP en <code>http://localhost:3015/sse</code>
				</div>
			
			</ModalLayout>
	);
};
