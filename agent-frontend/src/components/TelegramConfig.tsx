import { Save } from "lucide-react";

interface Props {
  sendWs: (type: string, payload?: Record<string, unknown>) => void;
  telegramToken: string;
  setTelegramToken: (v: string) => void;
  telegramEnabled: boolean;
}

export const TelegramConfig: React.FC<Props> = ({
  sendWs, telegramToken, setTelegramToken, telegramEnabled,
}) => {
  const handleSave = () => {
    sendWs("telegram_update", { botToken: telegramToken, enabled: telegramEnabled });
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

  return (
    <div style={sectionCard}>
      <label style={sectionTitle}>Telegram Bot</label>
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
        <input
          type="password"
          value={telegramToken}
          onChange={(e) => setTelegramToken(e.target.value)}
          placeholder="Token del bot..."
          style={inputStyle}
        />
        <button type="button" onClick={handleSave} style={actionBtnStyle}>
          <Save size={14} style={{ marginRight: "4px" }} />
          Guardar
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{
          width: "8px", height: "8px",
          borderRadius: "50%",
          background: telegramEnabled ? "var(--success)" : "var(--error)",
          display: "inline-block",
        }} />
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          {telegramEnabled ? "Bot activo" : "Bot inactivo"}
        </span>
      </div>
    </div>
  );
};
