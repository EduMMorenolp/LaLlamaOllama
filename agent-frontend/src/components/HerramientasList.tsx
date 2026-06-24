import { Code, Globe, Plus, Terminal, Trash2, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useWs } from "../contexts/WebSocketContext";

interface ToolSpec {
	type: string;
	function: {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	};
}

interface ToolInfo {
	spec: ToolSpec;
	enabled: boolean;
	handler_type?: string;
	handler_config?: Record<string, unknown>;
}

interface CustomToolRow {
	name: string;
	description: string;
	parameters: string;
	handler_type: "bash" | "http" | "prompt";
	handler_config: string;
	created_at: string;
	updated_at: string;
}

const sectionCard: React.CSSProperties = {
	padding: "16px",
	borderRadius: "8px",
	background: "rgba(255,255,255,0.02)",
	border: "1px solid var(--border-light)",
	marginBottom: "16px",
};

const inputStyle: React.CSSProperties = {
	width: "100%",
	padding: "8px 10px",
	borderRadius: "6px",
	border: "1px solid var(--border-light)",
	background: "rgba(255,255,255,0.03)",
	color: "var(--text-main)",
	fontSize: "12px",
	outline: "none",
	fontFamily: "inherit",
	boxSizing: "border-box",
};

const btnStyle: React.CSSProperties = {
	padding: "6px 14px",
	borderRadius: "6px",
	border: "1px solid rgba(79,140,255,0.2)",
	background: "rgba(79,140,255,0.1)",
	color: "var(--accent)",
	cursor: "pointer",
	fontSize: "11px",
	fontWeight: 600,
	display: "inline-flex",
	alignItems: "center",
	gap: "6px",
	fontFamily: "inherit",
};

const dangerBtnStyle: React.CSSProperties = {
	...btnStyle,
	border: "1px solid rgba(239,68,68,0.2)",
	background: "rgba(239,68,68,0.1)",
	color: "var(--error)",
};

const HANDLER_TYPE_ICONS: Record<string, React.ReactNode> = {
	bash: <Terminal size={14} />,
	http: <Globe size={14} />,
	prompt: <Code size={14} />,
};

const HANDLER_TYPE_LABELS: Record<string, string> = {
	bash: "Shell",
	http: "HTTP",
	prompt: "Prompt",
};

