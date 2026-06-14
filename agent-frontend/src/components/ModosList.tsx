import { Edit3, FileText, Plus, Save, Trash2, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useWs } from "../contexts/WebSocketContext";
import { config } from "../config";

interface AgentMode {
	name: string;
	label: string;
	system_prompt: string;
	tools: string[];
	model: string;
	temperature: number;
	history_limit: number;
	tool_policy: "auto" | "restricted" | "ask_user";
	extends: string | null;
	usage_count: number;
	last_used: string | null;
	created_at?: string;
}

interface ToolInfo {
	spec: {
		function: {
			name: string;
			description: string;
			parameters: Record<string, unknown>;
		};
	};
	enabled: boolean;
}

interface ModosListProps {
	modes: AgentMode[];
	activeModeName: string | null;
	tools: ToolInfo[];
	ollamaModels: string[];
}

export const ModosList: React.FC<ModosListProps> = ({ modes, activeModeName, tools, ollamaModels }) => {
	const { connected, send: sendWs } = useWs();
	const [editingMode, setEditingMode] = useState<string | null>(null);
	const [editForm, setEditForm] = useState<AgentMode | null>(null);
	const [showNewForm, setShowNewForm] = useState(false);
	const [newMode, setNewMode] = useState<AgentMode>({
		name: "",
		label: "",
		system_prompt: "",
		tools: [],
		model: "",
		temperature: 0.7,
		history_limit: 10,
		tool_policy: "auto",
		extends: null,
		usage_count: 0,
		last_used: null,
	});

	const availableToolNames = tools.map((t) => t.spec.function.name);

	const handleSaveMode = (mode: AgentMode) => {
		if (!connected) return;
		sendWs("mode_update", { action: "upsert", mode });
		setEditingMode(null);
		setEditForm(null);
	};

	const handleDeleteMode = (name: string) => {
		if (!connected) return;
		sendWs("mode_update", { action: "delete", name });
	};

	const handleCreateMode = () => {
		if (!newMode.name.trim() || !newMode.label.trim()) return;
		sendWs("mode_update", {
			action: "upsert",
			mode: { ...newMode, name: newMode.name.trim(), label: newMode.label.trim() },
		});
		setNewMode({
			name: "",
			label: "",
			system_prompt: "",
			tools: [],
			model: "",
			temperature: 0.7,
			history_limit: 10,
			tool_policy: "auto",
			extends: null,
			usage_count: 0,
			last_used: null,
		});
		setShowNewForm(false);
	};

	const startEdit = (mode: AgentMode) => {
		setEditingMode(mode.name);
		setEditForm({ ...mode });
	};

	const cancelEdit = () => {
		setEditingMode(null);
		setEditForm(null);
	};

	const toggleToolInForm = (toolName: string) => {
		if (!editForm) return;
		const current = editForm.tools || [];
		const updated = current.includes(toolName) ? current.filter((t) => t !== toolName) : [...current, toolName];
		setEditForm({ ...editForm, tools: updated });
	};

	const toggleToolInNewForm = (toolName: string) => {
		const current = newMode.tools || [];
		const updated = current.includes(toolName) ? current.filter((t) => t !== toolName) : [...current, toolName];
		setNewMode({ ...newMode, tools: updated });
	};

	const sectionTitle: React.CSSProperties = {
		fontSize: "12px",
		fontWeight: 600,
		color: "var(--text-muted)",
		display: "block",
		marginBottom: "12px",
		textTransform: "uppercase",
		letterSpacing: "1px",
	};

	const inputStyleLocal: React.CSSProperties = {
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

	const actionBtnStyle: React.CSSProperties = {
		padding: "10px 16px",
		background: "rgba(79,140,255,0.1)",
		border: "1px solid rgba(79,140,255,0.2)",
		borderRadius: "8px",
		color: "var(--accent)",
		cursor: "pointer",
		fontSize: "11px",
		fontWeight: 600,
		display: "flex",
		alignItems: "center",
	};

	const smallBtnStyle: React.CSSProperties = {
		background: "none",
		border: "none",
		color: "var(--text-muted)",
		cursor: "pointer",
		padding: "4px",
		display: "flex",
	};

	const dangerBtnStyle: React.CSSProperties = {
		background: "none",
		border: "none",
		color: "var(--error)",
		cursor: "pointer",
		padding: "4px",
		display: "flex",
	};

	const formatDate = (dateStr: string | null): string => {
		if (!dateStr) return "Nunca";
		try {
			return new Date(dateStr).toLocaleDateString("es-ES", {
				year: "numeric",
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			});
		} catch {
			return dateStr;
		}
	};

	// ─── Template definitions ───────────────────────────────────────────
	// ─── Templates fetched from backend (single source of truth) ───────
	const [templates, setTemplates] = useState<
		Array<{
			id: string;
			name: string;
			desc: string;
			mode: Partial<AgentMode>;
		}>
	>([]);

	useEffect(() => {
		(async () => {
			try {
				const resp = await fetch(`${config.engineUrl}/api/prompts/templates`, {
					headers: config.apiKey ? { "X-API-Key": config.apiKey } : undefined,
				});
				const data = await resp.json();
				const items = (data.templates || []).map(
					(t: {
						name: string;
						label?: string;
						sections?: Record<string, string>;
						tools?: string[];
						temperature?: number;
						history_limit?: number;
						tool_policy?: string;
					}) => {
						const sectionPreview = t.sections?.identity || "";
						const toolsStr = (t.tools || []).join(", ");
						return {
							id: t.name,
							name: t.label || t.name,
							desc: `${sectionPreview.slice(0, 100)}${sectionPreview.length > 100 ? "..." : ""} | Herramientas: ${toolsStr || "ninguna"}`,
							mode: {
								name: t.name,
								label: t.label || t.name,
								system_prompt: t.sections ? `<identity>\n${t.sections.identity || ""}\n</identity>` : "",
								tools: t.tools || [],
								model: "",
								temperature: t.temperature ?? 0.7,
								history_limit: t.history_limit ?? 10,
								tool_policy: (t.tool_policy as "auto" | "restricted" | "ask_user") || "auto",
							},
						};
					}
				);
				const fullItems = await Promise.all(
					items.map(async (item: { id: string; mode: Partial<AgentMode> }) => {
						try {
							const resp2 = await fetch(
								`${config.engineUrl}/api/prompts/resolved/${item.id}`,
								{ headers: config.apiKey ? { "X-API-Key": config.apiKey } : undefined }
							);
							if (resp2.ok) {
								const resolved = await resp2.json();
								item.mode.system_prompt = resolved.system_prompt || item.mode.system_prompt;
							}
						} catch {
							// keep partial prompt
						}
						return item;
					})
				);
				setTemplates(fullItems);
			} catch (err) {
				console.warn("[ModosList] Failed to fetch templates from backend:", err);
			}
		})();
	}, []);

	const applyTemplate = (tpl: (typeof templates)[0]) => {
		setNewMode({
			name: tpl.mode.name || "",
			label: tpl.mode.label || "",
			system_prompt: tpl.mode.system_prompt || "",
			tools: tpl.mode.tools || [],
			model: tpl.mode.model || "",
			temperature: tpl.mode.temperature ?? 0.7,
			history_limit: tpl.mode.history_limit ?? 10,
			tool_policy: (tpl.mode.tool_policy as "auto" | "restricted" | "ask_user") || "auto",
			extends: null,
			usage_count: 0,
			last_used: null,
		});
		setShowNewForm(true);
	};

	return (
		<div>
			{/* ─── Template presets section ─────────────────────────────── */}
			<div
				style={{
					marginBottom: "20px",
					padding: "14px 16px",
					borderRadius: "8px",
					background: "rgba(255,215,0,0.04)",
					border: "1px solid rgba(255,215,0,0.15)",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
					<FileText size={13} color="var(--accent)" />
					<label style={{ ...sectionTitle, marginBottom: 0 }}>Plantillas recomendadas</label>
				</div>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
						gap: "8px",
					}}
				>
					{templates.map((tpl) => (
						<button
							key={tpl.id}
							type="button"
							onClick={() => applyTemplate(tpl)}
							style={{
								padding: "10px 12px",
								borderRadius: "8px",
								background: "rgba(255,255,255,0.03)",
								border: "1px solid var(--border-light)",
								cursor: "pointer",
								textAlign: "left",
								transition: "all 0.2s ease",
								color: "inherit",
								fontFamily: "inherit",
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.background = "rgba(79,140,255,0.08)";
								e.currentTarget.style.borderColor = "rgba(79,140,255,0.3)";
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.background = "rgba(255,255,255,0.03)";
								e.currentTarget.style.borderColor = "var(--border-light)";
							}}
						>
							<div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>{tpl.name}</div>
							<div style={{ fontSize: "10px", color: "var(--text-dim)", lineHeight: 1.4 }}>
								{tpl.desc}
							</div>
							<div
								style={{
									marginTop: "6px",
									fontSize: "9px",
									fontWeight: 600,
									color: "var(--accent)",
									textTransform: "uppercase",
									letterSpacing: "0.5px",
								}}
							>
								Usar plantilla →
							</div>
						</button>
					))}
				</div>
			</div>

			{/* Header with Nuevo Modo button */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "12px",
				}}
			>
				<label style={{ ...sectionTitle, marginBottom: 0 }}>Modos ({modes.length})</label>
				<button
					type="button"
					onClick={() => setShowNewForm(!showNewForm)}
					style={{
						padding: "6px 12px",
						background: "rgba(79,140,255,0.1)",
						border: "1px solid rgba(79,140,255,0.2)",
						borderRadius: "6px",
						color: "var(--accent)",
						cursor: "pointer",
						fontSize: "10px",
						fontWeight: 600,
						display: "flex",
						alignItems: "center",
						gap: "4px",
					}}
				>
					{showNewForm ? <X size={12} /> : <Plus size={12} />}
					{showNewForm ? "Cancelar" : "Nuevo Modo"}
				</button>
			</div>

			{/* Nuevo Modo form */}
			{showNewForm && (
				<div
					style={{
						padding: "16px",
						marginBottom: "16px",
						borderRadius: "8px",
						background: "rgba(79,140,255,0.05)",
						border: "1px solid rgba(79,140,255,0.15)",
					}}
				>
					<div style={{ marginBottom: "10px" }}>
						<label
							style={{
								fontSize: "10px",
								fontWeight: 600,
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "4px",
							}}
						>
							Nombre interno *
						</label>
						<input
							type="text"
							value={newMode.name}
							onChange={(e) => setNewMode({ ...newMode, name: e.target.value })}
							style={inputStyleLocal}
							placeholder="asistente, desarrollador, etc."
						/>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<label
							style={{
								fontSize: "10px",
								fontWeight: 600,
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "4px",
							}}
						>
							Etiqueta visible *
						</label>
						<input
							type="text"
							value={newMode.label}
							onChange={(e) => setNewMode({ ...newMode, label: e.target.value })}
							style={inputStyleLocal}
							placeholder="Asistente"
						/>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<label
							style={{
								fontSize: "10px",
								fontWeight: 600,
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "4px",
							}}
						>
							System Prompt
						</label>
						<textarea
							value={newMode.system_prompt}
							onChange={(e) => setNewMode({ ...newMode, system_prompt: e.target.value })}
							rows={5}
							style={{
								...inputStyleLocal,
								resize: "vertical",
								fontFamily: "var(--font-mono)",
								fontSize: "12px",
							}}
							placeholder="Eres un asistente conversacional..."
						/>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<label
							style={{
								fontSize: "10px",
								fontWeight: 600,
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "4px",
							}}
						>
							Modelo
						</label>
						<select
							value={newMode.model}
							onChange={(e) => setNewMode({ ...newMode, model: e.target.value })}
							style={{
								...inputStyleLocal,
								appearance: "none",
								backgroundImage:
									"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E\")",
								backgroundRepeat: "no-repeat",
								backgroundPosition: "right 12px center",
								paddingRight: "32px",
								cursor: "pointer",
							}}
						>
							<option value="">Seleccionar modelo...</option>
							{ollamaModels.map((m) => (
								<option key={m} value={m}>
									{m}
								</option>
							))}
						</select>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<label
							style={{
								fontSize: "10px",
								fontWeight: 600,
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "4px",
							}}
						>
							Temperatura: {newMode.temperature.toFixed(1)}
						</label>
						<input
							type="range"
							min="0"
							max="2"
							step="0.1"
							value={newMode.temperature}
							onChange={(e) => setNewMode({ ...newMode, temperature: parseFloat(e.target.value) })}
							style={{ width: "100%", accentColor: "var(--accent)" }}
						/>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<label
							style={{
								fontSize: "10px",
								fontWeight: 600,
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "4px",
							}}
						>
							Limite de historial: {newMode.history_limit} mensajes
						</label>
						<input
							type="number"
							min={5}
							max={100}
							value={newMode.history_limit}
							onChange={(e) =>
								setNewMode({ ...newMode, history_limit: parseInt(e.target.value, 10) || 10 })
							}
							style={inputStyleLocal}
						/>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<label
							style={{
								fontSize: "10px",
								fontWeight: 600,
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "4px",
							}}
						>
							Politica de herramientas
						</label>
						<select
							value={newMode.tool_policy}
							onChange={(e) =>
								setNewMode({
									...newMode,
									tool_policy: e.target.value as "auto" | "restricted" | "ask_user",
								})
							}
							style={{
								...inputStyleLocal,
								appearance: "none",
								backgroundImage:
									"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E\")",
								backgroundRepeat: "no-repeat",
								backgroundPosition: "right 12px center",
								paddingRight: "32px",
								cursor: "pointer",
							}}
						>
							<option value="auto">Auto</option>
							<option value="restricted">Restringido</option>
							<option value="ask_user">Preguntar al usuario</option>
						</select>
					</div>
					<div style={{ marginBottom: "10px" }}>
						<label
							style={{
								fontSize: "10px",
								fontWeight: 600,
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "4px",
							}}
						>
							Herramientas habilitadas
						</label>
						<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
							{availableToolNames.map((toolName) => (
								<button
									key={toolName}
									type="button"
									onClick={() => toggleToolInNewForm(toolName)}
									style={{
										padding: "4px 10px",
										borderRadius: "12px",
										border: "1px solid",
										borderColor: newMode.tools?.includes(toolName)
											? "rgba(79,140,255,0.4)"
											: "var(--border-light)",
										background: newMode.tools?.includes(toolName)
											? "rgba(79,140,255,0.15)"
											: "rgba(255,255,255,0.03)",
										color: newMode.tools?.includes(toolName) ? "var(--accent)" : "var(--text-dim)",
										cursor: "pointer",
										fontSize: "11px",
										fontFamily: "var(--font-mono)",
									}}
								>
									{newMode.tools?.includes(toolName) ? "✅ " : "  "}
									{toolName}
								</button>
							))}
							{availableToolNames.length === 0 && (
								<span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
									Cargando herramientas...
								</span>
							)}
						</div>
					</div>
					<button type="button" onClick={handleCreateMode} style={actionBtnStyle}>
						<Save size={14} style={{ marginRight: "4px" }} /> Crear Modo
					</button>
				</div>
			)}

			{/* Mode list */}
			{modes.length === 0 && !showNewForm && (
				<div
					style={{
						padding: "24px",
						textAlign: "center",
						fontSize: "12px",
						color: "var(--text-dim)",
						borderRadius: "8px",
						background: "rgba(255,255,255,0.02)",
						border: "1px solid var(--border-light)",
					}}
				>
					No hay modos configurados. Crea un nuevo modo para empezar.
				</div>
			)}

			{modes.map((mode) => {
				const isActive = mode.name === activeModeName;
				const isEditing = editingMode === mode.name;

				if (isEditing && editForm) {
					return (
						<div
							key={mode.name}
							style={{
								padding: "16px",
								marginBottom: "12px",
								borderRadius: "8px",
								background: "rgba(79,140,255,0.05)",
								border: "1px solid rgba(79,140,255,0.2)",
							}}
						>
							<div style={{ ...sectionTitle, marginBottom: "10px", color: "var(--accent)" }}>
								Editando: {editForm.label || editForm.name}
							</div>
							<div style={{ marginBottom: "10px" }}>
								<label
									style={{
										fontSize: "10px",
										fontWeight: 600,
										color: "var(--text-muted)",
										display: "block",
										marginBottom: "4px",
									}}
								>
									Nombre
								</label>
								<input
									type="text"
									value={editForm.name}
									onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
									style={inputStyleLocal}
								/>
							</div>
							<div style={{ marginBottom: "10px" }}>
								<label
									style={{
										fontSize: "10px",
										fontWeight: 600,
										color: "var(--text-muted)",
										display: "block",
										marginBottom: "4px",
									}}
								>
									Etiqueta
								</label>
								<input
									type="text"
									value={editForm.label}
									onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
									style={inputStyleLocal}
								/>
							</div>
							<div style={{ marginBottom: "10px" }}>
								<label
									style={{
										fontSize: "10px",
										fontWeight: 600,
										color: "var(--text-muted)",
										display: "block",
										marginBottom: "4px",
									}}
								>
									System Prompt
								</label>
								<textarea
									value={editForm.system_prompt}
									onChange={(e) => setEditForm({ ...editForm, system_prompt: e.target.value })}
									rows={5}
									style={{
										...inputStyleLocal,
										resize: "vertical",
										fontFamily: "var(--font-mono)",
										fontSize: "12px",
									}}
								/>
							</div>
							<div style={{ marginBottom: "10px" }}>
								<label
									style={{
										fontSize: "10px",
										fontWeight: 600,
										color: "var(--text-muted)",
										display: "block",
										marginBottom: "4px",
									}}
								>
									Modelo
								</label>
								<select
									value={editForm.model}
									onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
									style={{
										...inputStyleLocal,
										appearance: "none",
										backgroundImage:
											"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E\")",
										backgroundRepeat: "no-repeat",
										backgroundPosition: "right 12px center",
										paddingRight: "32px",
										cursor: "pointer",
									}}
								>
									<option value="">Seleccionar modelo...</option>
									{ollamaModels.map((m) => (
										<option key={m} value={m}>
											{m}
										</option>
									))}
								</select>
							</div>
							<div style={{ marginBottom: "10px" }}>
								<label
									style={{
										fontSize: "10px",
										fontWeight: 600,
										color: "var(--text-muted)",
										display: "block",
										marginBottom: "4px",
									}}
								>
									Temperatura: {editForm.temperature.toFixed(1)}
								</label>
								<input
									type="range"
									min="0"
									max="2"
									step="0.1"
									value={editForm.temperature}
									onChange={(e) =>
										setEditForm({ ...editForm, temperature: parseFloat(e.target.value) })
									}
									style={{ width: "100%", accentColor: "var(--accent)" }}
								/>
							</div>
							<div style={{ marginBottom: "10px" }}>
								<label
									style={{
										fontSize: "10px",
										fontWeight: 600,
										color: "var(--text-muted)",
										display: "block",
										marginBottom: "4px",
									}}
								>
									Limite de historial: {editForm.history_limit} mensajes
								</label>
								<input
									type="number"
									min={5}
									max={100}
									value={editForm.history_limit}
									onChange={(e) =>
										setEditForm({ ...editForm, history_limit: parseInt(e.target.value, 10) || 10 })
									}
									style={inputStyleLocal}
								/>
							</div>
							<div style={{ marginBottom: "10px" }}>
								<label
									style={{
										fontSize: "10px",
										fontWeight: 600,
										color: "var(--text-muted)",
										display: "block",
										marginBottom: "4px",
									}}
								>
									Politica de herramientas
								</label>
								<select
									value={editForm.tool_policy}
									onChange={(e) =>
										setEditForm({
											...editForm,
											tool_policy: e.target.value as "auto" | "restricted" | "ask_user",
										})
									}
									style={{
										...inputStyleLocal,
										appearance: "none",
										backgroundImage:
											"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E\")",
										backgroundRepeat: "no-repeat",
										backgroundPosition: "right 12px center",
										paddingRight: "32px",
										cursor: "pointer",
									}}
								>
									<option value="auto">Auto</option>
									<option value="restricted">Restringido</option>
									<option value="ask_user">Preguntar al usuario</option>
								</select>
							</div>
							<div style={{ marginBottom: "10px" }}>
								<label
									style={{
										fontSize: "10px",
										fontWeight: 600,
										color: "var(--text-muted)",
										display: "block",
										marginBottom: "4px",
									}}
								>
									Herramientas habilitadas
								</label>
								<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
									{availableToolNames.map((toolName) => (
										<button
											key={toolName}
											type="button"
											onClick={() => toggleToolInForm(toolName)}
											style={{
												padding: "4px 10px",
												borderRadius: "12px",
												border: "1px solid",
												borderColor: editForm.tools?.includes(toolName)
													? "rgba(79,140,255,0.4)"
													: "var(--border-light)",
												background: editForm.tools?.includes(toolName)
													? "rgba(79,140,255,0.15)"
													: "rgba(255,255,255,0.03)",
												color: editForm.tools?.includes(toolName)
													? "var(--accent)"
													: "var(--text-dim)",
												cursor: "pointer",
												fontSize: "11px",
												fontFamily: "var(--font-mono)",
											}}
										>
											{editForm.tools?.includes(toolName) ? "✅ " : "  "}
											{toolName}
										</button>
									))}
								</div>
							</div>
							<div style={{ display: "flex", gap: "8px" }}>
								<button type="button" onClick={() => handleSaveMode(editForm)} style={actionBtnStyle}>
									<Save size={14} style={{ marginRight: "4px" }} /> Guardar
								</button>
								<button
									type="button"
									onClick={cancelEdit}
									style={{
										...actionBtnStyle,
										background: "rgba(255,255,255,0.05)",
										borderColor: "var(--border-light)",
										color: "var(--text-muted)",
									}}
								>
									<X size={14} style={{ marginRight: "4px" }} /> Cancelar
								</button>
							</div>
						</div>
					);
				}

				return (
					<div
						key={mode.name}
						style={{
							padding: "14px",
							marginBottom: "8px",
							borderRadius: "8px",
							background: isActive ? "rgba(79,140,255,0.06)" : "rgba(255,255,255,0.02)",
							border: isActive ? "1px solid rgba(79,140,255,0.3)" : "1px solid var(--border-light)",
							display: "flex",
							alignItems: "center",
							gap: "12px",
							transition: "all 0.2s ease",
						}}
					>
						<div style={{ flex: 1, minWidth: 0 }}>
							<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
								<span
									style={{
										fontSize: "14px",
										fontWeight: 600,
										color: isActive ? "var(--accent)" : "var(--text-main)",
									}}
								>
									{mode.label || mode.name}
								</span>
								{isActive && (
									<span
										style={{
											padding: "2px 8px",
											borderRadius: "4px",
											fontSize: "9px",
											fontWeight: 700,
											background: "rgba(79,140,255,0.15)",
											color: "var(--accent)",
											border: "1px solid rgba(79,140,255,0.3)",
										}}
									>
										ACTIVO
									</span>
								)}
							</div>
							<div
								style={{
									fontSize: "11px",
									color: "var(--text-dim)",
									marginTop: "4px",
									display: "flex",
									gap: "12px",
									flexWrap: "wrap",
								}}
							>
								<span>Tools: {mode.tools?.length || 0}</span>
								<span>Model: {mode.model || "(default)"}</span>
								<span>Temp: {mode.temperature.toFixed(1)}</span>
								<span>History: {mode.history_limit}</span>
								<span>Used: {formatDate(mode.last_used)}</span>
							</div>
						</div>
						<div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
							<button type="button" onClick={() => startEdit(mode)} style={smallBtnStyle} title="Editar">
								<Edit3 size={14} />
							</button>
							<button
								type="button"
								onClick={() => handleDeleteMode(mode.name)}
								style={dangerBtnStyle}
								title="Eliminar"
							>
								<Trash2 size={14} />
							</button>
						</div>
					</div>
				);
			})}
		</div>
	);
};
