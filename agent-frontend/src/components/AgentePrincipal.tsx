import { Power, PowerOff, Save, Settings, Sliders } from "lucide-react";
import { useRef, useState } from "react";
import { useWs } from "../contexts/WebSocketContext";

interface AgentMode {
    name: string;
    label: string;
    system_prompt: string;
    tools: string[];
    model: string;
    temperature: number;
    history_limit: number;
    tool_policy: "auto" | "restricted" | "ask_user";
    extends: string | null;
    usage_count: number;
    last_used: string | null;
    created_at?: string;
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

interface AgentePrincipalProps {
    activeMode: AgentMode | null;
    activeModeName: string | null;
    tools: ToolInfo[];
    ollamaModels: string[];
}

export const AgentePrincipal: React.FC<AgentePrincipalProps> = ({
    activeMode,
    activeModeName,
    tools,
    ollamaModels,
}) => {
    const { connected, send: sendWs } = useWs();

    const [configModel, setConfigModel] = useState(activeMode?.model || "");
    const [configTemp, setConfigTemp] = useState(activeMode?.temperature ?? 0.7);
    const [configHistoryLimit, setConfigHistoryLimit] = useState(activeMode?.history_limit ?? 10);
    const [configSystemPrompt, setConfigSystemPrompt] = useState(activeMode?.system_prompt || "");
    const [configToolPolicy, setConfigToolPolicy] = useState<"auto" | "restricted" | "ask_user">(activeMode?.tool_policy || "auto");
    const [enabledTools, setEnabledTools] = useState<string[]>(activeMode?.tools || []);

    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleSaveModeConfig = () => {
        setSaveMessage(null);
        if (!connected) {
            setSaveMessage({
                type: "error",
                text: "No hay conexion con el servidor. Verifica que el Agent Engine este corriendo.",
            });
            return;
        }
        if (!activeModeName) {
            setSaveMessage({
                type: "error",
                text: "No hay un modo activo seleccionado.",
            });
            return;
        }
        const updatedMode: Partial<AgentMode> = {
            name: activeModeName,
            label: activeMode?.label || activeModeName,
            model: configModel,
            temperature: configTemp,
            history_limit: configHistoryLimit,
            system_prompt: configSystemPrompt,
            tool_policy: configToolPolicy,
            tools: enabledTools,
        };
        sendWs("mode_update", { action: "upsert", mode: updatedMode });
        setSaving(true);
        savingRef.current = true;
        setTimeout(() => {
            setSaving(false);
            savingRef.current = false;
            setSaveMessage({ type: "success", text: "Configuracion guardada correctamente" });
            setTimeout(() => setSaveMessage(null), 2500);
        }, 800);
    };

    const handleToolToggle = (toolName: string) => {
        setEnabledTools((prev) =>
            prev.includes(toolName)
                ? prev.filter((t) => t !== toolName)
                : [...prev, toolName]
        );
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

    const activeModeLabel = activeMode?.label || activeModeName || "Ninguno";

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
                    <span>{connected ? "Conectado" : "Desconectado"}</span>
                    <span style={{ color: "var(--text-muted)" }}>|</span>
                    <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                        Modo: {activeModeLabel}
                    </span>
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
                        Configuracion del Modo: {activeModeLabel}
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
                                width: "100%",
                                padding: "10px 14px",
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid var(--border-light)",
                                borderRadius: "8px",
                                color: "var(--text-main)",
                                fontSize: "13px",
                                fontFamily: "inherit",
                                boxSizing: "border-box",
                                appearance: "none",
                                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E\")",
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
                                No se pudieron cargar los modelos. Ollama esta corriendo?
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
                            Limite de historial: {configHistoryLimit} mensajes
                        </label>
                        <input
                            type="number"
                            min={5}
                            max={100}
                            value={configHistoryLimit}
                            onChange={(e) => setConfigHistoryLimit(parseInt(e.target.value, 10) || 10)}
                            style={{
                                width: "100%",
                                padding: "10px 14px",
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid var(--border-light)",
                                borderRadius: "8px",
                                color: "var(--text-main)",
                                fontSize: "13px",
                                fontFamily: "inherit",
                                boxSizing: "border-box",
                            }}
                        />
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
                            Politica de herramientas
                        </label>
                        <select
                            value={configToolPolicy}
                            onChange={(e) => setConfigToolPolicy(e.target.value as "auto" | "restricted" | "ask_user")}
                            style={{
                                width: "100%",
                                padding: "10px 14px",
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid var(--border-light)",
                                borderRadius: "8px",
                                color: "var(--text-main)",
                                fontSize: "13px",
                                fontFamily: "inherit",
                                boxSizing: "border-box",
                                appearance: "none",
                                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E\")",
                                backgroundRepeat: "no-repeat",
                                backgroundPosition: "right 12px center",
                                paddingRight: "32px",
                                cursor: "pointer",
                            }}
                        >
                            <option value="auto">Auto</option>
                            <option value="restricted">Restringido</option>
                            <option value="ask_user">Preguntar al usuario</option>
                        </select>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <button
                            type="button"
                            onClick={handleSaveModeConfig}
                            disabled={saving || !activeModeName}
                            style={{
                                padding: "10px 16px",
                                background: "rgba(79,140,255,0.1)",
                                border: "1px solid rgba(79,140,255,0.2)",
                                borderRadius: "8px",
                                color: "var(--accent)",
                                cursor: saving || !activeModeName ? "not-allowed" : "pointer",
                                fontSize: "11px",
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                opacity: saving || !activeModeName ? 0.6 : 1,
                            }}
                        >
                            <Save size={14} style={{ marginRight: "4px" }} />
                            {saving ? "Guardando..." : "Guardar Configuracion"}
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
                    <label style={sectionTitle}>Informacion del Modo</label>
                    {activeMode ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>
                                {activeMode.label || activeMode.name}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                                <div>Nombre interno: <code style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{activeMode.name}</code></div>
                                <div>Usos: {activeMode.usage_count ?? 0}</div>
                                <div>Ultimo uso: {activeMode.last_used ? new Date(activeMode.last_used).toLocaleString("es-ES") : "Nunca"}</div>
                                {activeMode.extends && <div>Extiende: {activeMode.extends}</div>}
                            </div>
                            <div style={{
                                marginTop: "8px",
                                padding: "8px",
                                borderRadius: "6px",
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid var(--border-light)",
                                fontSize: "11px",
                                color: "var(--text-dim)",
                                lineHeight: 1.5,
                                maxHeight: "120px",
                                overflowY: "auto",
                                fontFamily: "var(--font-mono)",
                                whiteSpace: "pre-wrap",
                            }}>
                                {activeMode.system_prompt
                                    ? activeMode.system_prompt.substring(0, 300) + (activeMode.system_prompt.length > 300 ? "..." : "")
                                    : "(Sin system prompt)"}
                            </div>
                        </div>
                    ) : (
                        <div style={{ fontSize: "12px", color: "var(--text-dim)", padding: "12px 0" }}>
                            Selecciona un modo de la lista superior para ver su informacion.
                        </div>
                    )}
                </div>
            </div>

            <div style={sectionCard}>
                <label style={sectionTitle}>
                    System Prompt - {activeModeLabel}
                </label>
                <textarea
                    value={configSystemPrompt}
                    onChange={(e) => setConfigSystemPrompt(e.target.value)}
                    rows={6}
                    style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border-light)",
                        borderRadius: "8px",
                        color: "var(--text-main)",
                        fontSize: "12px",
                        fontFamily: "var(--font-mono)",
                        boxSizing: "border-box",
                        resize: "vertical",
                    }}
                    placeholder="Eres un asistente conversacional y operativo..."
                />
                <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "6px" }}>
                    Define la personalidad y reglas del agente. Se guarda al hacer clic en Guardar Configuracion.
                </div>
            </div>

            <div style={sectionCard}>
                <label style={sectionTitle}>
                    Herramientas ({tools.length}) - {activeModeLabel}
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {tools.map((tool) => {
                        const toolName = tool.spec.function.name;
                        const desc = tool.spec.function.description;
                        const isEnabled = enabledTools.includes(toolName);
                        const cardBorder = "1px solid " + (isEnabled ? "rgba(79,140,255,0.15)" : "var(--border-light)");
                        return (
                            <div
                                key={toolName}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                    padding: "12px",
                                    borderRadius: "8px",
                                    background: isEnabled ? "rgba(79,140,255,0.04)" : "rgba(255,255,255,0.01)",
                                    border: cardBorder,
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
                                        {isEnabled ? "\u2705 " : "  "}{toolName}
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
                                    onClick={() => handleToolToggle(toolName)}
                                    title={isEnabled ? "Desactivar para este modo" : "Activar para este modo"}
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
                <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "8px" }}>
                    Las herramientas activas/inactivas se guardan junto con la configuracion del modo.
                </div>
            </div>
        </>
    );
};