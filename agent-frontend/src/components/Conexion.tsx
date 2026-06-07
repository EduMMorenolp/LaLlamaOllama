import { Cable, Cpu, HardDrive, Monitor, Plus, Radio, Save, Send, Trash2, Wifi, WifiOff } from "lucide-react";
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
								{dockerInfo.inDocker ? "\u{1F4E6} Docker" : "\u{1F4BB} Host"}
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
