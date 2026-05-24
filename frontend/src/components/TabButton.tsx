import type React from "react";

interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}

export const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon, label }) => (
    <button
        type="button"
        onClick={onClick}
        style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            background: active ? "rgba(79, 140, 255, 0.15)" : "transparent",
            color: active ? "var(--accent)" : "var(--text-dim)",
            transition: "var(--transition)",
        }}
    >
        {icon}
        {label}
    </button>
);
