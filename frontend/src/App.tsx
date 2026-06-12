import { Activity, Cable, Cpu, Eye, EyeOff, Layers, RefreshCw, Shield, Terminal } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { BrainConsole } from "./components/BrainConsole";
import { ChatPlayground } from "./components/ChatPlayground";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { GpuSentinel } from "./components/HardwareSentinel";
import { IpLogs } from "./components/IpLogs";
import { ModelList } from "./components/ModelList";
import { SecurityPanel } from "./components/SecurityPanel";
import { Telemetry } from "./components/Telemetry";
import {
	api,
	clearApiKey,
	getStoredApiKey,
	persistApiKey,
	removePersistedApiKey,
	setApiKey as setApiClientKey,
} from "./services/api.service";
import { subscribeToNewAccess, subscribeToPullProgress, subscribeToSecurityAlerts } from "./services/socket.service";
import type { AccessLogEntry, OllamaModel, PullProgressData, StatusResponse } from "./types/api";

const App: React.FC = () => {
	const [apiKey, setApiKey] = useState("");
	const [apiKeyInput, setApiKeyInput] = useState(""); // Estado separado para el input
	const [isAuthorized, setIsAuthorized] = useState(false);
	const [status, setStatus] = useState<StatusResponse | undefined>(undefined);
	const [models, setModels] = useState<OllamaModel[]>([]);
	const [pullProgress, setPullProgress] = useState<Record<string, PullProgressData>>({});
	const [loading, setLoading] = useState(false);
	const [authError, setAuthError] = useState("");
	const [isAuthenticating, setIsAuthenticating] = useState(false);

	const fetchData = useCallback(async () => {
		if (!apiKey) return;
		try {
			// Use fast status for frequent polling
			const [statusRes, modelsRes] = await Promise.all([api.get("/api/status/fast"), api.get("/api/models")]);
			setStatus(statusRes.data);
			setModels(modelsRes.data.models || []);
			setIsAuthorized(true);
		} catch (err) {
			setIsAuthorized(false);
			console.error("Auth failed", err);
		}
	}, [apiKey]);

	useEffect(() => {
		// Si ya tenemos una API Key vÁlida (cargada por localStorage o auth), suscribimos sockets
		if (!isAuthorized || !apiKey) return;

		const cleanupAccess = (data: AccessLogEntry) => {
			setStatus((prevStatus: StatusResponse | null) => {
				if (!prevStatus) return prevStatus;
				// Evitar duplicados considerando IP, Acción y Timestamp exacto
				const isDuplicate = prevStatus.recentLogs?.some(
					(l: AccessLogEntry) =>
						l.timestamp === data.timestamp && l.ip === data.ip && l.action === data.action
				);
				if (isDuplicate) return prevStatus;

				const newLogs = [data, ...(prevStatus.recentLogs || [])].slice(0, 100);
				return { ...prevStatus, recentLogs: newLogs };
			});
		};

		const cleanupPull = subscribeToPullProgress((data) => {
			if (data.status === "done") {
				// Descarga completada — limpiar progreso y refrescar lista de modelos
				setPullProgress((prev) => {
					const next = { ...prev };
					delete next[data.model];
					return next;
				});
				fetchData();
			} else {
				setPullProgress((prev) => ({
					...prev,
					[data.model]: data,
				}));
			}
		});
		const cleanupAlerts = subscribeToSecurityAlerts((data) => {
			if (data.type === "ban") fetchData(); // Solo refrescar en caso de baneo
		});
		const subAccess = subscribeToNewAccess(cleanupAccess);

		return () => {
			cleanupPull();
			cleanupAlerts();
			subAccess();
		};
	}, [apiKey, fetchData, isAuthorized]);

	const handleSendMessage = async (
		model: string,
		content: string,
		options: Record<string, unknown> & { stream?: boolean }
	) => {
		const useStream = options.stream !== false; // Default to streaming
		const apiKey = getStoredApiKey();

		if (useStream) {
			// Streaming mode using SSE/fetch
			let fullContent = "";
			let promptTokens = 0;
			let completionTokens = 0;

			const response = await fetch(
				`${import.meta.env.VITE_API_URL || "http://localhost:3016"}/v1/chat/completions`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-api-key": apiKey,
					},
					body: JSON.stringify({
						model,
						messages: [{ role: "user", content }],
						stream: true,
						...options,
					}),
				}
			);

			if (!response.body) throw new Error("No response body");

			const reader = response.body.getReader();
			const decoder = new TextDecoder();

			// Return a stream object that ChatPlayground can consume
			return {
				isStream: true,
				stream: (async function* () {
					try {
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;

							const chunk = decoder.decode(value);
							const lines = chunk.split("\n");

							for (const line of lines) {
								if (!line.startsWith("data: ") || line === "data: [DONE]") continue;

								const jsonStr = line.slice(6); // Remove "data: " prefix
								try {
									const data = JSON.parse(jsonStr);
									if (data.choices?.[0]?.delta?.content) {
										fullContent += data.choices[0].delta.content;
										yield {
											content: data.choices[0].delta.content,
											full_content: fullContent,
										};
									}
									if (data.usage) {
										promptTokens = data.usage.prompt_tokens || 0;
										completionTokens = data.usage.completion_tokens || 0;
									}
								} catch (_e : any) {
									// ignore JSON parse errors
								}
							}
						}
					} finally {
						reader.releaseLock();
					}
				})(),
				content: fullContent,
				message: { content: fullContent },
				prompt_eval_count: promptTokens,
				eval_count: completionTokens,
			};
		} else {
			// Non-streaming mode (fallback)
			const res = await api.post("/v1/chat/completions", {
				model,
				messages: [{ role: "user", content }],
				stream: false,
				...options,
			});

			return {
				isStream: false,
				content: res.data?.choices?.[0]?.message?.content || "",
				message: res.data?.choices?.[0]?.message,
				prompt_eval_count: res.data?.usage?.prompt_tokens || 0,
				eval_count: res.data?.usage?.completion_tokens || 0,
			};
		}
	};

	const handleBan = async (ip: string) => {
		await api.post("/api/ban", { ip });
		fetchData();
	};

	const handleUnban = async (ip: string) => {
		await api.post("/api/unban", { ip });
		fetchData();
	};

	const handleOllamaControl = async (action: "start" | "stop" | "restart") => {
		try {
			await api.post(`/api/ollama/${action}`, {});
			// Dar un pequeño delay para que el contenedor reaccione antes de refrescar
			setTimeout(fetchData, 2000);
		} catch (e) {
			console.error(`Error with Ollama ${action}:`, e);
		}
	};

	const handlePanic = async () => {
		await api.post("/api/unload", {});
		fetchData();
	};

	const handleCleanWorkspace = async () => {
		try {
			setLoading(true);
			const res = await api.post("/api/clean", {});
			alert(`¡Limpieza completada! Se han liberado ${res.data.freed.toFixed(2)} GB de archivos temporales.`);
			fetchData();
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Error desconocido";
			alert(`Error al limpiar workspace: ${message}`);
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteModel = async (name: string) => {
		if (
			!window.confirm(
				`¿Estás seguro de que quieres eliminar el modelo ${name}? Esta acción no se puede deshacer.`
			)
		) {
			return;
		}

		try {
			setLoading(true);
			await api.delete(`/api/models/${name}`);
			fetchData();
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Error desconocido";
			alert(`Error al eliminar el modelo: ${message}`);
		} finally {
			setLoading(false);
		}
	};

	const handlePull = async (model: string) => {
		try {
			setPullProgress((prev) => ({
				...prev,
				[model]: { model, percent: 0, status: "pulling" },
			}));
			await api.post("/api/pull", { model });
		} catch (e: unknown) {
			setPullProgress((prev) => {
				const next = { ...prev };
				delete next[model];
				return next;
			});
			const errorMsg =
				e instanceof Error
					? e.message
					: (e as { response?: { data?: { error?: string } } }).response?.data?.error ||
						"Error al iniciar descarga";
			alert(errorMsg);
		}
	};

	const handleUpdateApiKey = async (nextKey: string, remember: boolean) => {
		const trimmed = nextKey.trim();
		if (!trimmed) {
			throw new Error("La API Key no puede estar vacia");
		}

		const previousKey = apiKey;
		setApiClientKey(trimmed);

		try {
			const [statusRes, modelsRes] = await Promise.all([api.get("/api/status/fast"), api.get("/api/models")]);
			setStatus(statusRes.data);
			setModels(modelsRes.data.models || []);
			setApiKey(trimmed);
			setApiKeyInput(trimmed);
			setRememberKey(remember);
			if (remember) {
				persistApiKey(trimmed);
			} else {
				removePersistedApiKey();
			}
		} catch (err: unknown) {
			setApiClientKey(previousKey);
			const errObj = err as { response?: { data?: { error?: string } }; message?: string };
			throw new Error(errObj?.response?.data?.error || errObj?.message || "No se pudo validar la API Key");
		}
	};

	const handleToggleMcpAuth = async (enabled: boolean) => {
		const res = await api.post("/api/auth/mcp", { enabled });
		setStatus((prev) => ({
			...(prev || {}),
			auth: {
				...(prev?.auth || {}),
				ollamaAuthEnabled: res.data?.ollamaAuthEnabled,
				mcpAuthEnabled: res.data?.mcpAuthEnabled,
			},
		}));
	};

	const [activeTab, setActiveTab] = useState("dashboard");

	const [showKey, setShowKey] = useState(false);
	const [rememberKey, setRememberKey] = useState(true);

	// Cargar key recordada al inicio
	useEffect(() => {
		const saved = getStoredApiKey();
		if (saved) {
			setApiKeyInput(saved);
			setApiKey(saved);
			// Aquí podrías disparar fetchData automáticamente o dejar que el usuario pulse entrar
		}
	}, []);

	// Disparar fetchData cuando la apiKey real cambie y mantener un heartbeat de 60s para telemetría
	useEffect(() => {
		if (apiKey) {
			setApiClientKey(apiKey);
			fetchData();
			const interval = setInterval(fetchData, 60000); // Reduced from 15s to 60s
			return () => clearInterval(interval);
		}
		clearApiKey();
	}, [apiKey, fetchData]);

	const handleAuth = async (e?: React.FormEvent) => {
		e?.preventDefault();
		const keyToUse = apiKeyInput.trim();
		if (!keyToUse) return;

		setIsAuthenticating(true);
		setAuthError("");

		try {
			setApiClientKey(keyToUse);
			const [statusRes, modelsRes] = await Promise.all([api.get("/api/status"), api.get("/api/models")]);
			setStatus(statusRes.data);
			setModels(modelsRes.data.models || []);
			setIsAuthorized(true);
			setApiKey(keyToUse);
			if (rememberKey) {
				persistApiKey(keyToUse);
			} else {
				removePersistedApiKey();
			}
		} catch (err: unknown) {
			clearApiKey();
			setIsAuthorized(false);
			const errObj = err as { response?: { status?: number } };
			let errorMsg = "Error de conexión con el servidor MCP";
			if (errObj.response?.status === 401) errorMsg = "Acceso denegado: PIN incorrecto o inválido";
			if (errObj.response?.status === 403)
				errorMsg = "Acceso denegado: IP bloqueada temporalmente temporalmente por seguridad";
			setAuthError(errorMsg);
		} finally {
			setIsAuthenticating(false);
		}
	};

	if (!isAuthorized) {
		return (
			<div className="login-container">
				<div className="login-card">
					<div className="login-avatar">
						<img src="/logo.png" alt="User" />
					</div>
					<div className="login-title">
						<h2>Acceso Restringido</h2>
						<p>Master Session Key • LaLlamaOllama</p>
					</div>

					<form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", width: "100%" }}>
						<div
							className="pin-group"
							style={{ position: "relative", marginBottom: authError ? "16px" : "32px" }}
						>
							<input
								type={showKey ? "text" : "password"}
								placeholder="••••••••"
								value={apiKeyInput}
								onChange={(e) => {
									setApiKeyInput(e.target.value);
									setAuthError("");
								}}
								className={`pin-input ${authError ? "error" : ""}`}
								style={
									authError
										? { borderColor: "var(--error)", backgroundColor: "rgba(239,68,68,0.05)" }
										: {}
								}
							/>
							<button
								type="button"
								onClick={() => setShowKey(!showKey)}
								style={{
									position: "absolute",
									right: "16px",
									top: "50%",
									transform: "translateY(-50%)",
									background: "none",
									border: "none",
									color: "var(--text-muted)",
									cursor: "pointer",
								}}
							>
								{showKey ? <EyeOff size={20} /> : <Eye size={20} />}
							</button>
						</div>

						{authError && (
							<div
								style={{
									color: "var(--error)",
									fontSize: "13px",
									marginBottom: "24px",
									fontWeight: 600,
								}}
							>
								{authError}
							</div>
						)}

						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "8px",
								marginBottom: "24px",
								justifyContent: "center",
							}}
						>
							<div className="custom-checkbox">
								<input
									type="checkbox"
									id="remember"
									checked={rememberKey}
									onChange={(e) => setRememberKey(e.target.checked)}
								/>
								<span className="checkmark"></span>
							</div>
							<label
								htmlFor="remember"
								style={{
									fontSize: "13px",
									color: "var(--text-dim)",
									cursor: "pointer",
									userSelect: "none",
								}}
							>
								Recordar Master Key en esta estación
							</label>
						</div>

						<button
							type="submit"
							disabled={isAuthenticating}
							className="auth-btn"
							style={{ position: "relative", opacity: isAuthenticating ? 0.7 : 1 }}
						>
							{isAuthenticating ? (
								<RefreshCw
									size={20}
									className="animate-spin"
									style={{ margin: "0 auto", display: "block" }}
								/>
							) : (
								"Sincronizar Escudo"
							)}
						</button>
					</form>

					<div
						style={{
							marginTop: "32px",
							opacity: 0.6,
							fontSize: "12px",
							fontWeight: 600,
							letterSpacing: "1px",
							color: "var(--text-muted)",
						}}
					>
						ARGENTEIA CORE V5 • AMBIENTE PROTEGIDO
					</div>
				</div>
			</div>
		);
	}

	const getSectionInfo = () => {
		switch (activeTab) {
			case "dashboard":
				return { title: "DASHBOARD", sub: "Sistema Operando en Tiempo Real" };
			case "playground":
				return { title: "PLAYGROUND", sub: "Terminal de Inferencia Directa" };
			case "models":
				return { title: "REPOSITORIO DE MODELOS", sub: "Gestiona tu Arsenal de LLMs Locales" };
			case "security":
				return { title: "CENTRO DE SEGURIDAD", sub: `${status?.recentLogs?.length || 0} Sesiones Registradas` };
			case "hardware":
				return { title: "GPU SENTINEL", sub: "Monitor de GPU, VRAM y configuración de rendimiento" };
			case "cerebro":
				return { title: "CEREBRO MCP", sub: "Conocimiento, decisiones y contexto de los agentes IA" };
			case "coneccion":
				return { title: "CONECCION", sub: "Configura API Key local y puente MCP" };
			default:
				return { title: activeTab.toUpperCase(), sub: "" };
		}
	};

	const renderContent = () => {
		switch (activeTab) {
			case "dashboard":
				return (
					<>
						<Telemetry status={status} onOllamaControl={handleOllamaControl} onRefresh={fetchData} />
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "minmax(0, 2fr) 300px",
								gap: "24px",
								alignItems: "start",
								marginTop: "8px",
							}}
						>
							{/* Accesos Recientes */}
							<div className="card-glass" style={{ padding: "24px" }}>
								<h3
									style={{
										fontSize: "11px",
										fontWeight: 700,
										letterSpacing: "2px",
										color: "var(--text-muted)",
										marginBottom: "20px",
										textTransform: "uppercase",
									}}
								>
									Últimos Accesos al Perímetro
								</h3>
								{(status?.recentLogs?.length || 0) === 0 ? (
									<p style={{ fontSize: "13px", opacity: 0.2, textAlign: "center", padding: "24px" }}>
										Sin actividad registrada
									</p>
								) : (
									<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
										{(status?.recentLogs || []).slice(0, 8).map((log: AccessLogEntry) => (
											<div
												key={`log-${log.timestamp}-${log.ip}`}
												style={{
													display: "flex",
													alignItems: "center",
													gap: "12px",
													padding: "10px 14px",
													background: "rgba(255,255,255,0.02)",
													border: "1px solid var(--border-light)",
													borderRadius: "8px",
												}}
											>
												<div
													style={{
														width: "7px",
														height: "7px",
														borderRadius: "50%",
														flexShrink: 0,
														background:
															log.status === "Success"
																? "var(--success)"
																: "var(--error)",
													}}
												/>
												<span
													style={{
														fontFamily: "var(--font-mono)",
														fontSize: "11px",
														color: "var(--accent)",
														minWidth: "130px",
													}}
												>
													{log.ip}
												</span>
												<span style={{ fontSize: "11px", color: "var(--text-dim)", flex: 1 }}>
													{log.action || "system_call"}
												</span>
												<span
													style={{
														fontSize: "10px",
														fontWeight: 700,
														padding: "2px 8px",
														borderRadius: "4px",
														background:
															log.status === "Success"
																? "rgba(16,185,129,0.15)"
																: "rgba(239,68,68,0.15)",
														color:
															log.status === "Success"
																? "var(--success)"
																: "var(--error)",
													}}
												>
													{log.status}
												</span>
											</div>
										))}
									</div>
								)}
							</div>

							{/* Panel lateral: Modelos + Estado Seguridad */}
							<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
								<div className="card-glass" style={{ padding: "20px" }}>
									<h3
										style={{
											fontSize: "11px",
											fontWeight: 700,
											letterSpacing: "1.5px",
											color: "var(--text-muted)",
											marginBottom: "16px",
											textTransform: "uppercase",
										}}
									>
										Modelos Disponibles
									</h3>
									{(models?.length || 0) === 0 ? (
										<p
											style={{
												fontSize: "12px",
												opacity: 0.3,
												textAlign: "center",
												padding: "16px",
											}}
										>
											No hay modelos instalados
										</p>
									) : (
										(models || []).slice(0, 5).map((m: OllamaModel) => (
											<div
												key={m?.name || `model-${m.name}`}
												style={{
													display: "flex",
													justifyContent: "space-between",
													alignItems: "center",
													padding: "8px 0",
													borderBottom: "1px solid var(--border-light)",
												}}
											>
												<span style={{ fontSize: "12px" }}>{m?.name || "N/A"}</span>
												<span
													style={{
														fontSize: "10px",
														color: "var(--accent)",
														fontWeight: 700,
													}}
												>
													{m?.size ? `${(m.size / 1024 ** 3).toFixed(1)}GB` : "-"}
												</span>
											</div>
										))
									)}
								</div>

								<div className="card-glass" style={{ padding: "20px" }}>
									<h3
										style={{
											fontSize: "11px",
											fontWeight: 700,
											letterSpacing: "1.5px",
											color: "var(--text-muted)",
											marginBottom: "16px",
											textTransform: "uppercase",
										}}
									>
										IPs Bloqueadas
									</h3>
									{(status?.blacklistedIps?.length || 0) === 0 ? (
										<p
											style={{
												fontSize: "12px",
												opacity: 0.3,
												textAlign: "center",
												padding: "12px",
											}}
										>
											Perímetro Limpio ✓
										</p>
									) : (
										(status?.blacklistedIps || []).map((ip: string) => (
											<div
												key={ip}
												style={{
													display: "flex",
													justifyContent: "space-between",
													alignItems: "center",
													padding: "6px 0",
												}}
											>
												<span
													style={{
														fontFamily: "var(--font-mono)",
														fontSize: "11px",
														color: "var(--error)",
													}}
												>
													{ip}
												</span>
												<button
													type="button"
													onClick={() => handleUnban(ip)}
													style={{
														fontSize: "10px",
														padding: "2px 8px",
														background: "rgba(239,68,68,0.1)",
														border: "1px solid rgba(239,68,68,0.2)",
														borderRadius: "4px",
														color: "var(--error)",
														cursor: "pointer",
													}}
												>
													UNBAN
												</button>
											</div>
										))
									)}
								</div>
							</div>
						</div>
					</>
				);
			case "models":
				return (
					<ModelList
						models={models}
						pullProgress={pullProgress}
						onPull={handlePull}
						onDelete={handleDeleteModel}
					/>
				);
			case "security":
				return (
					<div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
						<SecurityPanel
							blacklistedIps={status?.blacklistedIps || []}
							onUnban={handleUnban}
							onPanic={handlePanic}
						/>
						<IpLogs logs={status?.recentLogs} status={status} onBan={handleBan} />
					</div>
				);
			case "playground":
				return (
					<div
						className="card-glass"
						style={{
							padding: "0",
							overflow: "hidden",
							display: "flex",
							flexDirection: "column",
							height: "calc(100vh - 160px)",
						}}
					>
						<div style={{ flex: 1, padding: "16px", overflow: "hidden" }}>
							<ChatPlayground models={models} onSendMessage={handleSendMessage} />
						</div>
					</div>
				);
			case "hardware":
				return <GpuSentinel status={status} />;
			case "cerebro":
				return <BrainConsole />;
			case "coneccion":
				return (
					<ConnectionPanel
						status={status}
						apiKeyValue={apiKey}
						rememberKey={rememberKey}
						onSaveApiKey={handleUpdateApiKey}
						onToggleMcpAuth={handleToggleMcpAuth}
					/>
				);
			default:
				return null;
		}
	};

	return (
		<div className="app-layout">
			{/* Sidebar - ARGenteIA Style */}
			<aside className="sidebar">
				<div className="sidebar-header">
					<div className="logo-wrap">
						<div className="logo-icon">
							<img src="/logo.png" alt="Logo" />
						</div>
						<span className="logo-text">LaLlamaOllama</span>
					</div>
				</div>

				<nav className="sidebar-nav scrollbar-hide">
					<div className="nav-section">
						<div className="section-header">
							<span className="section-title">Navegación</span>
						</div>
						<div className="experts-list">
							<button
								type="button"
								className={`expert-item-wrap ${activeTab === "dashboard" ? "active" : ""}`}
								onClick={() => setActiveTab("dashboard")}
							>
								<div className="expert-avatar">
									<Activity size={16} />
								</div>
								<div className="expert-info">
									<span className="expert-name">Dashboard</span>
									<span className="expert-model">Control de Sistema</span>
								</div>
							</button>

							<button
								type="button"
								className={`expert-item-wrap ${activeTab === "playground" ? "active" : ""}`}
								onClick={() => setActiveTab("playground")}
							>
								<div className="expert-avatar">
									<Terminal size={16} />
								</div>
								<div className="expert-info">
									<span className="expert-name">Playground</span>
									<span className="expert-model">Inferencia Directa</span>
								</div>
							</button>

							<button
								type="button"
								className={`expert-item-wrap ${activeTab === "cerebro" ? "active" : ""}`}
								onClick={() => setActiveTab("cerebro")}
							>
								<div className="expert-avatar" style={{ color: "var(--accent)" }}>
									<svg
										aria-label="Cerebro"
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
										<path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
										<path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
										<path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
									</svg>
								</div>
								<div className="expert-info">
									<span className="expert-name">Cerebro MCP</span>
									<span className="expert-model">Base de Conocimiento</span>
								</div>
							</button>


						</div>
					</div>

					<div className="nav-section">
						<div className="section-header">
							<span className="section-title">Opciones Rapidas</span>
						</div>
						<div className="commands-grid">
							<button type="button" className="cmd-pill" onClick={() => setActiveTab("models")}>
								<Layers size={14} /> Modelos
							</button>
							<button type="button" className="cmd-pill" onClick={() => setActiveTab("coneccion")}>
								<Cable size={14} /> Coneccion
							</button>
							<button type="button" className="cmd-pill" onClick={() => setActiveTab("security")}>
								<Shield size={14} /> Seguridad
							</button>
							<button type="button" className="cmd-pill" onClick={() => setActiveTab("hardware")}>
								<Cpu size={14} /> GPU Sentinel
							</button>
						</div>
					</div>

					<div className="nav-section" style={{ marginTop: "auto" }}>
						<div className="section-header">
							<span className="section-title">Mantenimiento</span>
						</div>
						<div className="experts-list">
							<button type="button" className="expert-item-wrap" onClick={handleCleanWorkspace}>
								<div className="expert-avatar" style={{ color: "var(--text-muted)" }}>
									<RefreshCw size={16} />
								</div>
								<div className="expert-info">
									<span className="expert-name">Limpiar Cache</span>
									<span className="expert-model">Archivos Temporales</span>
								</div>
							</button>
						</div>
					</div>
				</nav>

				<div className="sidebar-footer">
					<div
						className="model-badge"
						style={{
							marginBottom: "12px",
							background: "rgba(79, 140, 255, 0.05)",
							padding: "12px",
							borderRadius: "8px",
							border: "1px solid var(--border)",
						}}
					>
						<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
							<Cpu size={12} style={{ color: "var(--accent)" }} />
							<span style={{ fontSize: "11px", fontWeight: 600 }}>MOTOR OLLAMA</span>
							<div
						className="status-badge"
						style={{ marginTop: "8px", padding: "0 4px", display: "flex", alignItems: "center" }}
					>
						<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<div className={`status-led ${status?.ollamaRunning ? "online" : "offline"}`} />
							<span
								style={{
									fontWeight: 600,
									color: status?.ollamaRunning ? "var(--text-main)" : "var(--text-muted)",
								}}
							>
								{status?.ollamaRunning ? "Conectado" : "Sin conexión"}
							</span>
						</div>
					</div>
						</div>
						<div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
							{models?.length || 0} Modelos Disponibles
						</div>
					</div>
					
				</div>
			</aside>

			{/* Main Content Area */}
			<div className="view-area">
				<header className="view-header">
					<div className="header-info">
						<h2>{getSectionInfo().title}</h2>
						<p>{getSectionInfo().sub}</p>
					</div>

					<div className="flex-between gap-md">
						<button type="button" onClick={fetchData} className="btn-icon" title="Refrescar Estado">
							<RefreshCw size={20} className={loading ? "animate-spin" : ""} />
						</button>
					</div>
				</header>

				<div className="view-body">{renderContent()}</div>
			</div>
		</div>
	);
};

export default App;
