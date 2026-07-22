import { Cable, Cpu, HardDrive, Monitor, Plus, Radio, Save, Send, Trash2, Wifi, WifiOff, LogIn, LogOut, CheckCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { config } from "../config";
import { useWs } from "../contexts/WebSocketContext";

interface ModelEntry {
	name: string;
	displayName?: string;
	apiKey?: string;
	baseUrl?: string;
}

interface DockerInfo {
	inDocker: boolean;
	containerName: string;
	cpuCores: number;
	memoryTotalBytes: number;
	memoryLimitBytes: number;
	gpuAvailable: boolean;
	gpuInfo: string;
	diskTotalBytes: number;
	diskFreeBytes: number;
	platform: string;
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return "?";
	const gb = bytes / 1024 / 1024 / 1024;
	return `${gb.toFixed(1)} GB`;
}

export const Conexion: React.FC = () => {
	const { connected, send: sendWs, subscribe } = useWs();

	// Models
	const [models, setModels] = useState<ModelEntry[]>([]);
	const [showModelForm, setShowModelForm] = useState(false);
	const [newModel, setNewModel] = useState<ModelEntry>({ name: "", displayName: "", apiKey: "", baseUrl: "" });

	// Docker
	const [dockerInfo, setDockerInfo] = useState<DockerInfo | null>(null);

	// Telegram
	const [telegramRunning, setTelegramRunning] = useState(false);
	const [telegramToken, setTelegramToken] = useState("");
	const [telegramTokenPreview, setTelegramTokenPreview] = useState<string | null>(null);
	const [telegramAllowedUsers, setTelegramAllowedUsers] = useState("");
	const [telegramSaving, setTelegramSaving] = useState(false);

	// Google
	const [googleConnected, setGoogleConnected] = useState(false);
	const [googleConfigured, setGoogleConfigured] = useState(false);
	const [googleLoading, setGoogleLoading] = useState(false);
	const [googleEmail, setGoogleEmail] = useState<string | null>(null);

	useEffect(() => {
		checkGoogleStatus();
	}, []);

	const checkGoogleStatus = async () => {
		try {
			const res = await fetch(`${config.engineUrl}/api/google/status`, {
				headers: { "x-api-key": config.apiKey },
			});
			const data = await res.json();
			setGoogleConnected(data.connected);
			setGoogleConfigured(data.configured);
		} catch {
			setGoogleConfigured(false);
			setGoogleConnected(false);
		}
	};

	const handleGoogleConnect = () => {
		if (!config.googleClientId) {
			alert("VITE_GOOGLE_CLIENT_ID no está configurado en el .env del frontend.");
			return;
		}
		setGoogleLoading(true);
		// PKCE flow: generate code_verifier + code_challenge
		const generateCodeVerifier = () => {
			const array = new Uint8Array(32);
			crypto.getRandomValues(array);
			return btoa(String.fromCharCode(...array))
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=+$/, "");
		};
		const sha256 = async (plain: string) => {
			const encoder = new TextEncoder();
			const data = encoder.encode(plain);
			const hash = await crypto.subtle.digest("SHA-256", data);
			return btoa(String.fromCharCode(...new Uint8Array(hash)))
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=+$/, "");
		};

		(async () => {
			const verifier = generateCodeVerifier();
			const challenge = await sha256(verifier);
			sessionStorage.setItem("google_code_verifier", verifier);

			const redirectUri = `${window.location.origin}/google/callback`;
			const scope = [
				"https://www.googleapis.com/auth/calendar",
				"https://www.googleapis.com/auth/calendar.events",
				"https://www.googleapis.com/auth/gmail.modify",
				"https://www.googleapis.com/auth/drive",
				"https://www.googleapis.com/auth/documents",
				"https://www.googleapis.com/auth/spreadsheets",
				"https://www.googleapis.com/auth/presentations",
				"https://www.googleapis.com/auth/tasks",
				"https://www.googleapis.com/auth/contacts",
			].join(" ");

			const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&code_challenge_method=S256&code_challenge=${challenge}&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

			window.location.href = authUrl;
		})();
	};

	const handleGoogleDisconnect = async () => {
		if (!confirm("Desconectar Google? Esto revocará el acceso.")) return;
		setGoogleLoading(true);
		try {
			await fetch(`${config.engineUrl}/api/google/revoke`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": config.apiKey,
				},
				body: JSON.stringify({ user_id: "default" }),
			});
			setGoogleConnected(false);
			setGoogleEmail(null);
		} catch (err) {
			console.error("Failed to disconnect Google:", err);
		} finally {
			setGoogleLoading(false);
		}
	};

	// Subscribe to WS messages
	useEffect(() => {
		return subscribe((msg) => {
			if (msg.type === "list_models") {
				const list = msg.payload?.models as ModelEntry[];
				if (list) setModels(list);
			}
			if (msg.type === "docker_info") {
				const info = msg.payload?.dockerInfo as DockerInfo | null;
				setDockerInfo(info);
			}
			if (msg.type === "telegram_status") {
				const active = msg.payload?.active === true || msg.payload?.running === true;
				setTelegramRunning(active);
				const users = msg.payload?.allowedUsers as string[] | undefined;
				if (users) setTelegramAllowedUsers(users.join(", "));
				const preview = msg.payload?.tokenPreview as string | undefined;
				// Show preview only; never override user-typed token
				setTelegramTokenPreview(preview || null);
			}
			if (msg.type === "status") {
				if (msg.payload?.telegramActive !== undefined) {
					setTelegramRunning(msg.payload.telegramActive === true);
				}
			}
		});
	}, [subscribe]);

	// Fetch data when connected
	useEffect(() => {
		if (connected) {
			sendWs("list_models", {});
			sendWs("get_docker_info", {});
			sendWs("telegram_get_status", {});
		}
	}, [connected, sendWs]);

	const handleSaveModel = () => {
		if (!newModel.name.trim()) return;
		sendWs("model_update", {
			action: "upsert",
			modelConfig: {
				name: newModel.name.trim(),
				displayName: newModel.displayName || undefined,
				apiKey: newModel.apiKey || undefined,
				baseUrl: newModel.baseUrl || undefined,
			},
		});
		setNewModel({ name: "", displayName: "", apiKey: "", baseUrl: "" });
		setShowModelForm(false);
	};

	const handleDeleteModel = (name: string) => {
		sendWs("model_update", { action: "delete", name });
	};

	// ─── Telegram handlers ────────────────────────────────────────────────
	const handleTelegramSave = () => {
		setTelegramSaving(true);
		const users = telegramAllowedUsers
			.split(",")
			.map((u) => u.trim())
			.filter(Boolean);
		// Send user-typed token, or empty string to keep existing backend token
		const token = telegramToken.trim();
		sendWs("telegram_update", {
			enabled: telegramRunning,
			botToken: token || undefined, // undefined = keep existing
			allowedUsers: users,
		});
		setTimeout(() => {
			setTelegramSaving(false);
			setTelegramToken(""); // clear field so preview shows again
			sendWs("telegram_get_status", {});
		}, 1500);
	};

	const handleTelegramToggle = () => {
		if (telegramRunning) {
			// Stop
			setTelegramSaving(true);
			sendWs("telegram_update", { enabled: false, botToken: undefined, allowedUsers: [] });
			setTimeout(() => {
				setTelegramRunning(false);
				setTelegramSaving(false);
				sendWs("telegram_get_status", {});
			}, 1000);
		} else {
			// Start — token is required (either user-typed or existing on backend)
			if (!telegramToken.trim() && !telegramTokenPreview) return;
			handleTelegramSave();
		}
	};

	return (
		<div style={{ maxWidth: "700px", margin: "0 auto" }}>
			{/* Connection Status */}
			<div style={sectionCard}>
				<label style={sectionTitle}>
					<Cable size={14} style={{ marginRight: "6px" }} />
					Estado de Conexi&oacute;n
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
					{connected ? (
						<>
							<Wifi size={16} style={{ color: "var(--success)" }} /> Conectado al Agent Engine
						</>
					) : (
						<>
							<WifiOff size={16} style={{ color: "var(--error)" }} /> Desconectado
						</>
					)}
				</div>
				<div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px" }}>
					WebSocket: {config.wsUrl}
				</div>
			</div>

			{/* Docker / Container Info */}
			<div style={sectionCard}>
				<label style={sectionTitle}>
					<Monitor size={14} style={{ marginRight: "6px" }} />
					Informaci&oacute;n del Contenedor
				</label>
				{dockerInfo ? (
					<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
						{/* Environment badge */}
						<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<span
								style={{
									padding: "3px 10px",
									borderRadius: "4px",
									fontSize: "10px",
									fontWeight: 700,
									background: dockerInfo.inDocker ? "rgba(79,140,255,0.15)" : "rgba(34,197,94,0.15)",
									color: dockerInfo.inDocker ? "var(--accent)" : "var(--success)",
									border: `1px solid ${dockerInfo.inDocker ? "rgba(79,140,255,0.3)" : "rgba(34,197,94,0.3)"}`,
								}}
							>
								{dockerInfo.inDocker ? "📦 Docker" : "💻 Host"}
							</span>
							<span style={{ fontSize: "11px", color: "var(--text-dim)", fontFamily: "monospace" }}>
								{dockerInfo.containerName}
							</span>
						</div>

						{/* Resource grid */}
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
							{/* CPU */}
							<div
								style={{
									padding: "10px",
									borderRadius: "6px",
									background: "rgba(255,255,255,0.03)",
									border: "1px solid var(--border-light)",
								}}
							>
								<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
									<Cpu size={14} style={{ color: "var(--accent)" }} />
									<span
										style={{
											fontSize: "10px",
											fontWeight: 600,
											color: "var(--text-muted)",
											textTransform: "uppercase",
										}}
									>
										CPU
									</span>
								</div>
								<span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>
									{dockerInfo.cpuCores}
								</span>
								<span style={{ fontSize: "11px", color: "var(--text-dim)", marginLeft: "4px" }}>
									n&uacute;cleos
								</span>
							</div>

							{/* RAM */}
							<div
								style={{
									padding: "10px",
									borderRadius: "6px",
									background: "rgba(255,255,255,0.03)",
									border: "1px solid var(--border-light)",
								}}
							>
								<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
									<Radio size={14} style={{ color: "var(--accent)" }} />
									<span
										style={{
											fontSize: "10px",
											fontWeight: 600,
											color: "var(--text-muted)",
											textTransform: "uppercase",
										}}
									>
										RAM
									</span>
								</div>
								<span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>
									{formatBytes(
										dockerInfo.memoryLimitBytes > 0
											? dockerInfo.memoryLimitBytes
											: dockerInfo.memoryTotalBytes
									)}
								</span>
								{dockerInfo.memoryLimitBytes > 0 && (
									<span style={{ fontSize: "10px", color: "var(--text-dim)", display: "block" }}>
										Host: {formatBytes(dockerInfo.memoryTotalBytes)}
									</span>
								)}
							</div>

							{/* GPU */}
							<div
								style={{
									padding: "10px",
									borderRadius: "6px",
									background: dockerInfo.gpuAvailable
										? "rgba(34,197,94,0.05)"
										: "rgba(255,255,255,0.03)",
									border: `1px solid ${dockerInfo.gpuAvailable ? "rgba(34,197,94,0.2)" : "var(--border-light)"}`,
								}}
							>
								<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
									<Monitor
										size={14}
										style={{
											color: dockerInfo.gpuAvailable ? "var(--success)" : "var(--text-muted)",
										}}
									/>
									<span
										style={{
											fontSize: "10px",
											fontWeight: 600,
											color: "var(--text-muted)",
											textTransform: "uppercase",
										}}
									>
										GPU
									</span>
								</div>
								<span
									style={{
										fontSize: "13px",
										fontWeight: 600,
										color: dockerInfo.gpuAvailable ? "var(--success)" : "var(--text-dim)",
									}}
								>
									{dockerInfo.gpuAvailable ? dockerInfo.gpuInfo : "No disponible"}
								</span>
							</div>

							{/* Disk */}
							<div
								style={{
									padding: "10px",
									borderRadius: "6px",
									background: "rgba(255,255,255,0.03)",
									border: "1px solid var(--border-light)",
								}}
							>
								<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
									<HardDrive size={14} style={{ color: "var(--accent)" }} />
									<span
										style={{
											fontSize: "10px",
											fontWeight: 600,
											color: "var(--text-muted)",
											textTransform: "uppercase",
										}}
									>
										Disco
									</span>
								</div>
								{dockerInfo.diskTotalBytes > 0 ? (
									<>
										<span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>
											{formatBytes(dockerInfo.diskFreeBytes)}
										</span>
										<span style={{ fontSize: "11px", color: "var(--text-dim)", marginLeft: "4px" }}>
											libres / {formatBytes(dockerInfo.diskTotalBytes)}
										</span>
									</>
								) : (
									<span style={{ fontSize: "12px", color: "var(--text-dim)" }}>No detectado</span>
								)}
							</div>
						</div>

						{/* Platform */}
						<div
							style={{ fontSize: "10px", color: "var(--text-dim)", textAlign: "center", padding: "4px" }}
						>
							Plataforma: {dockerInfo.platform}
						</div>
					</div>
				) : (
					<div style={{ fontSize: "12px", color: "var(--text-dim)", padding: "12px 0" }}>
						Cargando informaci&oacute;n del contenedor...
					</div>
				)}
			</div>

			{/* Models */}
			<div style={sectionCard}>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginBottom: "12px",
					}}
				>
					<label style={{ ...sectionTitle, marginBottom: 0 }}>Proveedores de Modelos ({models.length})</label>
					<button
						type="button"
						onClick={() => setShowModelForm(!showModelForm)}
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
						<Plus size={12} /> Agregar
					</button>
				</div>

				{showModelForm && (
					<div
						style={{
							padding: "12px",
							marginBottom: "12px",
							background: "rgba(79,140,255,0.05)",
							borderRadius: "6px",
							border: "1px solid rgba(79,140,255,0.15)",
						}}
					>
						<input
							type="text"
							value={newModel.name}
							onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
							placeholder="Nombre del modelo (ej: gpt-4)"
							style={{ ...inputStyle, marginBottom: "8px" }}
						/>
						<input
							type="text"
							value={newModel.displayName || ""}
							onChange={(e) => setNewModel({ ...newModel, displayName: e.target.value })}
							placeholder="Nombre visible (opcional)"
							style={{ ...inputStyle, marginBottom: "8px" }}
						/>
						<input
							type="text"
							value={newModel.baseUrl || ""}
							onChange={(e) => setNewModel({ ...newModel, baseUrl: e.target.value })}
							placeholder="Base URL (ej: https://api.openai.com/v1)"
							style={{ ...inputStyle, marginBottom: "8px" }}
						/>
						<input
							type="password"
							value={newModel.apiKey || ""}
							onChange={(e) => setNewModel({ ...newModel, apiKey: e.target.value })}
							placeholder="API Key (opcional)"
							style={{ ...inputStyle, marginBottom: "8px" }}
						/>
						<button type="button" onClick={handleSaveModel} style={actionBtnStyle}>
							<Save size={14} style={{ marginRight: "4px" }} /> Guardar Modelo
						</button>
					</div>
				)}

				{models.length === 0 ? (
					<div style={{ fontSize: "12px", color: "var(--text-dim)", padding: "8px 0" }}>
						Sin proveedores configurados. Usa el modelo por defecto del Agent Engine.
					</div>
				) : (
					models.map((m) => (
						<div
							key={m.name}
							style={{
								display: "flex",
								alignItems: "center",
								gap: "8px",
								padding: "8px 0",
								borderBottom: "1px solid var(--border-light)",
							}}
						>
							<div style={{ flex: 1 }}>
								<div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)" }}>
									{m.name}
								</div>
								{m.displayName && (
									<div style={{ fontSize: "10px", color: "var(--text-dim)" }}>{m.displayName}</div>
								)}
								{m.baseUrl && (
									<div
										style={{ fontSize: "9px", color: "var(--text-muted)", fontFamily: "monospace" }}
									>
										{m.baseUrl}
									</div>
								)}
							</div>
							<button
								type="button"
								onClick={() => handleDeleteModel(m.name)}
								style={{
									background: "none",
									border: "none",
									color: "var(--error)",
									cursor: "pointer",
									opacity: 0.5,
									padding: "4px",
								}}
							>
								<Trash2 size={12} />
							</button>
						</div>
					))
				)}
			</div>

			{/* Telegram Bot */}
			<div style={sectionCard}>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginBottom: "12px",
					}}
				>
					<label style={{ ...sectionTitle, marginBottom: 0 }}>
						<Send size={14} style={{ marginRight: "6px" }} />
						Telegram Bot
					</label>
					<span
						style={{
							padding: "3px 10px",
							borderRadius: "4px",
							fontSize: "10px",
							fontWeight: 700,
							background: telegramRunning
								? "rgba(34,197,94,0.15)"
								: "rgba(255,255,255,0.03)",
							color: telegramRunning ? "var(--success)" : "var(--text-dim)",
							border: `1px solid ${telegramRunning ? "rgba(34,197,94,0.3)" : "var(--border-light)"}`,
						}}
					>
						{telegramRunning ? "Activo" : "Inactivo"}
					</span>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
					{/* Token input */}
					<div>
						<label
							style={{
								fontSize: "10px",
								fontWeight: 600,
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "4px",
								textTransform: "uppercase",
								letterSpacing: "0.5px",
							}}
						>
							Token del Bot
						</label>
						<input
							type="password"
							value={telegramToken}
							onChange={(e) => setTelegramToken(e.target.value)}
							placeholder={telegramTokenPreview || "123456:ABCdefGHIjklmNOPqrSTUvwXYZ"}
							style={inputStyle}
						/>
						{telegramTokenPreview && !telegramToken && (
							<div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "4px" }}>
								Token configurado: {telegramTokenPreview}
							</div>
						)}
					</div>

					{/* Allowed users input */}
					<div>
						<label
							style={{
								fontSize: "10px",
								fontWeight: 600,
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "4px",
								textTransform: "uppercase",
								letterSpacing: "0.5px",
							}}
						>
							Usuarios Permitidos
						</label>
						<input
							type="text"
							value={telegramAllowedUsers}
							onChange={(e) => setTelegramAllowedUsers(e.target.value)}
							placeholder="usuario1, usuario2, @usuario3"
							style={inputStyle}
						/>
						<div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "4px" }}>
							Nombres de usuario de Telegram separados por coma.
						</div>
					</div>

					{/* Actions */}
					<div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
						<button
							type="button"
							onClick={handleTelegramToggle}
							disabled={telegramSaving || (!telegramRunning && !telegramToken.trim())}
							style={{
								...actionBtnStyle,
								flex: 1,
								justifyContent: "center",
								background: telegramRunning
									? "rgba(239,68,68,0.1)"
									: "rgba(34,197,94,0.1)",
								border: telegramRunning
									? "1px solid rgba(239,68,68,0.2)"
									: "1px solid rgba(34,197,94,0.2)",
								color: telegramRunning ? "var(--error)" : "var(--success)",
								opacity: telegramSaving || (!telegramRunning && !telegramToken.trim()) ? 0.5 : 1,
								cursor:
									telegramSaving || (!telegramRunning && !telegramToken.trim())
										? "not-allowed"
										: "pointer",
							}}
						>
							{telegramSaving
								? "Guardando..."
								: telegramRunning
									? "Detener Bot"
									: "Iniciar Bot"}
						</button>
						{telegramRunning && (
							<button
								type="button"
								onClick={handleTelegramSave}
								disabled={telegramSaving}
								style={{
									...actionBtnStyle,
									padding: "10px 16px",
									opacity: telegramSaving ? 0.5 : 1,
									cursor: telegramSaving ? "not-allowed" : "pointer",
								}}
							>
								<Save size={14} style={{ marginRight: "4px" }} /> Actualizar
							</button>
						)}
					</div>
				</div>

				{/* Info note */}
				<div
					style={{
						fontSize: "10px",
						color: "var(--text-dim)",
						marginTop: "12px",
						padding: "8px",
						borderRadius: "4px",
						background: "rgba(255,255,255,0.02)",
						border: "1px solid var(--border-light)",
						lineHeight: "1.5",
					}}
				>
					El bot de Telegram permite interactuar con el Agent Engine desde Telegram.
					Usá <code style={{ fontSize: "10px", background: "rgba(255,255,255,0.05)", padding: "1px 4px", borderRadius: "3px" }}>/ayuda</code> para ver los comandos disponibles.
				</div>
			</div>

			{/* Google Workspace */}
			<div style={sectionCard}>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginBottom: "12px",
					}}
				>
					<label style={{ ...sectionTitle, marginBottom: 0 }}>
						<svg width="14" height="14" viewBox="0 0 24 24" style={{ marginRight: "6px", verticalAlign: "middle" }}>
							<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
							<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
							<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
							<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
						</svg>
						Google Workspace
					</label>
					{googleConfigured && (
						<span
							style={{
								padding: "3px 10px",
								borderRadius: "4px",
								fontSize: "10px",
								fontWeight: 700,
								background: googleConnected
									? "rgba(34,197,94,0.15)"
									: "rgba(255,255,255,0.03)",
								color: googleConnected ? "var(--success)" : "var(--text-dim)",
								border: `1px solid ${googleConnected ? "rgba(34,197,94,0.3)" : "var(--border-light)"}`,
							}}
						>
							{googleConnected ? "Conectado" : "Desconectado"}
						</span>
					)}
				</div>

				{!googleConfigured ? (
					<div
						style={{
							fontSize: "11px",
							color: "var(--text-dim)",
							padding: "8px 12px",
							borderRadius: "4px",
							background: "rgba(255,255,255,0.02)",
							border: "1px solid var(--border-light)",
						}}
					>
						Google OAuth no configurado. Establecé <code style={{ fontSize: "10px", background: "rgba(255,255,255,0.05)", padding: "1px 4px", borderRadius: "3px" }}>GOOGLE_CLIENT_ID</code> y <code style={{ fontSize: "10px", background: "rgba(255,255,255,0.05)", padding: "1px 4px", borderRadius: "3px" }}>GOOGLE_CLIENT_SECRET</code> en el .env del Agent Engine, y <code style={{ fontSize: "10px", background: "rgba(255,255,255,0.05)", padding: "1px 4px", borderRadius: "3px" }}>VITE_GOOGLE_CLIENT_ID</code> en el frontend.
					</div>
				) : (
					<>
						{googleConnected && googleEmail && (
							<div style={{ fontSize: "12px", color: "var(--text-main)", marginBottom: "12px" }}>
								Conectado como: <strong>{googleEmail}</strong>
							</div>
						)}
						<div style={{ display: "flex", gap: "8px" }}>
							{googleConnected ? (
								<button
									type="button"
									onClick={handleGoogleDisconnect}
									disabled={googleLoading}
									style={{
										...actionBtnStyle,
										flex: 1,
										justifyContent: "center",
										background: "rgba(239,68,68,0.1)",
										border: "1px solid rgba(239,68,68,0.2)",
										color: "var(--error)",
										opacity: googleLoading ? 0.5 : 1,
										cursor: googleLoading ? "not-allowed" : "pointer",
									}}
								>
									<LogOut size={14} style={{ marginRight: "4px" }} />
									{googleLoading ? "Desconectando..." : "Desconectar Google"}
								</button>
							) : (
								<button
									type="button"
									onClick={handleGoogleConnect}
									disabled={googleLoading}
									style={{
										...actionBtnStyle,
										flex: 1,
										justifyContent: "center",
										opacity: googleLoading ? 0.5 : 1,
										cursor: googleLoading ? "not-allowed" : "pointer",
									}}
								>
									<LogIn size={14} style={{ marginRight: "4px" }} />
									{googleLoading ? "Conectando..." : "Conectar Google"}
								</button>
							)}
						</div>

						<div
							style={{
								fontSize: "10px",
								color: "var(--text-dim)",
								marginTop: "12px",
								padding: "8px",
								borderRadius: "4px",
								background: "rgba(255,255,255,0.02)",
								border: "1px solid var(--border-light)",
								lineHeight: "1.5",
							}}
						>
							Al conectar Google, el agente podrá acceder a: Calendar, Gmail, Drive, Docs, Sheets, Slides, Tasks y Contactos.
							{!googleConnected && (
								<span style={{ display: "block", marginTop: "4px", color: "var(--text-muted)" }}>
									Serás redirigido a Google para autorizar el acceso.
								</span>
							)}
						</div>
					</>
				)}
			</div>

			{/* MCP Brain */}
			<div style={sectionCard}>
				<label style={sectionTitle}>MCP Brain</label>
				<div style={{ fontSize: "12px", color: "var(--text-main)", marginBottom: "4px" }}>
					URL: {config.brainUrl}
				</div>
				<div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
					El Agent Engine se conecta al MCP Brain para memoria persistente y b&uacute;squeda sem&aacute;ntica.
				</div>
			</div>
		</div>
	);
};

const sectionCard: React.CSSProperties = {
	padding: "16px",
	borderRadius: "8px",
	background: "rgba(255,255,255,0.02)",
	border: "1px solid var(--border-light)",
	marginBottom: "16px",
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

const inputStyle: React.CSSProperties = {
	flex: 1,
	padding: "10px 14px",
	background: "rgba(255,255,255,0.03)",
	border: "1px solid var(--border-light)",
	borderRadius: "8px",
	color: "var(--text-main)",
	fontSize: "13px",
	fontFamily: "inherit",
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
