import {
	AlertTriangle,
	CheckCircle,
	Cpu,
	Power,
	RefreshCw,
	Save,
	SlidersHorizontal,
	Thermometer,
	Timer,
	XCircle,
	Zap,
} from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import { api } from "../services/api.service";

const AUTO_UNLOAD_OPTIONS = [
	{ label: "Nunca", value: 0 },
	{ label: "5 min", value: 5 },
	{ label: "15 min", value: 15 },
	{ label: "30 min", value: 30 },
	{ label: "1 hora", value: 60 },
	{ label: "2 horas", value: 120 },
];

const QUANT_OPTIONS = [
	{ label: "Q4_K_M — Rápido, liviano, muy buena calidad", value: "q4_k_m", vramFactor: 0.4 },
	{ label: "Q5_K_M — Equilibrio ideal precisión/velocidad", value: "q5_k_m", vramFactor: 0.5 },
	{ label: "Q8_0 — Alta precisión, más pesado", value: "q8_0", vramFactor: 0.8 },
	{ label: "F16 — Precisión completa (16-bit float)", value: "f16", vramFactor: 1.0 },
];

import type { LoadedModel, StatusResponse } from "../types/api";

interface GpuSentinelProps {
	status?: StatusResponse;
}

function GaugeRing({
	value,
	max,
	color,
	label,
	unit,
}: {
	value: number;
	max: number;
	color: string;
	label: string;
	unit: string;
}) {
	const pct = Math.min(value / max, 1);
	const r = 36;
	const circ = 2 * Math.PI * r;
	const dash = pct * circ;
	return (
		<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
			<svg aria-label="Gauge" width="100" height="100" viewBox="0 0 100 100">
				<circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
				<circle
					cx="50"
					cy="50"
					r={r}
					fill="none"
					stroke={color}
					strokeWidth="8"
					strokeDasharray={`${dash} ${circ}`}
					strokeLinecap="round"
					transform="rotate(-90 50 50)"
					style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dasharray 0.5s ease" }}
				/>
				<text x="50" y="46" textAnchor="middle" fill="white" fontSize="14" fontWeight="800" fontFamily="monospace">
					{value.toFixed(value < 10 ? 1 : 0)}
				</text>
				<text x="50" y="60" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9">{unit}</text>
			</svg>
			<span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1px" }}>
				{label}
			</span>
		</div>
	);
}

function VramBadge({
	modelSizeBytes,
	vram,
}: {
	modelSizeBytes: number;
	vram?: { free?: number; used?: number; total?: number; available?: number };
}) {
	if (!vram?.available || !modelSizeBytes) return null;
	const modelMb = modelSizeBytes / (1024 * 1024);
	const vramFreeMb = (vram.free as number) || 0;

	let color = "var(--success)";
	let bg = "rgba(16,185,129,0.1)";
	let border = "rgba(16,185,129,0.3)";
	let icon = "🟢";
	let label = "Óptimo";
	let desc = "Corre 100% en GPU";

	if (modelMb > vramFreeMb * 0.8 && modelMb <= vramFreeMb) {
		color = "#f59e0b";
		bg = "rgba(245,158,11,0.1)";
		border = "rgba(245,158,11,0.3)";
		icon = "🟡";
		label = "Ajustado";
		desc = "Cerca del límite de VRAM";
	} else if (modelMb > vramFreeMb) {
		color = "var(--error)";
		bg = "rgba(239,68,68,0.1)";
		border = "rgba(239,68,68,0.3)";
		icon = "🔴";
		label = "Híbrido (CPU)";
		desc = "Irá más lento (offload a RAM)";
	}

	return (
		<span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "4px", background: bg, border: `1px solid ${border}`, color }}>
			{icon} {label} — {desc}
		</span>
	);
}

