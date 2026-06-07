import { FileText, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useWs } from "../contexts/WebSocketContext";

interface SubAgent {
	name: string;
	model: string;
	system_prompt: string;
	tools: string[];
	temperature: number;
}

export const SubAgentesList: React.FC = () => {
	const { connected, send: sendWs, subscribe } = useWs();
	const [configModel, setConfigModel] = useState("");
	const [agents, setAgents] = useState<SubAgent[]>([]);
	const [newAgent, setNewAgent] = useState<SubAgent>({
		name: "",
		model: "",
		system_prompt: "",
		tools: [],
		temperature: 0.7,
	});
	const [showAgentForm, setShowAgentForm] = useState(false);
	const [ollamaModels, setOllamaModels] = useState<string[]>([]);

	useEffect(() => {
		return subscribe((msg) => {
			switch (msg.type) {
				case "general_config": {
					const gc = msg.payload as { model?: string } | null;
					if (gc?.model != null) setConfigModel(gc.model || "");
					break;
				}
				case "status":
					if (msg.payload?.model) setConfigModel(msg.payload.model as string);
					break;
				case "list_experts": {
					const experts = msg.payload?.experts as SubAgent[];
					if (experts) setAgents(experts);
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
			sendWs("list_experts", {});
			sendWs("list_ollama_models", {});
		}
	}, [connected, sendWs]);

	const handleCreateAgent = () => {
		if (!newAgent.name.trim()) return;
		sendWs("expert_update", {
			action: "upsert",
			expert: {
				name: newAgent.name.trim(),
				model: newAgent.model || configModel,
				system_prompt: newAgent.system_prompt,
				tools: newAgent.tools,
				temperature: newAgent.temperature,
				experts: [],
			},
		});
		setNewAgent({ name: "", model: "", system_prompt: "", tools: [], temperature: 0.7 });
		setShowAgentForm(false);
	};

	const handleDeleteAgent = (name: string) => {
		sendWs("expert_update", { action: "delete", name });
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
		<div style={sectionCard}>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "12px",
				}}
			>
				<label style={{ ...sectionTitle, marginBottom: 0 }}>Sub-Agentes ({agents.length})</label>
				<button
					type="button"
					onClick={() => setShowAgentForm(!showAgentForm)}
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
					{showAgentForm ? <X size={12} /> : <Plus size={12} />}
					{showAgentForm ? "Cancelar" : "Nuevo"}
				</button>
			</div>

			{showAgentForm && (
				<div
					style={{
						padding: "12px",
						marginBottom: "12px",
						background: "rgba(79,140,255,0.05)",
						borderRadius: "6px",
						border: "1px solid rgba(79,140,255,0.15)",
					}}
				>
					<div style={{ marginBottom: "8px" }}>
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
							value={newAgent.name}
							onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
							style={inputStyle}
							placeholder="my-expert"
						/>
					</div>
					<div style={{ marginBottom: "8px" }}>
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
							value={newAgent.model || configModel}
							onChange={(e) => setNewAgent({ ...newAgent, model: e.target.value })}
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
							<option value="">Default ({configModel || "..."})</option>
							{ollamaModels.map((m) => (
								<option key={m} value={m}>
									{m}
								</option>
							))}
						</select>
					</div>
					<div style={{ marginBottom: "8px" }}>
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
							value={newAgent.system_prompt}
							onChange={(e) => setNewAgent({ ...newAgent, system_prompt: e.target.value })}
							rows={4}
							style={{ ...inputStyle, resize: "vertical" }}
							placeholder="You are an expert agent specialized in..."
						/>
					</div>
					<button type="button" onClick={handleCreateAgent} style={actionBtnStyle}>
						<Save size={14} style={{ marginRight: "4px" }} /> Crear Agente
					</button>
				</div>
			)}

			{agents.length === 0 && !showAgentForm && (
				<div style={{ fontSize: "12px", color: "var(--text-dim)", padding: "12px 0" }}>
					Sin sub-agentes configurados. Crea uno para delegar tareas especializadas.
				</div>
			)}

			{agents.map((agent) => (
				<div
					key={agent.name}
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						padding: "10px 0",
						borderBottom: "1px solid var(--border-light)",
						justifyContent: "space-between",
					}}
				>
					<div>
						<div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-main)" }}>
							@{agent.name}
						</div>
						<div style={{ fontSize: "11px", color: "var(--accent)", fontFamily: "monospace" }}>
							{agent.model || "(default)"}
						</div>
						<div
							style={{
								fontSize: "11px",
								color: "var(--text-dim)",
								maxHeight: "32px",
								overflow: "hidden",
								marginTop: "2px",
							}}
						>
							{agent.system_prompt.substring(0, 120)}
							{agent.system_prompt.length > 120 ? "..." : ""}
						</div>
					</div>
					<button
						type="button"
						onClick={() => handleDeleteAgent(agent.name)}
						style={{
							background: "none",
							border: "none",
							color: "var(--error)",
							cursor: "pointer",
							opacity: 0.5,
							padding: "4px",
						}}
					>
						<Trash2 size={14} />
					</button>
				</div>
			))}
		</div>
	);
};

const sectionCard: React.CSSProperties = {
	padding: "16px",
	borderRadius: "8px",
	background: "rgba(255,255,255,0.02)",
	border: "1px solid var(--border-light)",
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
