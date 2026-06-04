interface Props {
  sendWs: (type: string, payload?: Record<string, unknown>) => void;
  tools: string[];
  toolStates: Record<string, boolean>;
  setToolStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export const ToolsConfig: React.FC<Props> = ({
  sendWs, tools, toolStates, setToolStates,
}) => {
  const handleToggle = (toolName: string, enabled: boolean) => {
    sendWs("toggle_tool", { name: toolName, enabled });
    setToolStates((prev) => ({ ...prev, [toolName]: enabled }));
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

  return (
    <div style={sectionCard}>
      <label style={sectionTitle}>Herramientas ({tools.length})</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {tools.map((tool) => (
          <button
            key={tool}
            type="button"
            onClick={() => handleToggle(tool, !toolStates[tool])}
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
  );
};
