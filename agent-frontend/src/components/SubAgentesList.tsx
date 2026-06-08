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

interface ToolInfo {
	spec: {
		function: {
			name: string;
			description: string;
		};
	};
	enabled: boolean;
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
	const [toolsList, setToolsList] = useState<ToolInfo[]>([]);

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
				case "tools_list": {
					const toolList = msg.payload?.tools as ToolInfo[];
					if (Array.isArray(toolList)) {
						setToolsList(toolList);
					}
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
			sendWs("list_tools", {});
		}
	}, [connected, sendWs]);

	const toggleNewAgentTool = (toolName: string) => {
		setNewAgent((prev) => ({
			...prev,
			tools: prev.tools.includes(toolName)
				? prev.tools.filter((t) => t !== toolName)
				: [...prev.tools, toolName],
		}));
	};

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

	// ─── Template definitions ───────────────────────────────────────────
	const agentTemplates: Array<{
		id: string;
		name: string;
		desc: string;
		agent: Partial<SubAgent>;
	}> = [
		{
			id: "sub-codigo",
			name: "💻 Asistente de Código",
			desc: "Revisión de código, debugging, refactoring y buenas prácticas",
			agent: {
				name: "codigo",
				system_prompt: `Eres un asistente experto en desarrollo de software.
Te especializas en:
- Revisar código fuente y encontrar bugs, vulnerabilidades y malas prácticas
- Sugerir refactors y mejoras de rendimiento
- Explicar patrones de diseño y arquitectura
- Escribir código limpio, comentado y testeable
- Ayudar con debugging y resolución de errores

Sé preciso, concreto y siempre explica POR QUÉ sugerís un cambio.`,
				tools: ["bash", "read_file", "write_file", "edit_file", "glob", "grep"],
				temperature: 0.3,
				model: "",
			},
		},
		{
			id: "sub-docs",
			name: "📝 Asistente de Documentación",
			desc: "Redacción técnica, documentación, READMEs y guías",
			agent: {
				name: "documentacion",
				system_prompt: `Eres un asistente especializado en documentación técnica.
Te especializas en:
- Redactar documentación clara y bien estructurada
- Escribir READMEs, guías de usuario y manuales técnicos
- Documentar APIs, endpoints y schemas
- Crear tutoriales paso a paso
- Traducir documentación técnica entre idiomas

Usa un tono profesional pero accesible. Incluye ejemplos prácticos.`,
				tools: ["read_file", "glob", "grep", "read_url", "web_search", "translate"],
				temperature: 0.7,
				model: "",
			},
		},
		{
			id: "sub-testing",
			name: "🧪 Asistente de Testing",
			desc: "Pruebas unitarias, integración, E2E y calidad de software",
			agent: {
				name: "testing",
				system_prompt: `Eres un asistente especializado en testing y calidad de software.
Te especializas en:
- Escribir tests unitarios, de integración y E2E
- Analizar cobertura de código y sugerir mejoras
- Identificar casos borde y escenarios de error
- Escribir mocks, stubs y fixtures
- Automatizar pruebas y configurar CI/CD

Sé exhaustivo: cada función debería tener al menos un test feliz y uno de error.`,
				tools: ["bash", "read_file", "write_file", "edit_file", "glob", "grep"],
				temperature: 0.4,
				model: "",
			},
		},
		{
			id: "sub-devops",
			name: "🐳 Asistente DevOps",
			desc: "Docker, infraestructura, despliegue y automatización",
			agent: {
				name: "devops",
				system_prompt: `Eres un asistente experto en DevOps e infraestructura.
Te especializas en:
- Crear y optimizar Dockerfiles y docker-compose.yml
- Configurar redes, volúmenes y servicios Docker
- Automatizar despliegues y CI/CD
- Monitorear y diagnosticar problemas de infraestructura
- Seguridad de contenedores y buenas prácticas

Prioriza soluciones simples, seguras y mantenibles. Documenta cada cambio.`,
				tools: ["bash", "read_file", "write_file", "edit_file", "glob", "grep", "read_url"],
				temperature: 0.5,
				model: "",
			},
		},
	];

	const applyAgentTemplate = (tpl: typeof agentTemplates[0]) => {
		const a = tpl.agent;
		setNewAgent({
			name: a.name || "",
			model: a.model || "",
			system_prompt: a.system_prompt || "",
			tools: a.tools || [],
			temperature: a.temperature ?? 0.7,
		});
		setShowAgentForm(true);
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
			{/* ─── Template presets section ─────────────────────────────── */}
			<div style={{
				marginBottom: "20px",
				padding: "14px 16px",
				borderRadius: "8px",
				background: "rgba(255,215,0,0.04)",
				border: "1px solid rgba(255,215,0,0.15)",
			}}>
				<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
					<FileText size={13} color="var(--accent)" />
					<label style={{ ...sectionTitle, marginBottom: 0 }}>
						Plantillas de sub-agentes
					</label>
				</div>
				<div style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
					gap: "8px",
				}}>
					{agentTemplates.map((tpl) => (
						<button
							key={tpl.id}
							type="button"
							onClick={() => applyAgentTemplate(tpl)}
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
							<div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
								{tpl.name}
							</div>
							<div style={{ fontSize: "10px", color: "var(--text-dim)", lineHeight: 1.4 }}>
								{tpl.desc}
							</div>
							<div style={{
								marginTop: "6px",
								fontSize: "9px",
								fontWeight: 600,
								color: "var(--accent)",
								textTransform: "uppercase",
								letterSpacing: "0.5px",
							}}>
								Usar plantilla →
							</div>
						</button>
					))}
				</div>
			</div>

			{/* Header */}
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
					{/* Tools selector */}
					<div style={{ marginBottom: "8px" }}>
						<label
							style={{
								fontSize: "10px",
								fontWeight: 600,
								color: "var(--text-muted)",
								display: "block",
								marginBottom: "6px",
							}}
						>
							Herramientas permitidas ({newAgent.tools.length}/{toolsList.length})
						</label>
						<div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
							{toolsList.map((tool) => {
								const toolName = tool.spec.function.name;
								const isSelected = newAgent.tools.includes(toolName);
								return (
									<button
										key={toolName}
										type="button"
										onClick={() => toggleNewAgentTool(toolName)}
										style={{
											padding: "4px 8px",
											borderRadius: "4px",
											border: "1px solid",
											borderColor: isSelected ? "rgba(79,140,255,0.3)" : "var(--border-light)",
											background: isSelected ? "rgba(79,140,255,0.1)" : "transparent",
											color: isSelected ? "var(--accent)" : "var(--text-dim)",
											cursor: "pointer",
											fontSize: "10px",
											fontFamily: "var(--font-mono)",
											transition: "all 0.15s ease",
										}}
									>
										{isSelected ? "✅ " : "  "}{toolName}
									</button>
								);
							})}
						</div>
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
						alignItems: "flex-start",
						gap: "8px",
						padding: "10px 0",
						borderBottom: "1px solid var(--border-light)",
						justifyContent: "space-between",
					}}
				>
					<div style={{ flex: 1, minWidth: 0 }}>
						<div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-main)" }}>
							@{agent.name}
						</div>
						<div style={{ fontSize: "11px", color: "var(--accent)", fontFamily: "monospace", marginBottom: "2px" }}>
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
						{agent.tools && agent.tools.length > 0 && (
							<div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "6px" }}>
								{agent.tools.map((t) => (
									<span
										key={t}
										style={{
											padding: "1px 6px",
											borderRadius: "3px",
											background: "rgba(79,140,255,0.08)",
											color: "var(--accent)",
											fontSize: "9px",
											fontFamily: "var(--font-mono)",
										}}
									>
										{t}
									</span>
								))}
							</div>
						)}
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
							flexShrink: 0,
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
