import { Check, ChevronRight, ClipboardCopy, Download, Layers, Plus, Trash2, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { brainApi } from "../services/api.service";

interface TemplateVariable {
	name: string;
	description: string;
	required: boolean;
	default?: string;
}

interface Template {
	id: string;
	tool: string;
	type: string;
	name: string;
	description: string | null;
	content: string;
	variables: TemplateVariable[];
	output_path: string | null;
	is_seed: boolean;
	created_at: number;
	updated_at: number;
}

interface RenderResult {
	content: string;
	output_path: string;
	missing: string[];
	template_id: string;
}

const TOOL_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
	antigravity: { bg: "rgba(139, 92, 246, 0.12)", text: "rgba(167, 139, 250, 0.9)", dot: "#a78bfa" },
	opencode:    { bg: "rgba(34, 197, 94, 0.12)",  text: "rgba(74, 222, 128, 0.9)",  dot: "#4ade80" },
	universal:   { bg: "rgba(251, 191, 36, 0.12)", text: "rgba(252, 211, 77, 0.9)",  dot: "#fcd34d" },
};

const TYPE_LABELS: Record<string, string> = {
	rule:     "Rule",
	workflow: "Workflow",
	agent:    "Agent",
};

interface NewTemplateModalProps {
	onClose: () => void;
	onSaved: (tpl: Template) => void;
}

const NewTemplateModal: React.FC<NewTemplateModalProps> = ({ onClose, onSaved }) => {
	const [form, setForm] = useState({
		tool: "antigravity",
		type: "rule",
		name: "",
		description: "",
		output_path: "",
		content: "---\n\n---\n\n# Mi Template\n\n{{variable}}\n",
	});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSave = async () => {
		if (!form.name.trim() || !form.content.trim()) {
			setError("Nombre y contenido son obligatorios.");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const res = await brainApi.post("/api/templates", form);
			onSaved(res.data);
			onClose();
		} catch (e: unknown) {
			setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Error al guardar");
		} finally {
			setSaving(false);
		}
	};

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

	return (
		<div style={{
			position: "fixed", inset: 0, zIndex: 9998,
			background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
			display: "flex", alignItems: "center", justifyContent: "center",
		}}>
			<div className="card-glass" style={{ width: "600px", maxHeight: "90vh", overflowY: "auto", padding: "28px", display: "flex", flexDirection: "column", gap: "16px" }}>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
					<h3 style={{ fontSize: "16px", fontWeight: 700 }}>Nuevo Template</h3>
					<button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
						<X size={18} />
					</button>
				</div>

				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
					<div>
						<label style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "6px" }}>Tool *</label>
						<select value={form.tool} onChange={(e) => setForm((p) => ({ ...p, tool: e.target.value }))} style={inputStyle}>
							<option value="antigravity">Antigravity</option>
							<option value="opencode">OpenCode</option>
							<option value="universal">Universal</option>
						</select>
					</div>
					<div>
						<label style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "6px" }}>Type *</label>
						<select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} style={inputStyle}>
							<option value="rule">Rule</option>
							<option value="workflow">Workflow</option>
							<option value="agent">Agent</option>
						</select>
					</div>
				</div>

				<div>
					<label style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "6px" }}>Nombre *</label>
					<input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="ej: My Custom Rule" style={inputStyle} />
				</div>
				<div>
					<label style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "6px" }}>Descripción</label>
					<input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Para qué sirve este template" style={inputStyle} />
				</div>
				<div>
					<label style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "6px" }}>Output Path</label>
					<input value={form.output_path} onChange={(e) => setForm((p) => ({ ...p, output_path: e.target.value }))} placeholder=".agents/rules/{{project}}.md" style={inputStyle} />
				</div>
				<div>
					<label style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "6px" }}>
						Contenido * <span style={{ color: "var(--text-dim)", fontSize: "10px" }}>(usa {'{{variable}}'} para interpolación)</span>
					</label>
					<textarea
						value={form.content}
						onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
						rows={10}
						style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: "12px", resize: "vertical", lineHeight: 1.6 }}
					/>
				</div>

				{error && <div style={{ fontSize: "12px", color: "rgba(239,68,68,0.9)", background: "rgba(239,68,68,0.08)", padding: "8px 12px", borderRadius: "6px" }}>{error}</div>}

				<div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
					<button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: "6px", background: "transparent", border: "1px solid var(--border)", color: "var(--text-dim)", cursor: "pointer", fontSize: "13px" }}>
						Cancelar
					</button>
					<button type="button" onClick={handleSave} disabled={saving} style={{ padding: "8px 16px", borderRadius: "6px", background: "var(--accent)", border: "none", color: "white", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>
						{saving ? "Guardando..." : "Guardar Template"}
					</button>
				</div>
			</div>
		</div>
	);
};

