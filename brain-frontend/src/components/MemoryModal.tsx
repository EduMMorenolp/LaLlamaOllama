import { Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createMemory, fetchMemory, updateMemory, type Memory } from "../api";

interface Props {
	id?: string;
	project?: string;
	onClose: () => void;
}

const MEMORY_TYPES = [
	"knowledge", "feature", "bug-fix", "architecture", "decision",
	"discovery", "note", "learning", "prompt", "system_alert",
];

export default function MemoryModal({ id, project, onClose }: Props) {
	const [memory, setMemory] = useState<Memory | null>(null);
	const [loading, setLoading] = useState(!!id);
	const [editing, setEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const isNew = !id;

	const [form, setForm] = useState({
		type: "knowledge",
		title: "",
		content: "",
		tags: "",
	});

	useEffect(() => {
		if (!id) { setEditing(true); return; }
		setLoading(true);
		fetchMemory(id)
			.then(m => {
				setMemory(m);
				setForm({ type: m.type, title: m.title, content: m.content, tags: m.tags || "" });
			})
			.catch(() => setError("Error al cargar memoria"))
			.finally(() => setLoading(false));
	}, [id]);

	const handleSave = useCallback(async () => {
		if (!form.title.trim() || !form.content.trim()) return;
		setSaving(true);
		setError(null);
		try {
			if (isNew) {
				await createMemory({ ...form, project: project || "lallamaollama" });
			} else if (id) {
				await updateMemory(id, form);
			}
			onClose();
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : "Error al guardar");
		} finally {
			setSaving(false);
		}
	}, [form, id, isNew, project, onClose]);

	if (loading) return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
				<div className="loading"><Loader2 size={20} className="spin" /> Cargando...</div>
			</div>
		</div>
	);

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal" onClick={e => e.stopPropagation()}>
				<div className="modal-header">
					<h2>{isNew ? "Nueva memoria" : editing ? "Editar memoria" : memory?.title}</h2>
					<button className="modal-close" onClick={onClose}><X size={18} /></button>
				</div>

				{error && <p style={{ padding: "8px 20px", color: "var(--error)", fontSize: 13 }}>{error}</p>}

				{editing ? (
					<div className="modal-body">
						<label>
							Tipo
							<select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
								{MEMORY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
							</select>
						</label>
						<label>
							Titulo
							<input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Titulo de la memoria" />
						</label>
						<label>
							Contenido (Markdown)
							<textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Contenido en Markdown..." />
						</label>
						<label>
							Tags (separados por coma)
							<input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="tag1, tag2, tag3" />
						</label>
					</div>
				) : memory ? (
					<div className="modal-body">
						<div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
							<span className="type-badge" style={{ background: "var(--accent-glow)", color: "var(--accent)", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{memory.type}</span>
							{memory.tags && <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{memory.tags}</span>}
						</div>
						<div className="markdown-preview">
							<ReactMarkdown remarkPlugins={[remarkGfm]}>{memory.content}</ReactMarkdown>
						</div>
						<div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8, display: "flex", gap: 16 }}>
							<span>Creado: {new Date(memory.createdAt).toLocaleString()}</span>
							<span>Actualizado: {new Date(memory.updatedAt).toLocaleString()}</span>
							{memory.agent && <span>Agente: {memory.agent}</span>}
						</div>
					</div>
				) : null}

				<div className="modal-footer">
					{!isNew && !editing && (
						<button className="btn-secondary" onClick={() => setEditing(true)}>Editar</button>
					)}
					<button className="btn-secondary" onClick={onClose}>
						{editing ? "Cancelar" : "Cerrar"}
					</button>
					{editing && (
						<button className="btn-primary" onClick={handleSave} disabled={saving}>
							{saving ? "Guardando..." : "Guardar"}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
