import { useEffect, useRef } from "react";

interface Props {
	open: boolean;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm: () => void;
	onCancel: () => void;
	danger?: boolean;
}

export function ConfirmModal({ open, title, message, confirmText = "Confirmar", cancelText = "Cancelar", onConfirm, onCancel, danger }: Props) {
	const confirmRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (open) confirmRef.current?.focus();
	}, [open]);

	if (!open) return null;

	return (
		<div style={{
			position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
			background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
			display: "flex", alignItems: "center", justifyContent: "center",
			zIndex: 2000,
		}} onClick={onCancel}>
			<div style={{
				background: "var(--bg-surface)", border: "1px solid var(--border)",
				borderRadius: "12px", padding: "24px", width: "400px", maxWidth: "90vw",
			}} onClick={(e) => e.stopPropagation()}>
				<h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>{title}</h3>
				<p style={{ margin: "0 0 20px", fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.5 }}>{message}</p>
				<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
					<button type="button" onClick={onCancel} style={{
						padding: "8px 16px", background: "rgba(255,255,255,0.05)",
						border: "1px solid var(--border-light)", borderRadius: "8px",
						color: "var(--text-main)", cursor: "pointer", fontSize: "12px", fontWeight: 600,
					}}>{cancelText}</button>
					<button ref={confirmRef} type="button" onClick={onConfirm} style={{
						padding: "8px 16px",
						background: danger ? "rgba(239,68,68,0.15)" : "rgba(79,140,255,0.15)",
						border: danger ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(79,140,255,0.3)",
						borderRadius: "8px",
						color: danger ? "var(--error)" : "var(--accent)",
						cursor: "pointer", fontSize: "12px", fontWeight: 600,
					}}>{confirmText}</button>
				</div>
			</div>
		</div>
	);
}