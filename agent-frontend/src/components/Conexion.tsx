import { Cable, Plus, Save, Trash2, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { config } from "../config";

interface ModelEntry {
  name: string;
  displayName?: string;
  apiKey?: string;
  baseUrl?: string;
}

export const Conexion: React.FC = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  // Models
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [showModelForm, setShowModelForm] = useState(false);
  const [newModel, setNewModel] = useState<ModelEntry>({ name: "", displayName: "", apiKey: "", baseUrl: "" });

  useEffect(() => {
    const ws = new WebSocket(config.wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "list_models", payload: {} }));
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "list_models") {
          const list = msg.payload?.models as ModelEntry[];
          if (list) setModels(list);
        }
      } catch { /* ignore */ }
    };

    return () => ws.close();
  }, []);

  const sendWs = useCallback((type: string, payload?: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload: payload || {} }));
    }
  }, []);

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

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      {/* Connection Status */}
      <div style={sectionCard}>
        <label style={sectionTitle}>
          <Cable size={14} style={{ marginRight: "6px" }} />
          Estado de Conexión
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-main)" }}>
          {connected ? (
            <><Wifi size={16} style={{ color: "var(--success)" }} /> Conectado al Agent Engine</>
          ) : (
            <><WifiOff size={16} style={{ color: "var(--error)" }} /> Desconectado</>
          )}
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px" }}>
          WebSocket: {config.wsUrl}
        </div>
      </div>

      {/* Models */}
      <div style={sectionCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
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
          <div style={{ padding: "12px", marginBottom: "12px", background: "rgba(79,140,255,0.05)", borderRadius: "6px", border: "1px solid rgba(79,140,255,0.15)" }}>
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
            <div key={m.name} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)" }}>{m.name}</div>
                {m.displayName && <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>{m.displayName}</div>}
                {m.baseUrl && <div style={{ fontSize: "9px", color: "var(--text-muted)", fontFamily: "monospace" }}>{m.baseUrl}</div>}
              </div>
              <button type="button" onClick={() => handleDeleteModel(m.name)} style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", opacity: 0.5, padding: "4px" }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* MCP Brain */}
      <div style={sectionCard}>
        <label style={sectionTitle}>MCP Brain</label>
        <div style={{ fontSize: "12px", color: "var(--text-main)", marginBottom: "4px" }}>
          URL: {config.brainUrl}
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
          El Agent Engine se conecta al MCP Brain para memoria persistente y búsqueda semántica.
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
