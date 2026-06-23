import { Check, Copy, Eye, EyeOff, PlugZap, Power, RefreshCw, Save, ShieldAlert, ShieldCheck } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api.service";
import type { StatusResponse } from "../types/api";

interface ConnectionPanelProps {
	status?: StatusResponse;
	apiKeyValue: string;
	rememberKey: boolean;
	onSaveApiKey: (nextKey: string, remember: boolean) => Promise<void>;
	onToggleMcpAuth: (enabled: boolean) => Promise<void>;
}

interface McpAction {
	name: string;
	description: string;
	enabled: boolean;
}

interface NgrokConfig {
	containerName: string;
	targetService: string;
	targetPort: string;
	dashboardApiUrl: string;
	authtokenConfigured: boolean;
}

const getErrorMessage = (err: unknown, fallback: string) => {
	if (err instanceof Error && err.message) return err.message;
	const maybeResponseError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
	if (maybeResponseError) return maybeResponseError;
	return fallback;
};

const MCP_ACTION_TRANSLATIONS: Record<string, { title: string; description: string }> = {
	list_models: {
		title: "listar modelos",
		description: "Lista los modelos instalados en Ollama",
	},
	pull_model: {
		title: "descargar modelo",
		description: "Descarga un nuevo modelo desde la biblioteca de Ollama",
	},
	generate: {
		title: "generar respuesta",
		description: "Genera una respuesta para un prompt",
	},
	chat: {
		title: "chat",
		description: "Envia un mensaje de chat a un modelo",
	},
	unload_models: {
		title: "descargar modelos de VRAM",
		description: "Descarga todos los modelos de VRAM para liberar GPU",
	},
	get_server_status: {
		title: "estado del servidor",
		description: "Obtiene telemetria del servidor (VRAM, disco, ngrok)",
	},
	delete_model: {
		title: "borrar modelo",
		description: "Elimina un modelo del disco para liberar espacio",
	},
};

const toSpanishAction = (action: McpAction) => {
	const translation = MCP_ACTION_TRANSLATIONS[action.name];
	if (!translation) {
		return {
			title: action.name.replaceAll("_", " "),
			description: action.description,
		};
	}

	return translation;
};