export const HerramientasList: React.FC = () => {
	const { connected, send: sendWs, subscribe } = useWs();
	const [tools, setTools] = useState<ToolInfo[]>([]);
	const [customToolNames, setCustomToolNames] = useState<Set<string>>(new Set());
	const [showForm, setShowForm] = useState(false);
	const [editingName, setEditingName] = useState<string | null>(null);
	const [formName, setFormName] = useState("");
	const [formDescription, setFormDescription] = useState("");
	const [formHandlerType, setFormHandlerType] = useState<"bash" | "http" | "prompt">("bash");
	const [formHandlerConfig, setFormHandlerConfig] = useState("{}");
	const [formParameters, setFormParameters] = useState("{}");

	useEffect(() => {
		return subscribe((msg) => {
			switch (msg.type) {
				case "tools_list": {
					const list = msg.payload?.tools as ToolInfo[];
					if (Array.isArray(list)) setTools(list);
					break;
				}
				case "custom_tools_db_list": {
					const list = msg.payload?.tools as CustomToolRow[];
					if (Array.isArray(list)) setCustomToolNames(new Set(list.map((t) => t.name)));
					break;
				}
			}
		});
	}, [subscribe]);

	useEffect(() => {
		if (connected) {
			sendWs("list_tools", {});
			sendWs("list_custom_tools_db", {});
		}
	}, [connected, sendWs]);

	const handleToggle = (name: string, current: boolean) => {
		sendWs("toggle_tool", { name, enabled: !current });
	};

	const openCreate = () => {
		setEditingName(null);
		setFormName("");
		setFormDescription("");
		setFormHandlerType("bash");
		setFormHandlerConfig("{}");
		setFormParameters("{}");
		setShowForm(true);
	};

	const openEdit = (tool: ToolInfo) => {
		setEditingName(tool.spec.function.name);
		setFormName(tool.spec.function.name);
		setFormDescription(tool.spec.function.description);
		const ct = tool as ToolInfo & { handler_type?: string; handler_config?: Record<string, unknown> };
		setFormHandlerType((ct.handler_type as "bash" | "http" | "prompt") || "bash");
		setFormHandlerConfig(ct.handler_config ? JSON.stringify(ct.handler_config, null, 2) : "{}");
		setFormParameters(JSON.stringify(tool.spec.function.parameters, null, 2));
		setShowForm(true);
	};

	const handleSave = () => {
		if (!formName.trim() || !formDescription.trim()) return;
		let handlerConfig: Record<string, unknown>;
		let params: Record<string, unknown>;
		try { handlerConfig = JSON.parse(formHandlerConfig); } catch { handlerConfig = {}; }
		try { params = JSON.parse(formParameters); } catch { params = {}; }
		sendWs("save_custom_tool", {
			name: formName.trim(),
			description: formDescription.trim(),
			handler_type: formHandlerType,
			handler_config: handlerConfig,
			parameters: params,
		});
		setShowForm(false);
		setEditingName(null);
	};

	const handleDelete = (name: string) => {
		sendWs("delete_custom_tool", { name });
	};

	const isCustom = (name: string) => customToolNames.has(name);

	return (
		<div>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
				<div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-dim)" }}>
					{tools.length} herramientas registradas
					{customToolNames.size > 0 && (
						<span style={{ marginLeft: "8px", color: "var(--accent)" }}>
							({customToolNames.size} personalizadas)
						</span>
					)}
				</div>
				<button type="button" onClick={openCreate} style={btnStyle}>
					<Plus size={14} />
					Nueva Herramienta
				</button>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
				{tools.map((tool) => {
					const fn = tool.spec.function;
					const enabled = tool.enabled;
					const custom = isCustom(fn.name);
					return (
						<div
							key={fn.name}
							style={{
								...sectionCard,
								display: "flex",
								alignItems: "center",
								gap: "12px",
								padding: "12px 16px",
								marginBottom: 0,
								opacity: enabled ? 1 : 0.45,
								transition: "all 0.2s ease",
							}}
						>
							<Wrench size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
							<div style={{ flex: 1, minWidth: 0 }}>
								<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
									<span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>
										{fn.name}
									</span>
									{custom && (
										<span style={{
											fontSize: "9px",
											fontWeight: 600,
											padding: "1px 5px",
											borderRadius: "3px",
											background: "rgba(167,139,250,0.15)",
											color: "#a78bfa",
										}}>
											custom
										</span>
									)}
								</div>
								<div style={{ fontSize: "11px", color: "var(--text-dim)", lineHeight: "1.4" }}>
									{fn.description || "(sin descripción)"}
								</div>
							</div>
							<div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
								<label
									style={{
										position: "relative",
										display: "inline-block",
										width: "36px",
										height: "20px",
										cursor: "pointer",
									}}
								>
									<input
										type="checkbox"
										checked={enabled}
										onChange={() => handleToggle(fn.name, enabled)}
										style={{ display: "none" }}
									/>
									<span
										style={{
											position: "absolute",
											inset: 0,
											backgroundColor: enabled ? "var(--accent)" : "rgba(255,255,255,0.15)",
											borderRadius: "20px",
											transition: "all 0.2s ease",
										}}
									>
										<span
											style={{
												position: "absolute",
												width: "16px",
												height: "16px",
												borderRadius: "50%",
												background: "#fff",
												top: "2px",
												left: enabled ? "18px" : "2px",
												transition: "all 0.2s ease",
												boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
											}}
										/>
									</span>
								</label>
								{custom && (
									<>
										<button
											type="button"
											onClick={() => openEdit(tool)}
											style={{
												...btnStyle,
												padding: "4px 8px",
												fontSize: "10px",
											}}
										>
											Editar
										</button>
										<button
											type="button"
											onClick={() => handleDelete(fn.name)}
											style={{
												...dangerBtnStyle,
												padding: "4px 8px",
												fontSize: "10px",
											}}
										>
											<Trash2 size={12} />
										</button>
									</>
								)}
							</div>
						</div>
					);
				})}
			</div>

			{/* Create/Edit Modal */}
			{showForm && (
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
					onClick={() => setShowForm(false)}
				>
					<div
						style={{
							background: "var(--bg-surface)",
							border: "1px solid var(--border)",
							borderRadius: "16px",
							width: "520px",
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
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
							<span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>
								{editingName ? `Editar: ${editingName}` : "Nueva Herramienta Personalizada"}
							</span>
							<button
								type="button"
								onClick={() => setShowForm(false)}
								style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}
							>
								<X size={18} />
							</button>
						</div>

						<div>
							<label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
								Nombre (snake_case)
							</label>
							<input
								type="text"
								value={formName}
								onChange={(e) => setFormName(e.target.value)}
								placeholder="mi_herramienta"
								style={inputStyle}
								disabled={!!editingName}
							/>
						</div>

						<div>
							<label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
								Descripción
							</label>
							<input
								type="text"
								value={formDescription}
								onChange={(e) => setFormDescription(e.target.value)}
								placeholder="Qué hace esta herramienta..."
								style={inputStyle}
							/>
						</div>

						<div>
							<label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
								Tipo
							</label>
							<div style={{ display: "flex", gap: "8px" }}>
								{(["bash", "http", "prompt"] as const).map((type) => (
									<button
										key={type}
										type="button"
										onClick={() => setFormHandlerType(type)}
										style={{
											flex: 1,
											padding: "8px",
											borderRadius: "6px",
											border: `1px solid ${formHandlerType === type ? "var(--accent)" : "var(--border-light)"}`,
											background: formHandlerType === type ? "rgba(79,140,255,0.1)" : "rgba(255,255,255,0.02)",
											color: formHandlerType === type ? "var(--accent)" : "var(--text-dim)",
											cursor: "pointer",
											fontSize: "11px",
											fontWeight: 600,
											fontFamily: "inherit",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											gap: "6px",
										}}
									>
										{HANDLER_TYPE_ICONS[type]}
										{HANDLER_TYPE_LABELS[type]}
									</button>
								))}
							</div>
						</div>

						<div>
							<label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
								Configuración (JSON)
								{formHandlerType === "bash" && <span style={{ fontWeight: 400, color: "var(--text-dim)" }}> — {"{ \"command\": \"...\", \"timeout\": 30000, \"workdir\": \"...\" }"}</span>}
								{formHandlerType === "http" && <span style={{ fontWeight: 400, color: "var(--text-dim)" }}> — {"{ \"url\": \"...\", \"method\": \"GET\", \"headers\": {}, \"body\": \"...\" }"}</span>}
								{formHandlerType === "prompt" && <span style={{ fontWeight: 400, color: "var(--text-dim)" }}> — {"{ \"prompt\": \"...\" }"}</span>}
							</label>
							<textarea
								value={formHandlerConfig}
								onChange={(e) => setFormHandlerConfig(e.target.value)}
								rows={5}
								style={{
									...inputStyle,
									resize: "vertical",
									fontFamily: "monospace",
									fontSize: "11px",
								}}
							/>
						</div>

						<div>
							<label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
								Parámetros (JSON Schema)
							</label>
							<textarea
								value={formParameters}
								onChange={(e) => setFormParameters(e.target.value)}
								rows={4}
								placeholder='{"type":"object","properties":{"input":{"type":"string"}},"required":["input"]}'
								style={{
									...inputStyle,
									resize: "vertical",
									fontFamily: "monospace",
									fontSize: "11px",
								}}
							/>
						</div>

						<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
							<button
								type="button"
								onClick={() => setShowForm(false)}
								style={{
									...btnStyle,
									background: "transparent",
									border: "1px solid var(--border-light)",
									color: "var(--text-dim)",
								}}
							>
								Cancelar
							</button>
							<button
								type="button"
								onClick={handleSave}
								disabled={!formName.trim() || !formDescription.trim()}
								style={{
									...btnStyle,
									opacity: (!formName.trim() || !formDescription.trim()) ? 0.5 : 1,
								}}
							>
								{editingName ? "Actualizar" : "Crear Herramienta"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