export const BrainScaffold: React.FC = () => {
	const [templatesList, setTemplatesList] = useState<Template[]>([]);
	const [filterTool, setFilterTool] = useState<string>("all");
	const [filterType, setFilterType] = useState<string>("all");
	const [selected, setSelected] = useState<Template | null>(null);
	const [varValues, setVarValues] = useState<Record<string, string>>({});
	const [preview, setPreview] = useState<RenderResult | null>(null);
	const [loadingPreview, setLoadingPreview] = useState(false);
	const [copied, setCopied] = useState(false);
	const [showNewModal, setShowNewModal] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const previewRef = useRef<HTMLPreElement>(null);

	const fetchTemplates = useCallback(async () => {
		try {
			const res = await brainApi.get("/api/templates");
			setTemplatesList(res.data);
		} catch (e) {
			console.error("Error fetching templates", e);
		}
	}, []);

	useEffect(() => {
		fetchTemplates();
	}, [fetchTemplates]);

	const filtered = useMemo(() => {
		return templatesList.filter((t) => {
			if (filterTool !== "all" && t.tool !== filterTool) return false;
			if (filterType !== "all" && t.type !== filterType) return false;
			return true;
		});
	}, [templatesList, filterTool, filterType]);

	const selectTemplate = (tpl: Template) => {
		setSelected(tpl);
		setPreview(null);
		// Pre-fill defaults
		const defaults: Record<string, string> = {};
		for (const v of tpl.variables) {
			defaults[v.name] = v.default ?? "";
		}
		setVarValues(defaults);
	};

	const handlePreview = async () => {
		if (!selected) return;
		setLoadingPreview(true);
		try {
			const res = await brainApi.post(`/api/templates/${selected.id}/render`, { variables: varValues });
			setPreview(res.data);
		} catch (e) {
			console.error("Preview error", e);
		} finally {
			setLoadingPreview(false);
		}
	};

	const handleCopy = () => {
		if (!preview) return;
		navigator.clipboard.writeText(preview.content);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleDownload = () => {
		if (!preview) return;
		const filename = preview.output_path.split("/").pop() ?? "template.md";
		const blob = new Blob([preview.content], { type: "text/markdown" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	};

	const handleDelete = async () => {
		if (!selected || selected.is_seed) return;
		const ok = window.confirm(`¿Eliminar el template "${selected.name}"? Esta acción es irreversible.`);
		if (!ok) return;
		setDeleting(true);
		try {
			await brainApi.delete(`/api/templates/${selected.id}`);
			setTemplatesList((prev) => prev.filter((t) => t.id !== selected.id));
			setSelected(null);
			setPreview(null);
		} finally {
			setDeleting(false);
		}
	};

	const toolColor = selected ? (TOOL_COLORS[selected.tool] ?? TOOL_COLORS.universal) : null;

	const labelStyle: React.CSSProperties = {
		fontSize: "11px",
		color: "var(--text-muted)",
		textTransform: "uppercase",
		letterSpacing: "1px",
		marginBottom: "6px",
		display: "block",
	};

	const inputStyle: React.CSSProperties = {
		width: "100%",
		padding: "7px 10px",
		background: "rgba(0,0,0,0.25)",
		border: "1px solid var(--border)",
		borderRadius: "6px",
		color: "white",
		fontSize: "12px",
		boxSizing: "border-box",
		fontFamily: "var(--font-mono)",
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
			{showNewModal && (
				<NewTemplateModal
					onClose={() => setShowNewModal(false)}
					onSaved={(tpl) => {
						setTemplatesList((prev) => [...prev, tpl]);
						selectTemplate(tpl);
					}}
				/>
			)}

			{/* Header */}
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<div>
					<h2 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "4px" }}>
						Scaffold de Agentes
					</h2>
					<p style={{ fontSize: "12px", color: "var(--text-dim)" }}>
						Genera archivos de agentes, rules y workflows desde templates.
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowNewModal(true)}
					style={{
						display: "flex", alignItems: "center", gap: "6px",
						padding: "8px 14px", borderRadius: "8px",
						background: "rgba(79,140,255,0.15)", border: "1px solid rgba(79,140,255,0.3)",
						color: "var(--accent)", cursor: "pointer", fontSize: "12px", fontWeight: 600,
					}}
				>
					<Plus size={14} /> Nuevo Template
				</button>
			</div>

			<div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px", alignItems: "start" }}>
				{/* Sidebar: filtros + lista */}
				<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
					{/* Filtros */}
					<div className="card-glass" style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
						<div>
							<label style={labelStyle}>Tool</label>
							<select value={filterTool} onChange={(e) => setFilterTool(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
								<option value="all">Todos</option>
								<option value="antigravity">Antigravity</option>
								<option value="opencode">OpenCode</option>
								<option value="universal">Universal</option>
							</select>
						</div>
						<div>
							<label style={labelStyle}>Type</label>
							<select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
								<option value="all">Todos</option>
								<option value="rule">Rule</option>
								<option value="workflow">Workflow</option>
								<option value="agent">Agent</option>
							</select>
						</div>
					</div>

					{/* Lista de templates */}
					<div className="card-glass" style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
						{filtered.length === 0 ? (
							<p style={{ fontSize: "12px", color: "var(--text-dim)", textAlign: "center", padding: "16px 0" }}>
								Sin templates para este filtro
							</p>
						) : (
							filtered.map((tpl) => {
								const tc = TOOL_COLORS[tpl.tool] ?? TOOL_COLORS.universal;
								const isActive = selected?.id === tpl.id;
								return (
									<button
										key={tpl.id}
										type="button"
										onClick={() => selectTemplate(tpl)}
										style={{
											display: "flex", alignItems: "center", gap: "10px",
											padding: "10px 12px", borderRadius: "8px",
											background: isActive ? "rgba(79,140,255,0.12)" : "transparent",
											border: isActive ? "1px solid rgba(79,140,255,0.25)" : "1px solid transparent",
											cursor: "pointer", textAlign: "left", width: "100%",
											transition: "all 0.15s",
										}}
									>
										<div style={{ width: "8px", height: "8px", borderRadius: "50%", background: tc.dot, flexShrink: 0 }} />
										<div style={{ flex: 1, minWidth: 0 }}>
											<div style={{ fontSize: "12px", fontWeight: 600, color: isActive ? "var(--accent)" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
												{tpl.name}
											</div>
											<div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "2px" }}>
												{TYPE_LABELS[tpl.type] ?? tpl.type}
											</div>
										</div>
										{isActive && <ChevronRight size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />}
									</button>
								);
							})
						)}
					</div>
				</div>

				{/* Panel principal */}
				{!selected ? (
					<div className="card-glass" style={{ padding: "48px", textAlign: "center", color: "var(--text-dim)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
						<Layers size={36} style={{ opacity: 0.3 }} />
						<p style={{ fontSize: "13px" }}>Selecciona un template para comenzar</p>
					</div>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
						{/* Template info */}
						<div className="card-glass" style={{ padding: "18px" }}>
							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
								<div>
									<div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
										<h3 style={{ fontSize: "15px", fontWeight: 700 }}>{selected.name}</h3>
										<span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: toolColor?.bg, color: toolColor?.text, fontWeight: 600 }}>
											{selected.tool}
										</span>
										<span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: "rgba(255,255,255,0.05)", color: "var(--text-dim)", fontWeight: 600 }}>
											{TYPE_LABELS[selected.type] ?? selected.type}
										</span>
										{selected.is_seed && (
											<span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: "rgba(251,191,36,0.08)", color: "rgba(251,191,36,0.7)", fontWeight: 600 }}>
												sistema
											</span>
										)}
									</div>
									{selected.description && (
										<p style={{ fontSize: "12px", color: "var(--text-dim)", lineHeight: 1.5 }}>{selected.description}</p>
									)}
									{selected.output_path && (
										<div style={{ marginTop: "6px", fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
											→ {selected.output_path}
										</div>
									)}
								</div>
								{!selected.is_seed && (
									<button
										type="button"
										onClick={handleDelete}
										disabled={deleting}
										style={{
											display: "flex", alignItems: "center", gap: "4px",
											padding: "5px 10px", borderRadius: "6px",
											background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
											color: "rgba(239,68,68,0.8)", cursor: "pointer", fontSize: "11px",
										}}
									>
										<Trash2 size={11} /> {deleting ? "..." : "Eliminar"}
									</button>
								)}
							</div>

							{/* Variables form */}
							{selected.variables.length > 0 && (
								<div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
									<div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>
										Variables
									</div>
									<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
										{selected.variables.map((v) => (
											<div key={v.name}>
												<label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: "4px" }}>
													{v.name}
													{v.required && <span style={{ color: "rgba(239,68,68,0.7)" }}>*</span>}
												</label>
												<input
													value={varValues[v.name] ?? ""}
													onChange={(e) => setVarValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
													placeholder={v.description}
													style={inputStyle}
												/>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Actions */}
							<div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
								<button
									type="button"
									onClick={handlePreview}
									disabled={loadingPreview}
									style={{
										flex: 1, padding: "9px", borderRadius: "8px",
										background: "var(--accent)", border: "none",
										color: "white", cursor: "pointer", fontSize: "13px", fontWeight: 600,
									}}
								>
									{loadingPreview ? "Generando..." : "Previsualizar"}
								</button>
								{preview && (
									<>
										<button
											type="button"
											onClick={handleCopy}
											style={{
												display: "flex", alignItems: "center", gap: "6px",
												padding: "9px 14px", borderRadius: "8px",
												background: copied ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
												border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
												color: copied ? "rgba(74,222,128,0.9)" : "var(--text-dim)",
												cursor: "pointer", fontSize: "13px",
											}}
										>
											{copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
											{copied ? "Copiado" : "Copiar"}
										</button>
										<button
											type="button"
											onClick={handleDownload}
											style={{
												display: "flex", alignItems: "center", gap: "6px",
												padding: "9px 14px", borderRadius: "8px",
												background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)",
												color: "var(--text-dim)", cursor: "pointer", fontSize: "13px",
											}}
										>
											<Download size={14} /> Descargar
										</button>
									</>
								)}
							</div>
						</div>

						{/* Preview */}
						{preview && (
							<div className="card-glass" style={{ padding: "18px" }}>
								<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
									<span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>
										Preview
									</span>
									{preview.output_path && (
										<span style={{ fontSize: "11px", color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
											{preview.output_path}
										</span>
									)}
								</div>
								{preview.missing.length > 0 && (
									<div style={{ marginBottom: "12px", padding: "8px 12px", borderRadius: "6px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "11px", color: "rgba(239,68,68,0.9)" }}>
										⚠ Variables requeridas sin completar: {preview.missing.join(", ")}
									</div>
								)}
								<pre
									ref={previewRef}
									style={{
										background: "rgba(0,0,0,0.4)",
										border: "1px solid var(--border)",
										borderRadius: "8px",
										padding: "16px",
										fontSize: "12px",
										lineHeight: 1.7,
										color: "var(--text-dim)",
										fontFamily: "var(--font-mono)",
										overflowX: "auto",
										maxHeight: "400px",
										overflowY: "auto",
										whiteSpace: "pre-wrap",
										wordBreak: "break-word",
										margin: 0,
									}}
								>
									{preview.content}
								</pre>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};
