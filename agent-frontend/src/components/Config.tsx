import { useEffect, useState } from "react";
import { useWs } from "../contexts/WebSocketContext";

interface GeneralConfig {
	model?: string;
	system_prompt?: string;
	temperature?: number;
	history_limit?: number;
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

const labelStyle: React.CSSProperties = {
	fontSize: "11px",
	fontWeight: 600,
	color: "var(--text-muted)",
	display: "block",
	marginBottom: "4px",
	textTransform: "uppercase",
	letterSpacing: "0.5px",
};

const btnStyle: React.CSSProperties = {
	padding: "8px 20px",
	borderRadius: "6px",
	border: "1px solid rgba(79,140,255,0.2)",
	background: "rgba(79,140,255,0.15)",
	color: "var(--accent)",
	cursor: "pointer",
	fontSize: "12px",
	fontWeight: 600,
	fontFamily: "inherit",
};

export const Config: React.FC = () => {
	const { connected, send: sendWs, subscribe } = useWs();
	const [config, setConfig] = useState<GeneralConfig | null>(null);
	const [ollamaModels, setOllamaModels] = useState<string[]>([]);
	const [model, setModel] = useState("");
	const [systemPrompt, setSystemPrompt] = useState("");
	const [temperature, setTemperature] = useState(0.7);
	const [historyLimit, setHistoryLimit] = useState(10);
	const [saving, setSaving] = useState(false);
	const [dirty, setDirty] = useState(false);

	useEffect(() => {
		return subscribe((msg) => {
			switch (msg.type) {
				case "general_config": {
					const gc = msg.payload as GeneralConfig;
					setConfig(gc);
					setModel(gc.model || "");
					setSystemPrompt(gc.system_prompt || "");
					setTemperature(gc.temperature ?? 0.7);
					setHistoryLimit(gc.history_limit ?? 10);
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
			sendWs("list_ollama_models", {});
		}
	}, [connected, sendWs]);

	const handleSave = () => {
		setSaving(true);
		sendWs("general_config_update", {
			model: model || undefined,
			system_prompt: systemPrompt || undefined,
			temperature,
			history_limit: historyLimit,
		});
		setDirty(false);
		setTimeout(() => setSaving(false), 1000);
	};

	return (
		<div>
			<div style={sectionCard}>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
					<div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>
						Configuración General
					</div>
					<button
						type="button"
						onClick={handleSave}
						disabled={saving || !dirty}
						style={{
							...btnStyle,
							opacity: (saving || !dirty) ? 0.5 : 1,
							cursor: (saving || !dirty) ? "not-allowed" : "pointer",
						}}
					>
						{saving ? "Guardando..." : dirty ? "Guardar cambios" : "Guardado"}
					</button>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
					<div>
						<label style={labelStyle}>Modelo</label>
						<select
							value={model}
							onChange={(e) => { setModel(e.target.value); setDirty(true); }}
							style={inputStyle}
						>
							<option value="">Seleccionar modelo...</option>
							{ollamaModels.map((m) => (
								<option key={m} value={m}>{m}</option>
							))}
						</select>
					</div>

					<div>
						<label style={labelStyle}>System Prompt</label>
						<textarea
							value={systemPrompt}
							onChange={(e) => { setSystemPrompt(e.target.value); setDirty(true); }}
							rows={6}
							placeholder="Eres un asistente útil..."
							style={{
								...inputStyle,
								resize: "vertical",
								lineHeight: "1.5",
							}}
						/>
					</div>

					<div>
						<label style={labelStyle}>
							Temperatura: <span style={{ color: "var(--accent)", fontWeight: 700 }}>{temperature.toFixed(1)}</span>
						</label>
						<input
							type="range"
							min="0"
							max="2"
							step="0.1"
							value={temperature}
							onChange={(e) => { setTemperature(parseFloat(e.target.value)); setDirty(true); }}
							style={{ width: "100%", accentColor: "var(--accent)" }}
						/>
						<div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)" }}>
							<span>Preciso (0)</span>
							<span>Creativo (2)</span>
						</div>
					</div>

					<div>
						<label style={labelStyle}>History Limit</label>
						<input
							type="number"
							min={1}
							max={100}
							value={historyLimit}
							onChange={(e) => { setHistoryLimit(parseInt(e.target.value, 10) || 10); setDirty(true); }}
							style={inputStyle}
						/>
						<div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "4px" }}>
							Número de mensajes del historial enviados en cada solicitud.
						</div>
					</div>
				</div>
			</div>

			{config && (
				<div style={{ ...sectionCard, fontSize: "11px", color: "var(--text-dim)" }}>
					<strong>Actual:</strong> Modelo="{config.model || "(default)"}", Temperatura={config.temperature ?? 0.7},
					History={config.history_limit ?? 10}
				</div>
			)}
		</div>
	);
};
