import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
	id: number;
	type: ToastType;
	text: string;
}

interface ToastContextValue {
	show: (text: string, type?: ToastType) => void;
	toasts: Toast[];
}

const ToastContext = createContext<ToastContextValue>(null!);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const show = useCallback((text: string, type: ToastType = "info") => {
		const id = nextId++;
		setToasts((prev) => [...prev, { id, type, text }]);
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id));
		}, 3000);
	}, []);

	return (
		<ToastContext.Provider value={{ show, toasts }}>
			{children}
			{/* Toast container */}
			<div style={{
				position: "fixed", bottom: "20px", right: "20px", zIndex: 9999,
				display: "flex", flexDirection: "column", gap: "8px",
			}}>
				{toasts.map((toast) => (
					<div key={toast.id} style={{
						padding: "10px 16px",
						borderRadius: "8px",
						background: toast.type === "success" ? "rgba(34,197,94,0.15)"
							: toast.type === "error" ? "rgba(239,68,68,0.15)"
							: "rgba(79,140,255,0.15)",
						border: toast.type === "success" ? "1px solid rgba(34,197,94,0.3)"
							: toast.type === "error" ? "1px solid rgba(239,68,68,0.3)"
							: "1px solid rgba(79,140,255,0.3)",
						color: toast.type === "success" ? "var(--success)"
							: toast.type === "error" ? "var(--error)"
							: "var(--accent)",
						fontSize: "12px",
						fontWeight: 500,
						boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
						animation: "slideIn 0.2s ease",
						maxWidth: "350px",
					}}>
						{toast.text}
					</div>
				))}
			</div>
			<style>{`
				@keyframes slideIn {
					from { transform: translateX(100%); opacity: 0; }
					to { transform: translateX(0); opacity: 1; }
				}
			`}</style>
		</ToastContext.Provider>
	);
}

export function useToast() { return useContext(ToastContext); }