export const ConnectionPanel: React.FC<ConnectionPanelProps> = ({
	status,
	apiKeyValue,
	rememberKey,
	onSaveApiKey,
	onToggleMcpAuth,
}) => {
	const [apiKeyInput, setApiKeyInput] = useState(apiKeyValue);
	const [remember, setRemember] = useState(rememberKey);
	const [showKey, setShowKey] = useState(false);
	const [saving, setSaving] = useState(false);
	const [mcpUpdating, setMcpUpdating] = useState(false);
	const [activeView, setActiveView] = useState<"apikey" | "mcp" | "ngrok">("apikey");
	const [mcpActions, setMcpActions] = useState<McpAction[]>([]);
	const [mcpActionsLoading, setMcpActionsLoading] = useState(false);
	const [mcpActionSaving, setMcpActionSaving] = useState<string | null>(null);
	const [ngrokRunning, setNgrokRunning] = useState<boolean>(false);
	const [ngrokUrl, setNgrokUrl] = useState<string | null>(null);
	const [ngrokLoading, setNgrokLoading] = useState(false);
	const [ngrokConfig, setNgrokConfig] = useState<NgrokConfig | null>(null);
	const [ngrokConfigLoading, setNgrokConfigLoading] = useState(false);
	const [ngrokTokenInput, setNgrokTokenInput] = useState("");
	const [ngrokTokenSaving, setNgrokTokenSaving] = useState(false);
	const [showNgrokToken, setShowNgrokToken] = useState(false);
	const [copiedUrl, setCopiedUrl] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const mcpAuthEnabled = status?.auth?.mcpAuthEnabled ?? true;
	const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
	const mcpSseUrl = useMemo(() => `${baseUrl}/sse`, [baseUrl]);
	const mcpMessagesUrl = useMemo(() => `${baseUrl}/messages`, [baseUrl]);

	useEffect(() => {
		setApiKeyInput(apiKeyValue);
	}, [apiKeyValue]);

	useEffect(() => {
		setRemember(rememberKey);
	}, [rememberKey]);

	const loadMcpActions = useCallback(async () => {
		setMcpActionsLoading(true);
		try {
			const res = await api.get("/api/auth/mcp/tools");
			setMcpActions(res.data?.tools || []);
		} catch (err: unknown) {
			setMessage(getErrorMessage(err, "No se pudo cargar acciones MCP."));
		} finally {
			setMcpActionsLoading(false);
		}
	}, []);

	const loadNgrokStatus = useCallback(async () => {
		setNgrokLoading(true);
		try {
			const res = await api.get("/api/ngrok/status");
			setNgrokRunning(Boolean(res.data?.running));
			setNgrokUrl(res.data?.url || null);
		} catch (err: unknown) {
			setMessage(getErrorMessage(err, "No se pudo cargar estado de ngrok."));
		} finally {
			setNgrokLoading(false);
		}
	}, []);

	const loadNgrokConfig = useCallback(async () => {
		setNgrokConfigLoading(true);
		try {
			const res = await api.get("/api/ngrok/config");
			setNgrokConfig(res.data || null);
		} catch (err: unknown) {
			setMessage(getErrorMessage(err, "No se pudo cargar configuracion de ngrok."));
		} finally {
			setNgrokConfigLoading(false);
		}
	}, []);

	const loadNgrokData = useCallback(async () => {
		await Promise.all([loadNgrokStatus(), loadNgrokConfig()]);
	}, [loadNgrokConfig, loadNgrokStatus]);

	useEffect(() => {
		if (activeView === "mcp") {
			loadMcpActions();
		}
		if (activeView === "ngrok") {
			loadNgrokData();
		}
	}, [activeView, loadMcpActions, loadNgrokData]);

	const handleSave = async () => {
		setSaving(true);
		setMessage(null);
		try {
			await onSaveApiKey(apiKeyInput, remember);
			setMessage("API Key actualizada y validada correctamente.");
		} catch (err: unknown) {
			setMessage(getErrorMessage(err, "No se pudo actualizar la API Key."));
		} finally {
			setSaving(false);
		}
	};

	const handleToggleMcp = async () => {
		setMcpUpdating(true);
		setMessage(null);
		try {
			await onToggleMcpAuth(!mcpAuthEnabled);
			setMessage(`Autenticacion MCP ${!mcpAuthEnabled ? "habilitada" : "deshabilitada"}.`);
			await loadMcpActions();
		} catch (err: unknown) {
			setMessage(getErrorMessage(err, "No se pudo actualizar MCP."));
		} finally {
			setMcpUpdating(false);
		}
	};

	const handleToggleMcpAction = async (action: McpAction) => {
		setMcpActionSaving(action.name);
		setMessage(null);
		try {
			await api.post(`/api/auth/mcp/tools/${action.name}`, { enabled: !action.enabled });
			setMcpActions((prev) =>
				prev.map((item) => (item.name === action.name ? { ...item, enabled: !item.enabled } : item))
			);
		} catch (err: unknown) {
			setMessage(getErrorMessage(err, "No se pudo actualizar accion MCP."));
		} finally {
			setMcpActionSaving(null);
		}
	};

	const handleToggleNgrok = async () => {
		setNgrokLoading(true);
		setMessage(null);
		try {
			const endpoint = ngrokRunning ? "/api/ngrok/stop" : "/api/ngrok/start";
			await api.post(endpoint, {});
			await loadNgrokStatus();
		} catch (err: unknown) {
			setMessage(getErrorMessage(err, "No se pudo controlar ngrok."));
		} finally {
			setNgrokLoading(false);
		}
	};

	const handleRestartNgrok = async () => {
		setNgrokLoading(true);
		setMessage(null);
		try {
			await api.post("/api/ngrok/stop", {});
			await api.post("/api/ngrok/start", {});
			await loadNgrokStatus();
		} catch (err: unknown) {
			setMessage(getErrorMessage(err, "No se pudo reiniciar ngrok."));
		} finally {
			setNgrokLoading(false);
		}
	};

	const copyNgrokUrl = async () => {
		if (!ngrokUrl) return;
		await navigator.clipboard.writeText(ngrokUrl);
		setCopiedUrl(true);
		setTimeout(() => setCopiedUrl(false), 1800);
	};

	const handleSaveNgrokToken = async () => {
		const token = ngrokTokenInput.trim();
		if (token.length < 10) {
			setMessage("El authtoken de ngrok parece invalido.");
			return;
		}

		setNgrokTokenSaving(true);
		setMessage(null);
		try {
			await api.post("/api/ngrok/authtoken", { authtoken: token });
			setNgrokTokenInput("");
			setShowNgrokToken(false);
			setMessage("Authtoken de ngrok actualizado correctamente.");
			await loadNgrokData();
		} catch (err: unknown) {
			setMessage(getErrorMessage(err, "No se pudo guardar authtoken de ngrok."));
		} finally {
			setNgrokTokenSaving(false);
		}
	};

	return (
		<div className="connection-wrap" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
			<div
				className="card-glass connection-tabs"
				style={{
					padding: "8px",
					display: "flex",
					gap: "8px",
					alignItems: "center",
					maxWidth: "420px",
				}}
			>
				<button
					type="button"
					onClick={() => setActiveView("apikey")}
					className="connection-tab-btn"
					style={{
						flex: 1,
						opacity: activeView === "apikey" ? 1 : 0.65,
						background: activeView === "apikey" ? "var(--accent)" : "rgba(255,255,255,0.06)",
						color: activeView === "apikey" ? "#fff" : "var(--text-dim)",
					}}
				>
					Clave API
				</button>
				<button
					type="button"
					onClick={() => setActiveView("mcp")}
					className="connection-tab-btn"
					style={{
						flex: 1,
						opacity: activeView === "mcp" ? 1 : 0.65,
						background: activeView === "mcp" ? "var(--accent)" : "rgba(255,255,255,0.06)",
						color: activeView === "mcp" ? "#fff" : "var(--text-dim)",
					}}
				>
					MCP
				</button>
				<button
					type="button"
					onClick={() => setActiveView("ngrok")}
					className="connection-tab-btn"
					style={{
						flex: 1,
						opacity: activeView === "ngrok" ? 1 : 0.65,
						background: activeView === "ngrok" ? "var(--accent)" : "rgba(255,255,255,0.06)",
						color: activeView === "ngrok" ? "#fff" : "var(--text-dim)",
					}}
				>
					Ngrok
				</button>
			</div>

			{activeView === "apikey" && (
				<div className="connection-single-col">
					<div className="kpi-card connection-card">
						<span className="kpi-label">Clave API</span>
						<p style={{ fontSize: "12px", color: "var(--text-dim)", marginBottom: "12px" }}>
							Esta clave se usa para autenticar este dashboard contra el backend.
						</p>

						<div style={{ position: "relative", marginBottom: "10px" }}>
							<input
								type={showKey ? "text" : "password"}
								value={apiKeyInput}
								onChange={(e) => setApiKeyInput(e.target.value)}
								placeholder="Ingresa clave API"
								className="pin-input"
								style={{
									textAlign: "left",
									fontSize: "14px",
									letterSpacing: "0.4px",
									paddingRight: "46px",
								}}
							/>
							<button
								type="button"
								onClick={() => setShowKey((v) => !v)}
								style={{
									position: "absolute",
									right: "12px",
									top: "50%",
									transform: "translateY(-50%)",
									background: "transparent",
									border: "none",
									cursor: "pointer",
									color: "var(--text-muted)",
								}}
							>
								{showKey ? <EyeOff size={16} /> : <Eye size={16} />}
							</button>
						</div>

						<label
							style={{
								display: "flex",
								alignItems: "center",
								gap: "8px",
								fontSize: "12px",
								color: "var(--text-dim)",
								marginBottom: "14px",
							}}
						>
							<input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
							Recordar clave API en esta estacion
						</label>

						<button
							type="button"
							onClick={handleSave}
							disabled={saving}
							className="connection-main-btn"
							style={{ width: "100%", justifyContent: "center", display: "flex", gap: "8px" }}
						>
							<Save size={14} /> {saving ? "Validando..." : "Guardar y validar"}
						</button>
					</div>
				</div>
			)}

			{activeView === "mcp" && (
				<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
					<div
						className="kpi-card connection-card"
						style={{ borderColor: mcpAuthEnabled ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.25)" }}
					>
						<span className="kpi-label">MCP</span>
						<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
							{mcpAuthEnabled ? (
								<ShieldCheck size={16} color="var(--success)" />
							) : (
								<ShieldAlert size={16} color="var(--warning)" />
							)}
							<span
								className="kpi-value"
								style={{
									fontSize: "18px",
									color: mcpAuthEnabled ? "var(--success)" : "var(--warning)",
								}}
							>
								{mcpAuthEnabled ? "AUTENTICACION ACTIVA" : "AUTENTICACION DESACTIVADA"}
							</span>
						</div>
						<p style={{ fontSize: "12px", color: "var(--text-dim)", marginBottom: "8px" }}>
							Controla si el puente MCP exige clave API para /sse, /messages y herramientas.
						</p>
						<button
							type="button"
							onClick={handleToggleMcp}
							disabled={mcpUpdating}
							className="connection-main-btn"
							style={{ width: "100%", justifyContent: "center", display: "flex", gap: "8px" }}
						>
							<PlugZap size={14} />{" "}
							{mcpUpdating
								? "Actualizando..."
								: mcpAuthEnabled
									? "Deshabilitar autenticacion MCP"
									: "Habilitar autenticacion MCP"}
						</button>

						<div
							style={{
								marginTop: "12px",
								fontFamily: "var(--font-mono)",
								fontSize: "11px",
								color: "var(--text-muted)",
								display: "flex",
								flexDirection: "column",
								gap: "4px",
							}}
						>
							<span>SSE: {mcpSseUrl}</span>
							<span>Messages: {mcpMessagesUrl}</span>
						</div>
					</div>

					<div className="card-glass" style={{ padding: "16px" }}>
						<div className="flex-between" style={{ marginBottom: "12px" }}>
							<h3 style={{ fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase" }}>
								Acciones MCP
							</h3>
							<button
								type="button"
								onClick={loadMcpActions}
								className="btn-icon"
								title="Actualizar acciones"
							>
								<PlugZap size={14} />
							</button>
						</div>

						{mcpActionsLoading ? (
							<p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Cargando acciones MCP...</p>
						) : mcpActions.length === 0 ? (
							<p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
								No hay acciones MCP registradas o la autenticacion MCP esta deshabilitada.
							</p>
						) : (
							<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
								{mcpActions.map((action) => {
									const translated = toSpanishAction(action);
									return (
										<div
											key={action.name}
											style={{
												display: "flex",
												justifyContent: "space-between",
												gap: "12px",
												alignItems: "center",
												padding: "10px 12px",
												border: "1px solid var(--border-light)",
												borderRadius: "8px",
												background: "rgba(255,255,255,0.02)",
											}}
										>
											<div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
												<span
													style={{
														fontSize: "12px",
														fontFamily: "var(--font-mono)",
														color: "var(--text-main)",
													}}
												>
													{translated.title}
												</span>
												<span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
													{translated.description}
												</span>
											</div>
											<button
												type="button"
												onClick={() => handleToggleMcpAction(action)}
												disabled={mcpActionSaving === action.name}
												style={{
													background: action.enabled
														? "rgba(16,185,129,0.15)"
														: "rgba(239,68,68,0.15)",
													border: `1px solid ${action.enabled ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
													color: action.enabled ? "var(--success)" : "var(--error)",
													borderRadius: "8px",
													padding: "6px 10px",
													fontSize: "11px",
													fontWeight: 700,
													cursor: "pointer",
													minWidth: "86px",
												}}
											>
												{mcpActionSaving === action.name
													? "..."
													: action.enabled
														? "ACTIVA"
														: "BLOQUEADA"}
											</button>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>
			)}

			{activeView === "ngrok" && (
				<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
					<div
						className="kpi-card connection-card"
						style={{ borderColor: ngrokRunning ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.12)" }}
					>
						<span className="kpi-label">Ngrok</span>
						<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
							<PlugZap size={16} color={ngrokRunning ? "var(--success)" : "var(--text-dim)"} />
							<span
								className="kpi-value"
								style={{ fontSize: "18px", color: ngrokRunning ? "var(--success)" : "var(--text-dim)" }}
							>
								{ngrokRunning ? "ACTIVO" : "LOCAL"}
							</span>
						</div>

						<div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
							<button
								type="button"
								onClick={handleToggleNgrok}
								disabled={ngrokLoading}
								className="connection-main-btn"
								style={{ display: "flex", gap: "8px", alignItems: "center" }}
							>
								<Power size={14} />{" "}
								{ngrokLoading ? "Procesando..." : ngrokRunning ? "Detener" : "Iniciar"}
							</button>
							<button
								type="button"
								onClick={handleRestartNgrok}
								disabled={ngrokLoading}
								className="connection-main-btn"
								style={{
									display: "flex",
									gap: "8px",
									alignItems: "center",
									background: "rgba(255,255,255,0.08)",
									borderColor: "var(--border)",
								}}
							>
								<RefreshCw size={14} className={ngrokLoading ? "animate-spin" : ""} /> Reiniciar
							</button>
							<button
								type="button"
								onClick={loadNgrokStatus}
								disabled={ngrokLoading}
								className="connection-main-btn"
								style={{
									display: "flex",
									gap: "8px",
									alignItems: "center",
									background: "rgba(255,255,255,0.08)",
									borderColor: "var(--border)",
								}}
							>
								<RefreshCw size={14} /> Refrescar
							</button>
						</div>

						<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<span
								style={{
									fontSize: "11px",
									color: "var(--text-muted)",
									fontFamily: "var(--font-mono)",
									flex: 1,
								}}
							>
								URL publica: {ngrokUrl || "No disponible"}
							</span>
							<button
								type="button"
								onClick={copyNgrokUrl}
								disabled={!ngrokUrl}
								className="btn-icon"
								title="Copiar URL"
							>
								{copiedUrl ? <Check size={14} /> : <Copy size={14} />}
							</button>
						</div>
					</div>

					<div className="card-glass" style={{ padding: "16px" }}>
						<h3
							style={{
								fontSize: "12px",
								letterSpacing: "1px",
								textTransform: "uppercase",
								marginBottom: "10px",
							}}
						>
							Configuracion ngrok
						</h3>
						{ngrokConfigLoading ? (
							<p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Cargando configuracion...</p>
						) : !ngrokConfig ? (
							<p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
								No hay datos de configuracion.
							</p>
						) : (
							<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
								<div
									style={{
										display: "grid",
										gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
										gap: "10px",
									}}
								>
									<div
										style={{
											border: "1px solid var(--border-light)",
											borderRadius: "8px",
											padding: "10px",
										}}
									>
										<p
											style={{
												fontSize: "10px",
												color: "var(--text-muted)",
												marginBottom: "4px",
											}}
										>
											Contenedor
										</p>
										<p style={{ fontSize: "12px", fontFamily: "var(--font-mono)" }}>
											{ngrokConfig.containerName}
										</p>
									</div>
									<div
										style={{
											border: "1px solid var(--border-light)",
											borderRadius: "8px",
											padding: "10px",
										}}
									>
										<p
											style={{
												fontSize: "10px",
												color: "var(--text-muted)",
												marginBottom: "4px",
											}}
										>
											Target
										</p>
										<p style={{ fontSize: "12px", fontFamily: "var(--font-mono)" }}>
											{ngrokConfig.targetService}:{ngrokConfig.targetPort}
										</p>
									</div>
									<div
										style={{
											border: "1px solid var(--border-light)",
											borderRadius: "8px",
											padding: "10px",
										}}
									>
										<p
											style={{
												fontSize: "10px",
												color: "var(--text-muted)",
												marginBottom: "4px",
											}}
										>
											Authtoken
										</p>
										<p
											style={{
												fontSize: "12px",
												color: ngrokConfig.authtokenConfigured
													? "var(--success)"
													: "var(--warning)",
											}}
										>
											{ngrokConfig.authtokenConfigured ? "Configurado" : "No configurado"}
										</p>
									</div>
									<div
										style={{
											border: "1px solid var(--border-light)",
											borderRadius: "8px",
											padding: "10px",
										}}
									>
										<p
											style={{
												fontSize: "10px",
												color: "var(--text-muted)",
												marginBottom: "4px",
											}}
										>
											Dashboard API
										</p>
										<p style={{ fontSize: "11px", fontFamily: "var(--font-mono)" }}>
											{ngrokConfig.dashboardApiUrl}
										</p>
									</div>
								</div>

								<div style={{ marginTop: "2px", display: "flex", flexDirection: "column", gap: "8px" }}>
									<p style={{ fontSize: "11px", color: "var(--text-dim)" }}>
										Authtoken ngrok (se aplica desde el frontend al contenedor)
									</p>
									<div style={{ position: "relative" }}>
										<input
											type={showNgrokToken ? "text" : "password"}
											value={ngrokTokenInput}
											onChange={(e) => setNgrokTokenInput(e.target.value)}
											placeholder="Pega tu authtoken de ngrok"
											className="pin-input"
											style={{ textAlign: "left", fontSize: "13px", paddingRight: "44px" }}
										/>
										<button
											type="button"
											onClick={() => setShowNgrokToken((v) => !v)}
											className="btn-icon"
											style={{
												position: "absolute",
												right: "8px",
												top: "50%",
												transform: "translateY(-50%)",
											}}
											title={showNgrokToken ? "Ocultar token" : "Mostrar token"}
										>
											{showNgrokToken ? <EyeOff size={14} /> : <Eye size={14} />}
										</button>
									</div>
									<button
										type="button"
										onClick={handleSaveNgrokToken}
										disabled={ngrokTokenSaving}
										className="connection-main-btn"
										style={{
											width: "fit-content",
											display: "flex",
											gap: "8px",
											alignItems: "center",
										}}
									>
										<Save size={14} /> {ngrokTokenSaving ? "Guardando..." : "Guardar authtoken"}
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{message && (
				<div
					className="card-glass"
					style={{
						padding: "12px 16px",
						fontSize: "12px",
						color: message.toLowerCase().includes("no se pudo") ? "var(--error)" : "var(--success)",
					}}
				>
					{message}
				</div>
			)}
		</div>
	);
};
