import { Palette, User, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWs } from "../contexts/WebSocketContext";
import { AgentePrincipal } from "./AgentePrincipal";
import { ModosList } from "./ModosList";
import { SubAgentesList } from "./SubAgentesList";

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

type AgentesSubTab = "main" | "modos" | "subs";

export const Agentes: React.FC = () => {
    const { connected, send: sendWs, subscribe } = useWs();
    const [subTab, setSubTab] = useState<AgentesSubTab>("main");
    const [modes, setModes] = useState<AgentMode[]>([]);
    const [activeModeName, setActiveModeName] = useState<string | null>(null);
    const [activeMode, setActiveMode] = useState<AgentMode | null>(null);
    const [tools, setTools] = useState<ToolInfo[]>([]);
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);
    const requestRef = useRef(false);

    // Subscribe to WS messages
    useEffect(() => {
        return subscribe((msg) => {
            switch (msg.type) {
                case "list_modes": {
                    const list = msg.payload?.modes as AgentMode[];
                    const active = (msg.payload?.active as string) || "";
                    if (list) {
                        setModes(list);
                    }
                    if (active) {
                        setActiveModeName(active);
                        const found = list?.find((m) => m.name === active) || null;
                        setActiveMode(found);
                    }
                    break;
                }
                case "get_active_mode": {
                    const mode = msg.payload?.mode as AgentMode;
                    if (mode) {
                        setActiveMode(mode);
                        setActiveModeName(mode.name);
                    }
                    break;
                }
                case "mode_changed": {
                    const modeData = msg.payload?.mode as AgentMode;
                    if (modeData) {
                        setActiveMode(modeData);
                        setActiveModeName(modeData.name);
                        // Refresh modes list
                        sendWs("list_modes", {});
                    }
                    break;
                }
                case "tools_list": {
                    const toolList = msg.payload?.tools as ToolInfo[];
                    if (Array.isArray(toolList)) {
                        setTools(toolList);
                    }
                    break;
                }
                case "ollama_models": {
                    const models = (msg.payload?.models as Array<{ name: string }>) || [];
                    setOllamaModels(models.map((m) => m.name));
                    break;
                }
            }
        });
    }, [subscribe, sendWs]);

    // Fetch data on connect
    useEffect(() => {
        if (connected && !requestRef.current) {
            requestRef.current = true;
            sendWs("list_modes", {});
            sendWs("get_active_mode", {});
            sendWs("list_tools", {});
            sendWs("list_ollama_models", {});
        }
        if (!connected) {
            requestRef.current = false;
        }
    }, [connected, sendWs]);

    const handleSetActiveMode = useCallback((name: string) => {
        if (!connected) return;
        sendWs("set_active_mode", { name });
    }, [connected, sendWs]);

    const sectionCard: React.CSSProperties = {
        padding: "16px",
        borderRadius: "8px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--border-light)",
        marginBottom: "16px",
    };

    return (
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            <div className="sub-tabs">
                <button
                    type="button"
                    className={`sub-tab-btn ${subTab === "main" ? "active" : ""}`}
                    onClick={() => setSubTab("main")}
                >
                    <User size={14} />
                    Agente Principal
                </button>
                <button
                    type="button"
                    className={`sub-tab-btn ${subTab === "modos" ? "active" : ""}`}
                    onClick={() => setSubTab("modos")}
                >
                    <Palette size={14} />
                    Modos
                </button>
                <button
                    type="button"
                    className={`sub-tab-btn ${subTab === "subs" ? "active" : ""}`}
                    onClick={() => setSubTab("subs")}
                >
                    <Users size={14} />
                    Sub Agentes
                </button>
            </div>

            {subTab === "main" && (
                <>
                    {/* Active Mode Cards - Mode Selector */}
                    {modes.length > 0 && (
                        <div style={sectionCard}>
                            <label style={{
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "var(--text-muted)",
                                display: "block",
                                marginBottom: "12px",
                                textTransform: "uppercase",
                                letterSpacing: "1px",
                            }}>
                                Modo Activo
                            </label>
                            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                {modes.map((mode) => {
                                    const isActive = mode.name === activeModeName;
                                    return (
                                        <button
                                            key={mode.name}
                                            type="button"
                                            onClick={() => handleSetActiveMode(mode.name)}
                                            style={{
                                                flex: "1 1 200px",
                                                padding: "14px",
                                                borderRadius: "10px",
                                                cursor: "pointer",
                                                textAlign: "left",
                                                background: isActive
                                                    ? "linear-gradient(135deg, rgba(79,140,255,0.12), rgba(124,58,237,0.08))"
                                                    : "rgba(255,255,255,0.02)",
                                                border: isActive
                                                    ? "1.5px solid rgba(79,140,255,0.5)"
                                                    : "1px solid var(--border-light)",
                                                transition: "all 0.2s ease",
                                                fontFamily: "inherit",
                                                color: "inherit",
                                                boxShadow: isActive
                                                    ? "0 0 20px rgba(79,140,255,0.08)"
                                                    : "none",
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isActive) {
                                                    e.currentTarget.style.borderColor = "rgba(79,140,255,0.2)";
                                                    e.currentTarget.style.background = "rgba(79,140,255,0.03)";
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isActive) {
                                                    e.currentTarget.style.borderColor = "var(--border-light)";
                                                    e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                                                }
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                                                <span style={{
                                                    width: "8px",
                                                    height: "8px",
                                                    borderRadius: "50%",
                                                    background: isActive ? "var(--accent)" : "var(--text-dim)",
                                                    flexShrink: 0,
                                                }} />
                                                <span style={{
                                                    fontSize: "14px",
                                                    fontWeight: 600,
                                                    color: isActive ? "var(--accent)" : "var(--text-main)",
                                                }}>
                                                    {mode.label || mode.name}
                                                </span>
                                                {isActive && (
                                                    <span style={{
                                                        fontSize: "9px",
                                                        fontWeight: 700,
                                                        padding: "2px 6px",
                                                        borderRadius: "4px",
                                                        background: "rgba(79,140,255,0.15)",
                                                        color: "var(--accent)",
                                                    }}>
                                                        ACTIVO
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{
                                                fontSize: "11px",
                                                color: "var(--text-dim)",
                                                display: "flex",
                                                gap: "8px",
                                                flexWrap: "wrap",
                                            }}>
                                                <span>Model: {mode.model || "(default)"}</span>
                                                <span>Tools: {mode.tools?.length || 0}</span>
                                                <span>Temp: {mode.temperature.toFixed(1)}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <AgentePrincipal key={activeModeName || "no-mode"} activeMode={activeMode}
                        activeModeName={activeModeName}
                        tools={tools}
                        ollamaModels={ollamaModels}
                    />
                </>
            )}

            {subTab === "modos" && (
                <div style={sectionCard}>
                    <ModosList
                        modes={modes}
                        activeModeName={activeModeName}
                        tools={tools}
                        ollamaModels={ollamaModels}
                    />
                </div>
            )}

            {subTab === "subs" && <SubAgentesList />}
        </div>
    );
};


