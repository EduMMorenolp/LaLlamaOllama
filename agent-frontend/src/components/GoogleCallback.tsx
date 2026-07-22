import { useEffect, useState } from "react";
import { config } from "../config";

export const GoogleCallback: React.FC = () => {
	const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
	const [message, setMessage] = useState("Procesando autorización de Google...");

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const code = params.get("code");
		const error = params.get("error");

		if (error) {
			setStatus("error");
			setMessage(`Autorización cancelada: ${error}`);
			return;
		}

		if (!code) {
			setStatus("error");
			setMessage("No se recibió el código de autorización.");
			return;
		}

		(async () => {
			try {
				const res = await fetch(`${config.engineUrl}/api/google/callback`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-api-key": config.apiKey,
					},
					body: JSON.stringify({ code, user_id: "default" }),
				});

				const data = await res.json();

				if (data.success) {
					setStatus("success");
					setMessage(`Conectado correctamente como ${data.email || data.name || "cuenta de Google"}`);
					setTimeout(() => {
						window.location.href = window.location.origin;
					}, 2000);
				} else {
					setStatus("error");
					setMessage(`Error: ${data.error || data.detail || "Error desconocido"}`);
				}
			} catch (err) {
				setStatus("error");
				setMessage(`Error de conexión: ${err instanceof Error ? err.message : String(err)}`);
			}
		})();
	}, []);

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				height: "100vh",
				padding: "24px",
				background: "var(--bg-main)",
				color: "var(--text-main)",
			}}
		>
			<div
				style={{
					padding: "32px",
					borderRadius: "12px",
					background: "var(--bg-surface)",
					border: "1px solid var(--border)",
					maxWidth: "400px",
					textAlign: "center",
				}}
			>
				{status === "processing" && (
					<>
						<div
							style={{
								width: "40px",
								height: "40px",
								borderRadius: "50%",
								border: "3px solid var(--border-light)",
								borderTopColor: "var(--accent)",
								animation: "spin 0.8s linear infinite",
								margin: "0 auto 16px",
							}}
						/>
						<style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
					</>
				)}
				{status === "success" && (
					<div
						style={{
							width: "40px",
							height: "40px",
							borderRadius: "50%",
							background: "rgba(34,197,94,0.15)",
							color: "var(--success)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: "20px",
							margin: "0 auto 16px",
						}}
					>
						✓
					</div>
				)}
				{status === "error" && (
					<div
						style={{
							width: "40px",
							height: "40px",
							borderRadius: "50%",
							background: "rgba(239,68,68,0.15)",
							color: "var(--error)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: "20px",
							margin: "0 auto 16px",
						}}
					>
						✗
					</div>
				)}

				<div style={{ fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.5 }}>{message}</div>

				{status === "success" && (
					<div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "12px" }}>
						Redirigiendo al dashboard...
					</div>
				)}

				{status === "error" && (
					<button
						type="button"
						onClick={() => (window.location.href = window.location.origin)}
						style={{
							marginTop: "16px",
							padding: "8px 20px",
							borderRadius: "8px",
							background: "rgba(79,140,255,0.1)",
							border: "1px solid rgba(79,140,255,0.2)",
							color: "var(--accent)",
							cursor: "pointer",
							fontSize: "11px",
						}}
					>
						Volver al dashboard
					</button>
				)}
			</div>
		</div>
	);
};
