import { Plus, Save, Settings, Sliders, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useWs } from "../contexts/WebSocketContext";

interface SubAgent {
  name: string;
  model: string;
  system_prompt: string;
  tools: string[];
  temperature: number;
}

interface GeneralConfig {
  model: string;
  temperature: number;
  history_limit: number;
  system_prompt: string;
}

export const Agentes: React.FC = () => {
  const { connected, send: sendWs, subscribe } = useWs();
  // General config
  const [configModel, setConfigModel] = useState(() => localStorage.getItem("agent_model") || "llama3.2:3b");
  const [configTemp, setConfigTemp] = useState(0.7);
  const [configHistoryLimit, setConfigHistoryLimit] = useState(10);

  const [telegramToken, setTelegramToken] = useState("");
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [tools, setTools] = useState<string[]>([]);
  const [toolStates, setToolStates] = useState<Record<string, boolean>>({});

  // Sub-agents
  const [agents, setAgents] = useState<SubAgent[]>([]);
  const [newAgent, setNewAgent] = useState<SubAgent>({
    name: "", model: "", system_prompt: "", tools: [], temperature: 0.7,
  });
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Subscribe to WS messages
  useEffect(() => {
    return subscribe((msg) => {
      switch (msg.type) {
        case "general_config": {
          const gc = msg.payload as unknown as GeneralConfig;
          if (gc?.model != null) {
            setConfigModel(gc.model || "");
            localStorage.setItem("agent_model", gc.model || "");
          }
          if (gc?.temperature != null) setConfigTemp(gc.temperature);
          if (gc?.history_limit != null) setConfigHistoryLimit(gc.history_limit);
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
          const toolList = msg.payload?.tools as Array<{ function: { name: string } }> | string[];
          if (Array.isArray(toolList)) {
            const names = typeof toolList[0] === "string"
              ? toolList as string[]
              : (toolList as Array<{ function: { name: string } }>).map((t) => t.function.name);
            setTools(names);
            const states: Record<string, boolean> = {};
            for (const t of names) states[t] = true;
            setToolStates(states);
          }
          break;
        }
        case "list_experts": {
          const experts = msg.payload?.experts as SubAgent[];
          if (experts) setAgents(experts);
          break;
        }
        case "ollama_models": {
          const models = msg.payload?.models as Array<{ name: string }> || [];
          setOllamaModels(models.map((m: { name: string }) => m.name));
          break;
        }
      }
    });
  }, [subscribe]);

  // Fetch initial data when connected
  useEffect(() => {
    if (connected) {
      sendWs("get_general_config", {});
      sendWs("get_status", {});
      sendWs("list_tools", {});
      sendWs("list_experts", {});
      sendWs("list_ollama_models", {});
    }
  }, [connected, sendWs]);

  const handleSaveGeneralConfig = () => {
    setSaveMessage(null);
    if (!connected) {
      setSaveMessage({ type: "error", text: "No hay conexi\u00f3n con el servidor. Verifica que el Agent Engine est\u00e9 corriendo." });
      return;
    }
    const payload = {
      model: configModel,
      temperature: configTemp,
      history_limit: configHistoryLimit,
    };
    console.log("[Save] Enviando general_config_update:", JSON.stringify(payload));
    sendWs("general_config_update", payload);
    setSaving(true);
    savingRef.current = true;
  };

  const handleTelegramSave = () => {
    sendWs("telegram_update", { botToken: telegramToken, enabled: telegramEnabled });
  };

  const handleToolToggle = (toolName: string, enabled: boolean) => {
    sendWs("toggle_tool", { name: toolName, enabled });
    setToolStates((prev) => ({ ...prev, [toolName]: enabled }));
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
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      {/* Connection status — full width */}
      <div style={sectionCard}>
        <label style={sectionTitle}>
          <Settings size={14} style={{ marginRight: "6px" }} />
          Agent Engine
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-main)" }}>
          <span style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: connected ? "var(--success)" : "var(--error)",
            display: "inline-block",
          }} />
          {connected ? "Conectado" : "Desconectado"}
          {configModel && <span style={{ color: "var(--accent)", fontFamily: "monospace", fontSize: "12px" }}>{configModel}</span>}
        </div>
      </div>

      {/* 2-column grid: General Config | Telegram */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        {/* General Settings */}
        <div style={sectionCardGrid}>
          <label style={sectionTitle}>
            <Sliders size={14} style={{ marginRight: "6px" }} />
            Configuraci\u00f3n General
          </label>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Modelo</label>
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
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {ollamaModels.length === 0 && (
              <div style={{ fontSize: "10px", color: "var(--warning)", marginTop: "4px" }}>
                No se pudieron cargar los modelos. \u00bfOllama est\u00e1 corriendo?
              </div>
            )}
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
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
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "var(--text-dim)" }}>
              <span>0 (preciso)</span>
              <span>2 (creativo)</span>
            </div>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
              L\u00edmite de historial: {configHistoryLimit} mensajes
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
            <button type="button" onClick={handleSaveGeneralConfig} disabled={saving} style={{
              ...actionBtnStyle,
              opacity: saving ? 0.6 : 1,
              cursor: saving ? "wait" : "pointer",
            }}>
              <Save size={14} style={{ marginRight: "4px" }} />
              {saving ? "Guardando..." : "Guardar Configuraci\u00f3n"}
            </button>
            {saveMessage && (
              <span style={{
                fontSize: "11px", fontWeight: 500,
                color: saveMessage.type === "success" ? "var(--success)" : "var(--error)",
              }}>
                {saveMessage.text}
              </span>
            )}
          </div>
        </div>

        {/* Telegram */}
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
            <span style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: telegramEnabled ? "var(--success)" : "var(--error)",
              display: "inline-block",
            }} />
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {telegramEnabled ? "Bot activo" : "Bot inactivo"}
            </span>
          </div>
        </div>
      </div>

      {/* Tools — full width */}
      <div style={sectionCard}>
        <label style={sectionTitle}>Herramientas ({tools.length})</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {tools.map((tool) => (
            <button
              key={tool}
              type="button"
              onClick={() => handleToolToggle(tool, !toolStates[tool])}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border-light)",
                background: toolStates[tool] ? "rgba(79,140,255,0.1)" : "rgba(255,255,255,0.02)",
                color: toolStates[tool] ? "var(--accent)" : "var(--text-muted)",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: toolStates[tool] ? 600 : 400,
              }}
            >
              {tool}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-Agents — full width */}
      <div style={sectionCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
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
          <div style={{ padding: "12px", marginBottom: "12px", background: "rgba(79,140,255,0.05)", borderRadius: "6px", border: "1px solid rgba(79,140,255,0.15)" }}>
            <div style={{ marginBottom: "8px" }}>
              <label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Nombre</label>
              <input type="text" value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} style={inputStyle} placeholder="my-expert" />
            </div>
            <div style={{ marginBottom: "8px" }}>
              <label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Modelo</label>
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
                <option value="">Default ({configModel})</option>
                {ollamaModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: "8px" }}>
              <label style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>System Prompt</label>
              <textarea value={newAgent.system_prompt} onChange={(e) => setNewAgent({ ...newAgent, system_prompt: e.target.value })} rows={4} style={{ ...inputStyle, resize: "vertical" }} placeholder="You are an expert agent specialized in..." />
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
          <div key={agent.name} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 0", borderBottom: "1px solid var(--border-light)", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-main)" }}>@{agent.name}</div>
              <div style={{ fontSize: "11px", color: "var(--accent)", fontFamily: "monospace" }}>{agent.model || "(default)"}</div>
              <div style={{ fontSize: "11px", color: "var(--text-dim)", maxHeight: "32px", overflow: "hidden", marginTop: "2px" }}>
                {agent.system_prompt.substring(0, 120)}
                {agent.system_prompt.length > 120 ? "..." : ""}
              </div>
            </div>
            <button type="button" onClick={() => handleDeleteAgent(agent.name)} style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", opacity: 0.5, padding: "4px" }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
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
