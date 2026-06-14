import type React from "react";

interface ModalLayoutProps {
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    width?: string;
}

export const ModalLayout: React.FC<ModalLayoutProps> = ({ onClose, title, children, width = "700px" }) => (
    <div
        style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
        }}
        onClick={onClose}
    >
        <div
            style={{
                background: "#141414",
                borderRadius: "16px",
                width,
                maxWidth: "90vw",
                maxHeight: "85vh",
                overflow: "auto",
                padding: "24px",
                border: "1px solid var(--border)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {title && <h2 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 700, color: "var(--text)" }}>{title}</h2>}
            {children}
        </div>
    </div>
);
