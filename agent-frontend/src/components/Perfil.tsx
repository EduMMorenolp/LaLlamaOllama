import { useEffect, useState } from "react";
import { useWs } from "../contexts/WebSocketContext";

interface UserProfileData {
	userId: string;
	name?: string;
	persona?: string;
	language?: string;
	interests?: string;
	dislikes?: string;
	communication_style?: string;
	tone_preference?: string;
	interaction_count?: number;
	last_topics?: string;
	average_sentiment?: number;
	model_preference?: string;
	timezone?: string;
}

const sectionCard: React.CSSProperties = {
	background: "var(--bg-card)",
	borderRadius: "var(--radius-lg)",
	border: "1px solid var(--border)",
	padding: "24px",
	marginBottom: "16px",
};

const sectionTitle: React.CSSProperties = {
	fontSize: "14px",
	fontWeight: 600,
	color: "var(--text-main)",
	marginBottom: "16px",
	textTransform: "uppercase",
	letterSpacing: "0.5px",
};

const labelStyle: React.CSSProperties = {
	fontSize: "12px",
	color: "var(--text-dim)",
	marginBottom: "4px",
	textTransform: "uppercase",
	letterSpacing: "0.3px",
};

const valueStyle: React.CSSProperties = {
	fontSize: "14px",
	color: "var(--text-main)",
	fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
	width: "100%",
	padding: "10px 12px",
	borderRadius: "var(--radius-sm)",
	border: "1px solid var(--border)",
	background: "var(--bg-main)",
	color: "var(--text-main)",
	fontSize: "14px",
	outline: "none",
	fontFamily: "var(--font-main)",
};

const btnStyle: React.CSSProperties = {
	padding: "10px 20px",
	borderRadius: "var(--radius-sm)",
	border: "none",
	background: "var(--accent)",
	color: "#fff",
	fontSize: "14px",
	fontWeight: 500,
	cursor: "pointer",
	transition: "var(--transition)",
};

const statCardStyle: React.CSSProperties = {
	background: "var(--bg-card)",
	borderRadius: "var(--radius-md)",
	border: "1px solid var(--border)",
	padding: "16px",
	textAlign: "center",
	flex: 1,
	minWidth: "120px",
};

const tagStyle: React.CSSProperties = {
	display: "inline-block",
	padding: "4px 10px",
	borderRadius: "20px",
	background: "rgba(79, 140, 255, 0.15)",
	color: "var(--accent)",
	fontSize: "12px",
	margin: "2px 4px 2px 0",
};

const styleMap: Record<string, string> = {
	technical: "Técnico",
	casual: "Casual",
	formal: "Formal",
	neutral: "Neutral",
};

const toneMap: Record<string, string> = {
	warm: "Cálido",
	neutral: "Neutral",
	professional: "Profesional",
};

