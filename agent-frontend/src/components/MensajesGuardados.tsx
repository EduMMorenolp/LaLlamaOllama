import { Bookmark, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useWs } from "../contexts/WebSocketContext";

interface SavedMessage {
	chatId: string;
	messageRole: string;
	messageContent: string;
	messageTimestamp: string;
	savedAt: string;
}

const sectionCard: React.CSSProperties = {
	padding: "16px",
	borderRadius: "8px",
	background: "rgba(255,255,255,0.02)",
	border: "1px solid var(--border-light)",
};

const inputStyle: React.CSSProperties = {
	width: "100%",
	padding: "8px 10px",
	borderRadius: "6px",
	border: "1px solid var(--border-light)",
	background: "rgba(255,255,255,0.03)",
	color: "var(--text-main)",
	fontSize: "12px",
	outline: "none",
	fontFamily: "inherit",
	boxSizing: "border-box",
};

const roleColors: Record<string, { bg: string; color: string }> = {
	user: { bg: "rgba(79,140,255,0.12)", color: "var(--accent)" },
	assistant: { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
	system: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
};

const roleLabels: Record<string, string> = {
	user: "Usuario",
	assistant: "Asistente",
	system: "Sistema",
};

export const MensajesGuardados: React.FC = () => {
	const { connected, send: sendWs, subscribe } = useWs();
	const [messages, setMessages] = useState<SavedMessage[]>([]);
	const [search, setSearch] = useState("");

	useEffect(() => {
		return subscribe((msg) => {
			if (msg.type === "saved_messages_list") {
				const saved = msg.payload?.saved as SavedMessage[];
				if (Array.isArray(saved)) setMessages(saved);
			}
		});
	}, [subscribe]);

	useEffect(() => {
		if (connected) sendWs("list_saved_messages", {});
	}, [connected, sendWs]);

	const handleUnsave = (chatId: string, content: string) => {
		sendWs("unsave_message", { chatId, messageContent: content });
	};

	const filtered = search
		? messages.filter((m) =>
			m.messageContent.toLowerCase().includes(search.toLowerCase()) ||
			m.chatId.toLowerCase().includes(search.toLowerCase()) ||
			m.messageRole.toLowerCase().includes(search.toLowerCase())
		)
		: messages;

	return (
		<div>
			<div style={{ marginBottom: "12px" }}>
				<div style={{ position: "relative" }}>
					<Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Buscar en mensajes guardados..."
						style={{ ...inputStyle, paddingLeft: "30px" }}
					/>
				</div>
				<div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "6px" }}>
					{filtered.length} de {messages.length} mensajes guardados
				</div>
			</div>

			{filtered.length === 0 ? (
				<div style={{ ...sectionCard, textAlign: "center", padding: "40px" }}>
					<Bookmark size={24} style={{ color: "var(--text-muted)", marginBottom: "8px" }} />
					<div style={{ fontSize: "13px", color: "var(--text-dim)" }}>
						{search ? "Sin resultados" : "No hay mensajes guardados"}
					</div>
					<div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
						{search ? "Intenta con otros términos de búsqueda." : "Guarda mensajes desde el chat para verlos aquí."}
					</div>
				</div>
			) : (
				<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
					{filtered.map((msg, idx) => {
						const colors = roleColors[msg.messageRole] || roleColors.user;
						return (
							<div key={idx} style={{ ...sectionCard, padding: "12px 14px" }}>
								<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
									<div style={{ flex: 1, minWidth: 0 }}>
										<div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
											<span style={{
												fontSize: "10px",
												fontWeight: 700,
												padding: "2px 6px",
												borderRadius: "4px",
												background: colors.bg,
												color: colors.color,
												textTransform: "uppercase",
											}}>
												{roleLabels[msg.messageRole] || msg.messageRole}
											</span>
											<span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
												{msg.savedAt ? new Date(msg.savedAt).toLocaleString(undefined, {
													day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
												}) : ""}
											</span>
										</div>
										<div style={{
											fontSize: "12px",
											color: "var(--text-main)",
											lineHeight: "1.5",
											wordBreak: "break-word",
											display: "-webkit-box",
											WebkitLineClamp: 4,
											WebkitBoxOrient: "vertical",
											overflow: "hidden",
										}}>
											{msg.messageContent}
										</div>
										{msg.chatId && (
											<div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", fontFamily: "monospace" }}>
												Chat: {msg.chatId.substring(0, 20)}...
											</div>
										)}
									</div>
									<button
										type="button"
										onClick={() => handleUnsave(msg.chatId, msg.messageContent)}
										title="Eliminar de guardados"
										style={{
											background: "rgba(239,68,68,0.1)",
											border: "1px solid rgba(239,68,68,0.2)",
											borderRadius: "4px",
											color: "var(--error)",
											cursor: "pointer",
											padding: "4px",
											display: "flex",
											flexShrink: 0,
										}}
									>
										<Trash2 size={12} />
									</button>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};