export const GpuSentinel: React.FC<GpuSentinelProps> = ({ status }) => {
	const [autoUnload, setAutoUnload] = useState<number>(status?.autoUnloadMinutes ?? 0);
	const [numCtx, setNumCtx] = useState<number>(status?.globalNumCtx ?? 4096);
	const [selectedQuant, setSelectedQuant] = useState("q4_k_m");
	const [saving, setSaving] = useState(false);
	const [savedMsg, setSavedMsg] = useState("");

	const vram = status?.vram;
	const loadedModels = status?.loadedModels || [];
	const gpu = status?.gpu || {};

	const vramUsedPct = vram?.available ? Math.round((vram.used / vram.total) * 100) : 0;

	const tempColor = (gpu.temperature || 0) > 85 ? "#ef4444" : (gpu.temperature || 0) > 70 ? "#f59e0b" : "#10b981";
	const powerColor = (gpu.powerDraw || 0) > 150 ? "#f59e0b" : "#4f8cff";

	const saveSettings = useCallback(async () => {
		setSaving(true);
		try {
			await Promise.all([
				api.post("/api/hardware/auto-unload", { minutes: autoUnload }),
				api.post("/api/hardware/num-ctx", { numCtx }),
			]);
			setSavedMsg("✓ Configuración guardada");
			setTimeout(() => setSavedMsg(""), 3000);
		} catch (_e: unknown) {
			setSavedMsg("✗ Error al guardar");
		} finally {
			setSaving(false);
		}
	}, [autoUnload, numCtx]);

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
			{/* ── GPU en Tiempo Real ─────────────────────────────── */}
			<div className="card-glass p-8 animate-fade">
				<div className="flex-between" style={{ marginBottom: "24px" }}>
					<h2 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
						<Cpu size={22} style={{ color: "var(--accent)" }} />
						GPU en Tiempo Real
					</h2>
				</div>

				{!gpu.vram?.available ? (
					<div style={{ padding: "20px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "12px", display: "flex", gap: "12px", alignItems: "center" }}>
						<AlertTriangle size={18} style={{ color: "#f59e0b", flexShrink: 0 }} />
						<div>
							<p style={{ fontWeight: 700, color: "#f59e0b", fontSize: "13px" }}>
								nvidia-smi no detectado
							</p>
							<p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
								Modo CPU-only. Las métricas de GPU, temperatura y consumo no están disponibles.
							</p>
						</div>
					</div>
				) : (
					<div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: "16px" }}>
						<GaugeRing value={gpu.powerDraw || 0} max={300} color={powerColor} label="Consumo" unit="W" />
						<GaugeRing value={gpu.temperature || 0} max={100} color={tempColor} label="Temperatura" unit="°C" />
						<GaugeRing value={gpu.fanSpeed || 0} max={100} color="#818cf8" label="Fan Speed" unit="%" />
						<GaugeRing value={gpu.gpuUtil || 0} max={100} color="var(--accent)" label="GPU Util" unit="%" />
						<GaugeRing value={gpu.vram?.used || 0} max={gpu.vram?.total || 1} color="#10b981" label="VRAM Uso" unit="MB" />
					</div>
				)}

				{(gpu.temperature || 0) >= 80 && (
					<div style={{ marginTop: "16px", padding: "12px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", display: "flex", gap: "8px", alignItems: "center" }}>
						<AlertTriangle size={16} style={{ color: "var(--error)" }} />
						<span style={{ fontSize: "12px", color: "var(--error)", fontWeight: 700 }}>
							{(gpu.temperature || 0) >= 90
								? `CRÍTICO: ${gpu.temperature}°C — Unload automático activado`
								: `AVISO: ${gpu.temperature}°C — Cerca del límite. Considera reducir la carga.`}
						</span>
					</div>
				)}
			</div>

			{/* ── VRAM Monitor ──────────────────────────────────── */}
			<div className="card-glass p-8 animate-fade">
				<h2 style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
					<Thermometer size={22} style={{ color: "var(--accent)" }} />
					Monitor de GPU / VRAM
				</h2>

				{!vram?.available ? (
					<div style={{ padding: "24px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
						<AlertTriangle size={20} style={{ color: "#f59e0b", flexShrink: 0 }} />
						<div>
							<p style={{ fontSize: "13px", fontWeight: 700, color: "#f59e0b" }}>
								nvidia-smi no detectado
							</p>
							<p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", lineHeight: "1.5" }}>
								Ollama está en modo CPU-only o en macOS (Metal). Los modelos se ejecutan en RAM del sistema.
								<br />
								Para GPU real, asegurate que nvidia-smi esté accesible dentro del contenedor.
							</p>
						</div>
					</div>
				) : (
					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "24px" }}>
						{[
							{ label: "VRAM Total", value: `${vram.total} MB`, color: "var(--text-main)" },
							{ label: "VRAM Usada", value: `${vram.used} MB`, color: vramUsedPct > 80 ? "var(--error)" : "#f59e0b" },
							{ label: "VRAM Libre", value: `${vram.free} MB`, color: "var(--success)" },
						].map((kpi) => (
							<div key={kpi.label} style={{ padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", borderRadius: "10px", textAlign: "center" }}>
								<p style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>{kpi.label}</p>
								<p style={{ fontSize: "20px", fontWeight: 800, fontFamily: "var(--font-mono)", color: kpi.color }}>{kpi.value}</p>
							</div>
						))}
					</div>
				)}

				{vram?.available && (
					<>
						<div style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
							<span>Uso de VRAM</span>
							<span style={{ color: vramUsedPct > 80 ? "var(--error)" : "var(--text-main)", fontWeight: 700 }}>{vramUsedPct}%</span>
						</div>
						<div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "10px", overflow: "hidden", marginBottom: "8px" }}>
							<div style={{ height: "100%", borderRadius: "10px", transition: "width 0.5s ease", width: `${vramUsedPct}%`, background: vramUsedPct > 90 ? "var(--error)" : vramUsedPct > 70 ? "#f59e0b" : "var(--accent)", boxShadow: vramUsedPct > 90 ? "0 0 15px var(--error)" : undefined }} />
						</div>
					</>
				)}

				{loadedModels.length > 0 && (
					<div style={{ marginTop: "16px" }}>
						<p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "1px" }}>
							Cargado en VRAM ahora
						</p>
						{loadedModels.map((m: LoadedModel, idx: number) => (
							<div key={String(m.name) || String(idx)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: "rgba(79,140,255,0.06)", border: "1px solid rgba(79,140,255,0.2)", borderRadius: "8px", marginBottom: "8px" }}>
								<div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--success)", boxShadow: "0 0 8px var(--success)", animation: "pulse 2s infinite", flexShrink: 0 }} />
								<span style={{ fontSize: "13px", fontWeight: 700, flex: 1 }}>{String(m.name || "Unknown")}</span>
								{m.size_vram && (
									<span style={{ fontSize: "11px", color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
										{Math.round(m.size_vram / 1024 / 1024)} MB en VRAM
									</span>
								)}
								{vram?.available && m.size && <VramBadge modelSizeBytes={m.size} vram={vram} />}
							</div>
						))}
					</div>
				)}
			</div>

			{/* ── Selector de Cuantización ─────────────────────── */}
			<div className="card-glass p-8 animate-fade">
				<h2 style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
					<Zap size={22} style={{ color: "var(--accent)" }} />
					Precisión vs Velocidad (Cuantización)
				</h2>
				<p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px" }}>
					Al descargar un modelo desde la sección de Modelos, podés elegir la cuantización óptima para tu hardware.
				</p>

				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
					{QUANT_OPTIONS.map((q) => {
						const isSelected = selectedQuant === q.value;
						const modelReferenceMb = 7000;
						const estimatedMb = Math.round(modelReferenceMb * q.vramFactor);
						const fits = vram?.available ? estimatedMb < vram.free : true;
						return (
							<button type="button" key={q.value} onClick={() => setSelectedQuant(q.value)} style={{ padding: "14px 16px", textAlign: "left", cursor: "pointer", background: isSelected ? "rgba(79,140,255,0.1)" : "rgba(255,255,255,0.02)", border: `1px solid ${isSelected ? "var(--accent)" : "var(--border-light)"}`, borderRadius: "10px", transition: "var(--transition)", boxShadow: isSelected ? "0 0 20px rgba(79,140,255,0.15)" : "none" }}>
								<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
									<span style={{ fontSize: "13px", fontWeight: 800, color: isSelected ? "var(--accent)" : "var(--text-main)", fontFamily: "var(--font-mono)" }}>
										:{q.value}
									</span>
									{vram?.available && (fits ? <CheckCircle size={14} style={{ color: "var(--success)" }} /> : <XCircle size={14} style={{ color: "var(--error)" }} />)}
								</div>
								<p style={{ fontSize: "10px", color: "var(--text-muted)", lineHeight: "1.4" }}>{q.label}</p>
								<p style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>~{estimatedMb.toLocaleString()} MB (ref. 7B)</p>
							</button>
						);
					})}
				</div>
			</div>

			{/* ── Configuración Global ─────────────────────────── */}
			<div className="card-glass p-8 animate-fade">
				<h2 style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
					<SlidersHorizontal size={22} style={{ color: "var(--accent)" }} />
					Configuración Global
				</h2>

				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
					<div>
						<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
							<Timer size={16} style={{ color: "var(--accent)", opacity: 0.7 }} />
							<label htmlFor="auto-unload" style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>
								Auto-Unload de VRAM
							</label>
						</div>
						<p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "12px", lineHeight: "1.5" }}>
							Libera la VRAM automáticamente si no hay actividad. Ideal para no desperdiciar GPU cuando te olvidás de cerrar la Station.
						</p>
						<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
							{AUTO_UNLOAD_OPTIONS.map((opt) => (
								<button type="button" key={opt.value} onClick={() => setAutoUnload(opt.value)} style={{ padding: "8px", borderRadius: "8px", cursor: "pointer", fontSize: "11px", fontWeight: 700, background: autoUnload === opt.value ? "rgba(79,140,255,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${autoUnload === opt.value ? "var(--accent)" : "var(--border-light)"}`, color: autoUnload === opt.value ? "var(--accent)" : "var(--text-muted)", transition: "var(--transition)" }}>
									{opt.label}
								</button>
							))}
						</div>
						{autoUnload > 0 && (
							<p style={{ fontSize: "10px", color: "var(--success)", marginTop: "8px" }}>
								✓ La VRAM se liberará tras {autoUnload} min de inactividad
							</p>
						)}
					</div>

					<div>
						<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
							<Power size={16} style={{ color: "var(--accent)", opacity: 0.7 }} />
							<label htmlFor="num-ctx" style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>
								Contexto Global (num_ctx)
							</label>
						</div>
						<p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "12px", lineHeight: "1.5" }}>
							Tokens de contexto para todos los agentes y chats MCP. Más contexto = más VRAM. Todos los agentes heredan este valor.
						</p>
						<div style={{ marginBottom: "12px" }}>
							<input id="num-ctx" type="range" min={512} max={131072} step={512} value={numCtx} onChange={(e) => setNumCtx(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }} />
							<div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
								<span>512</span>
								<span style={{ fontSize: "14px", fontWeight: 800, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{numCtx.toLocaleString()} tokens</span>
								<span>131072</span>
							</div>
						</div>
						<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
							{[2048, 4096, 8192, 16384, 32768].map((v) => (
								<button type="button" key={v} onClick={() => setNumCtx(v)} style={{ padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "10px", fontWeight: 700, background: numCtx === v ? "rgba(79,140,255,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${numCtx === v ? "var(--accent)" : "var(--border-light)"}`, color: numCtx === v ? "var(--accent)" : "var(--text-muted)" }}>
									{v >= 1000 ? `${v / 1024}K` : v}
								</button>
							))}
						</div>
					</div>
				</div>

				<div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border-light)" }}>
					<button type="button" className="auth-btn" style={{ width: "auto", padding: "0 32px", display: "flex", alignItems: "center", gap: "8px" }} onClick={saveSettings} disabled={saving}>
						{saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
						{saving ? "Guardando..." : "Aplicar Configuración"}
					</button>
					{savedMsg && (
						<span style={{ fontSize: "12px", color: savedMsg.startsWith("✓") ? "var(--success)" : "var(--error)", fontWeight: 700 }}>
							{savedMsg}
						</span>
					)}
				</div>
			</div>
		</div>
	);
};