export const Perfil: React.FC = () => {
	const { connected, send: sendWs, subscribe } = useWs();
	const [profile, setProfile] = useState<UserProfileData | null>(null);
	const [editing, setEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [editForm, setEditForm] = useState({
		name: "",
		persona: "",
		language: "es",
		interests: "",
		dislikes: "",
		communication_style: "",
		tone_preference: "",
		model_preference: "",
	});

	useEffect(() => {
		return subscribe((msg) => {
			if (msg.type === "list_users") {
				const users = msg.payload?.users as UserProfileData[] | undefined;
				if (users && users.length > 0) {
					const first = users[0];
					setProfile(first);
					setEditForm({
						name: first.name || "",
						persona: first.persona || "",
						language: first.language || "es",
						interests: first.interests ? JSON.parse(first.interests).join(", ") : "",
						dislikes: first.dislikes ? JSON.parse(first.dislikes).join(", ") : "",
						communication_style: first.communication_style || "",
						tone_preference: first.tone_preference || "",
						model_preference: first.model_preference || "",
					});
				}
			}
			if (msg.type === "user_feedback" && msg.payload?.status === "ok") {
				setSaving(false);
				setEditing(false);
				sendWs("list_users", {});
			}
		});
	}, [subscribe, sendWs]);

	useEffect(() => {
		if (connected) {
			sendWs("list_users", {});
		}
	}, [connected, sendWs]);

	const handleSave = () => {
		setSaving(true);
		const interestsArray = editForm.interests
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		const dislikesArray = editForm.dislikes
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);

		sendWs("user_feedback", {
			userId: profile?.userId,
			name: editForm.name || undefined,
			persona: editForm.persona || undefined,
			language: editForm.language || undefined,
			interests: interestsArray.length > 0 ? JSON.stringify(interestsArray) : undefined,
			dislikes: dislikesArray.length > 0 ? JSON.stringify(dislikesArray) : undefined,
			communication_style: editForm.communication_style || undefined,
			tone_preference: editForm.tone_preference || undefined,
			model_preference: editForm.model_preference || undefined,
		});
	};

	if (!profile) {
		return (
			<div style={{ padding: "24px" }}>
				<div style={{ ...sectionCard, textAlign: "center", padding: "48px" }}>
					<p style={{ color: "var(--text-dim)" }}>
						{connected ? "Cargando perfil..." : "Conectando al servidor..."}
					</p>
				</div>
			</div>
		);
	}

	const topics = profile.last_topics
		? (() => { try { return JSON.parse(profile.last_topics) as string[]; } catch { return []; } })()
		: [];

	const interests = profile.interests
		? (() => { try { return JSON.parse(profile.interests) as string[]; } catch { return []; } })()
		: [];

	return (
		<div style={{ padding: "24px" }}>
			{/* Stats row */}
			<div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
				<div style={statCardStyle}>
					<div style={{ fontSize: "24px", fontWeight: 700, color: "var(--accent)" }}>
						{profile.interaction_count ?? 0}
					</div>
					<div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px" }}>
						Interacciones
					</div>
				</div>
				<div style={statCardStyle}>
					<div style={{ fontSize: "24px", fontWeight: 700, color: "var(--accent)" }}>
						{profile.average_sentiment != null
							? `${Math.round(profile.average_sentiment * 100)}%`
							: "—"}
					</div>
					<div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px" }}>
						Sentimiento promedio
					</div>
				</div>
				<div style={statCardStyle}>
					<div style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent)" }}>
						{styleMap[profile.communication_style || ""] || "—"}
					</div>
					<div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px" }}>
						Estilo detectado
					</div>
				</div>
				<div style={statCardStyle}>
					<div style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent)" }}>
						{toneMap[profile.tone_preference || ""] || "—"}
					</div>
					<div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px" }}>
						Tono preferido
					</div>
				</div>
			</div>

			{/* Edit / View toggle */}
			{!editing ? (
				<>
					{/* Profile info */}
					<div style={sectionCard}>
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
							<div style={sectionTitle}>Información del perfil</div>
							<button
								type="button"
								style={btnStyle}
								onClick={() => setEditing(true)}
							>
								Editar perfil
							</button>
						</div>

						<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
							{profile.name && (
								<div>
									<div style={labelStyle}>Nombre</div>
									<div style={valueStyle}>{profile.name}</div>
								</div>
							)}
							{profile.persona && (
								<div>
									<div style={labelStyle}>Persona</div>
									<div style={valueStyle}>{profile.persona}</div>
								</div>
							)}
							{profile.language && (
								<div>
									<div style={labelStyle}>Idioma</div>
									<div style={valueStyle}>{profile.language.toUpperCase()}</div>
								</div>
							)}
							{profile.communication_style && (
								<div>
									<div style={labelStyle}>Estilo de comunicación</div>
									<div style={valueStyle}>{styleMap[profile.communication_style] || profile.communication_style}</div>
								</div>
							)}
							{profile.tone_preference && (
								<div>
									<div style={labelStyle}>Tono preferido</div>
									<div style={valueStyle}>{toneMap[profile.tone_preference] || profile.tone_preference}</div>
								</div>
							)}
							{profile.model_preference && (
								<div>
									<div style={labelStyle}>Modelo preferido</div>
									<div style={valueStyle}>{profile.model_preference}</div>
								</div>
							)}
							{profile.timezone && (
								<div>
									<div style={labelStyle}>Zona horaria</div>
									<div style={valueStyle}>{profile.timezone}</div>
								</div>
							)}
						</div>
					</div>

					{/* Interests */}
					{interests.length > 0 && (
						<div style={sectionCard}>
							<div style={sectionTitle}>Intereses</div>
							<div>
								{interests.map((i, idx) => (
									<span key={idx} style={tagStyle}>{i}</span>
								))}
							</div>
						</div>
					)}

					{/* Recent topics */}
					{topics.length > 0 && (
						<div style={sectionCard}>
							<div style={sectionTitle}>Temas recientes</div>
							<div>
								{topics.map((t, idx) => (
									<span key={idx} style={tagStyle}>{t}</span>
								))}
							</div>
						</div>
					)}
				</>
			) : (
				/* ─── Editing mode ─── */
				<div style={sectionCard}>
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
						<div style={sectionTitle}>Editar perfil</div>
						<div style={{ display: "flex", gap: "8px" }}>
							<button
								type="button"
								style={{ ...btnStyle, background: "transparent", color: "var(--text-dim)", border: "1px solid var(--border)" }}
								onClick={() => setEditing(false)}
							>
								Cancelar
							</button>
							<button
								type="button"
								style={{ ...btnStyle, opacity: saving ? 0.6 : 1 }}
								disabled={saving}
								onClick={handleSave}
							>
								{saving ? "Guardando..." : "Guardar cambios"}
							</button>
						</div>
					</div>

					<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "16px" }}>
						<div>
							<div style={labelStyle}>Nombre</div>
							<input
								style={inputStyle}
								value={editForm.name}
								onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
								placeholder="Tu nombre"
							/>
						</div>
						<div>
							<div style={labelStyle}>Persona</div>
							<select
								style={inputStyle}
								value={editForm.persona}
								onChange={(e) => setEditForm({ ...editForm, persona: e.target.value })}
							>
								<option value="">Automático</option>
								<option value="desarrollador">Desarrollador</option>
								<option value="estudiante">Estudiante</option>
								<option value="escritor">Escritor</option>
								<option value="diseñador">Diseñador</option>
								<option value="emprendedor">Emprendedor</option>
								<option value="sysadmin">SysAdmin</option>
							</select>
						</div>
						<div>
							<div style={labelStyle}>Idioma</div>
							<select
								style={inputStyle}
								value={editForm.language}
								onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
							>
								<option value="es">Español</option>
								<option value="en">English</option>
							</select>
						</div>
						<div>
							<div style={labelStyle}>Estilo de comunicación</div>
							<select
								style={inputStyle}
								value={editForm.communication_style}
								onChange={(e) => setEditForm({ ...editForm, communication_style: e.target.value })}
							>
								<option value="">Automático</option>
								<option value="technical">Técnico</option>
								<option value="casual">Casual</option>
								<option value="formal">Formal</option>
								<option value="neutral">Neutral</option>
							</select>
						</div>
						<div>
							<div style={labelStyle}>Tono preferido</div>
							<select
								style={inputStyle}
								value={editForm.tone_preference}
								onChange={(e) => setEditForm({ ...editForm, tone_preference: e.target.value })}
							>
								<option value="">Automático</option>
								<option value="warm">Cálido</option>
								<option value="neutral">Neutral</option>
								<option value="professional">Profesional</option>
							</select>
						</div>
						<div>
							<div style={labelStyle}>Modelo preferido</div>
							<input
								style={inputStyle}
								value={editForm.model_preference}
								onChange={(e) => setEditForm({ ...editForm, model_preference: e.target.value })}
								placeholder="Ej: llama3.2:latest"
							/>
						</div>
						<div>
							<div style={labelStyle}>Intereses (separados por coma)</div>
							<input
								style={inputStyle}
								value={editForm.interests}
								onChange={(e) => setEditForm({ ...editForm, interests: e.target.value })}
								placeholder="Python, Docker, IA, ..."
							/>
						</div>
						<div>
							<div style={labelStyle}>Disgustos / temas a evitar (separados por coma)</div>
							<input
								style={inputStyle}
								value={editForm.dislikes}
								onChange={(e) => setEditForm({ ...editForm, dislikes: e.target.value })}
								placeholder="JavaScript, CSS, ..."
							/>
						</div>
					</div>
				</div>
			)}

			{/* Auto-learning info */}
			<div style={sectionCard}>
				<div style={sectionTitle}>Acerca del aprendizaje automático</div>
				<p style={{ fontSize: "13px", color: "var(--text-dim)", lineHeight: 1.6 }}>
					LaLlamaOllama aprende de cada conversación. El estilo de comunicación, los temas de interés
					y el tono se detectan automáticamente después de cada interacción. Podés ver y corregir
					esta información editando tu perfil más arriba. También podés pedirle al asistente
					que recuerde información específica durante la conversación.
				</p>
			</div>
		</div>
	);
};
