import { Power, PowerOff, Save, Settings, Sliders } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useWs } from "../contexts/WebSocketContext";

interface GeneralConfig {
	model: string;
	temperature: number;
	history_limit: number;
	system_prompt: string;
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

export const AgentePrincipal: React.FC = () => {
	const { connected, send: sendWs, subscribe } = useWs();
	const [configModel, setConfigModel] = useState("");
	const [configTemp, setConfigTemp] = useState(0.7);
	const [configHistoryLimit, setConfigHistoryLimit] = useState(10);
	const [configSystemPrompt, setConfigSystemPrompt] = useState("");

	const [telegramToken, setTelegramToken] = useState("");
	const [telegramEnabled, setTelegramEnabled] = useState(false);
	const [tools, setTools] = useState<ToolInfo[]>([]);
	const [ollamaModels, setOllamaModels] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const savingRef = useRef(false);
	const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	useEffect(() => {
		return subscribe((msg) => {
			switch (msg.type) {
				case "general_config": {
					const gc = msg.payload as unknown as GeneralConfig;
					if (gc?.model != null) setConfigModel(gc.model || "");
					if (gc?.temperature != null) setConfigTemp(gc.temperature);
					if (gc?.history_limit != null) setConfigHistoryLimit(gc.history_limit);
					if (gc?.system_prompt != null) setConfigSystemPrompt(gc.system_prompt || "");
					if (savingRef.current) {
						setSaving(false);
						savingRef.current = false;
						setSaveMessage({ type: "success", text: "Configuraci\u00f3n guardada correctamente" });
						setTimeout(() => setSaveMessage(null), 2500);
					}
					break;
				}
				case "status":
					if (msg.payload?.model) setConfigModel(msg.payload.model as string);
					if (msg.payload?.telegramActive !== undefined) {
						setTelegramEnabled(msg.payload.telegramActive as boolean);
					}
					break;
				case "tools_list": {
					const toolList = msg.payload?.tools as ToolInfo[];
					if (Array.isArray(toolList)) {
						setTools(toolList);
					}
					break;
				}
				case "ollama_models": {
					const models = (msg.payload?.models as Array<{ name: string }>) || [];
					setOllamaModels(models.map((m) => m.name));
					break;
				}
			}
		});
	}, [subscribe]);

	useEffect(() => {
		if (connected) {
			sendWs("get_general_config", {});
			sendWs("get_status", {});
			sendWs("list_tools", {});
			sendWs("list_ollama_models", {});
		}
	}, [connected, sendWs]);

	const handleSaveGeneralConfig = () => {
		setSaveMessage(null);
		if (!connected) {
			setSaveMessage({
				type: "error",
				text: "No hay conexi\u00f3n con el servidor. Verifica que el Agent Engine est\u00e9 corriendo.",
			});
			return;
		}
		const payload: Record<string, unknown> = {
			model: configModel,
			temperature: configTemp,
			history_limit: configHistoryLimit,
		};
		if (configSystemPrompt.trim()) {
			payload.system_prompt = configSystemPrompt;
		}
		sendWs("general_config_update", payload);
		setSaving(true);
		savingRef.current = true;
	};

	const handleTelegramSave = () => {
		sendWs("telegram_update", { botToken: telegramToken, enabled: telegramEnabled });
	};

	const handleToolToggle = (toolName: string, enabled: boolean) => {
		sendWs("toggle_tool", { name: toolName, enabled });
		setTools((prev) => prev.map((t) => (t.spec.function.name === toolName ? { ...t, enabled } : t)));
	};

	const sectionCard: React.CSSProperties = {
		padding: "16px",
		borderRadius: "8px",
		background: "rgba(255,255,255,0.02)",
		border: "1px solid var(--border-light)",
		marginBottom: "16px",
	};

	const sectionCardGrid: React.CSSProperties = {
		padding: "16px",
		borderRadius: "8px",
		background: "rgba(255,255,255,0.02)",
		border: "1px solid var(--border-light)",
		height: "100%",
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

	return (
		<>
			<div style={sectionCard}>
				<label style={sectionTitle}>
					<Settings size={14} style={{ marginRight: "6px" }} />
					Agent Engine
				</label>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						fontSize: "13px",
						color: "var(--text-main)",
					}}
				>
					<span
						style={{
							width: "8px",
							height: "8px",
							borderRadius: "50%",
							background: connected ? "var(--success)" : "var(--error)",
							display: "inline-block",
						}}
					/>
					{connected ? "Conectado" : "Desconectado"}
					{configModel && (
						<span style={{ color: "var(--accent)", fontFamily: "monospace", fontSize: "12px" }}>
							{configModel}
						</span>
					)}
				</div>
			</div>

			<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
				<div style={sectionCardGrid}>
					<label style={sectionTitle}>
						<Sliders size={14} style={{ marginRight: "6px" }} />
						Configuraci&oacute;n General
					</label>

					<div style={{ marginBottom: "12px" }}>
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
							value={configModel}
							onChange={(e) => setConfigModel(e.target.value)}
							style={{
								...inputStyle,
								appearance: "none",
								backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
								backgroundRepeat: "no-repeat",
								backgroundPosition: "right 12px center",
								paddingRight: "32px",
								cursor: "pointer",
							}}
						>
							{ollamaModels.length === 0 && <option value="">Cargando modelos...</option>}
							{!ollamaModels.includes(configModel) && configModel && (
								<option value={configModel}>{configModel}</option>
							)}
							{ollamaModels.map((m) => (
								<option key={m} value={m}>
									{m}
								</option>
							))}
						</select>
						{ollamaModels.length === 0 && (
							<div style={{ fontSize: "10px", color: "var(--warning)", marginTop: "4px" }}>
								No se pudieron cargar los modelos. &iquest;Ollama est&aacute; corriendo?
							</div>
						)}
					</div>

					<div style={{ marginBottom: "12px" }}>
						<label
							style={{
								fontSize: "10px",
								fontWeight: 600,
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "4px",
							}}
						>
							Temperatura: {configTemp.toFixed(1)}
						</label>
						<input
							type="range"
							min="0"
							max="2"
							step="0.1"
							value={configTemp}
							onChange={(e) => setConfigTemp(parseFloat(e.target.value))}
							style={{ width: "100%", accentColor: "var(--accent)" }}
						/>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								fontSize: "9px",
								color: "var(--text-dim)",
							}}
						>
							<span>0 (preciso)</span>
							<span>2 (creativo)</span>
						</div>
					</div>

					<div style={{ marginBottom: "12px" }}>
						<label
							style={{
								fontSize: "10px",
								fontWeight: 600,
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "4px",
							}}
						>
							L&iacute;mite de historial: {configHistoryLimit} mensajes
						</label>
						<input
							type="number"
							min={5}
							max={100}
							value={configHistoryLimit}
							onChange={(e) => setConfigHistoryLimit(parseInt(e.target.value, 10) || 10)}
							style={inputStyle}
						/>
					</div>

					<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
						<button
							type="button"
							onClick={handleSaveGeneralConfig}
							disabled={saving}
							style={{
								...actionBtnStyle,
								opacity: saving ? 0.6 : 1,
								cursor: saving ? "wait" : "pointer",
							}}
						>
							<Save size={14} style={{ marginRight: "4px" }} />
							{saving ? "Guardando..." : "Guardar Configuraci&oacute;n"}
						</button>
						{saveMessage && (
							<span
								style={{
									fontSize: "11px",
									fontWeight: 500,
									color: saveMessage.type === "success" ? "var(--success)" : "var(--error)",
								}}
							>
								{saveMessage.text}
							</span>
						)}
					</div>
				</div>

				<div style={sectionCardGrid}>
					<label style={sectionTitle}>Telegram Bot</label>
					<div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
						<input
							type="password"
							value={telegramToken}
							onChange={(e) => setTelegramToken(e.target.value)}
							placeholder="123456:ABC-DEF..."
							style={{ ...inputStyle, flex: 1 }}
						/>
						<button type="button" onClick={handleTelegramSave} style={actionBtnStyle}>
							<Save size={14} style={{ marginRight: "4px" }} /> Guardar
						</button>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
						<span
							style={{
								width: "8px",
								height: "8px",
								borderRadius: "50%",
								background: telegramEnabled ? "var(--success)" : "var(--error)",
								display: "inline-block",
							}}
						/>
						<span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
							{telegramEnabled ? "Bot activo" : "Bot inactivo"}
						</span>
					</div>
				</div>
			</div>

			{/* System Prompt */}
			<div style={sectionCard}>
				<label style={sectionTitle}>System Prompt del agente principal</label>
				<textarea
					value={configSystemPrompt}
					onChange={(e) => setConfigSystemPrompt(e.target.value)}
					rows={6}
					style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: "12px" }}
					placeholder="Eres un asistente conversacional y operativo..."
				/>
				<div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "6px" }}>
					Define la personalidad y reglas del agente principal. Se guarda junto con la configuraci&oacute;n general.
				</div>
			</div>

			{/* Tools */}
			<div style={sectionCard}>
				<label style={sectionTitle}>Herramientas ({tools.length})</label>
				<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
					{tools.map((tool) => {
						const isEnabled = tool.enabled;
						const name = tool.spec.function.name;
						const desc = tool.spec.function.description;
						return (
							<div
								key={name}
								style={{
									display: "flex",
									alignItems: "center",
									gap: "12px",
									padding: "12px",
									borderRadius: "8px",
									background: isEnabled ? "rgba(79,140,255,0.04)" : "rgba(255,255,255,0.01)",
									border: `1px solid ${isEnabled ? "rgba(79,140,255,0.15)" : "var(--border-light)"}`,
									opacity: isEnabled ? 1 : 0.55,
									transition: "all 0.2s ease",
								}}
							>
								<div style={{ flex: 1, minWidth: 0 }}>
									<div
										style={{
											fontSize: "13px",
											fontWeight: 600,
											color: "var(--text-main)",
											fontFamily: "var(--font-mono)",
											marginBottom: "2px",
										}}
									>
										{name}
									</div>
									<div
										style={{
											fontSize: "11px",
											color: "var(--text-dim)",
											lineHeight: 1.4,
											overflow: "hidden",
											textOverflow: "ellipsis",
											display: "-webkit-box",
											WebkitLineClamp: 2,
											WebkitBoxOrient: "vertical",
										}}
									>
										{desc}
									</div>
								</div>
								<button
									type="button"
									onClick={() => handleToolToggle(name, !isEnabled)}
									title={isEnabled ? "Desactivar" : "Activar"}
									style={{
										display: "flex",
										alignItems: "center",
										gap: "6px",
										padding: "6px 12px",
										borderRadius: "6px",
										border: "none",
										background: isEnabled ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.1)",
										color: isEnabled ? "var(--success)" : "var(--error)",
										cursor: "pointer",
										fontSize: "11px",
										fontWeight: 600,
										fontFamily: "inherit",
										whiteSpace: "nowrap",
										transition: "all 0.2s ease",
										flexShrink: 0,
									}}
								>
									{isEnabled ? <Power size={12} /> : <PowerOff size={12} />}
									{isEnabled ? "Activo" : "Inactivo"}
								</button>
							</div>
						);
					})}
				</div>
			</div>
		</>
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
