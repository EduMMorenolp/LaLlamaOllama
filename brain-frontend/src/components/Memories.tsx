import { Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { deleteMemory, fetchMemories, type Memory } from "../api";

interface Props {
	project: string;
	onSelect: (id: string) => void;
}

export default function Memories({ project, onSelect }: Props) {
	const [memories, setMemories] = useState<Memory[]>([]);
	const [loading, setLoading] = useState(true);
	const [filterType, setFilterType] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const data = await fetchMemories(project, 100, 0, filterType || undefined);
			setMemories(data);
		} catch {
			setMemories([]);
		} finally {
			setLoading(false);
		}
	}, [project, filterType]);

	useEffect(() => { load(); }, [load]);

	const handleDelete = async (e: React.MouseEvent, id: string) => {
		e.stopPropagation();
		if (!confirm("Eliminar esta memoria?")) return;
		try {
			await deleteMemory(id);
			setMemories(prev => prev.filter(m => m.id !== id));
		} catch {}
	};

	const types = [...new Set(memories.map(m => m.type))];

	return (
		<div>
			<div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
				<select value={filterType} onChange={e => setFilterType(e.target.value)}>
					<option value="">Todos los tipos</option>
					{types.map(t => <option key={t} value={t}>{t}</option>)}
				</select>
				<span style={{ fontSize: 12, color: "var(--text-dim)", alignSelf: "center" }}>
					{memories.length} memorias
				</span>
			</div>

			{loading ? (
				<div className="loading"><Loader2 size={20} className="spin" /> Cargando...</div>
			) : memories.length === 0 ? (
				<div className="empty-state"><p>No hay memorias</p></div>
			) : (
				<div className="memories-list">
					{memories.map(m => (
						<div key={m.id} className="memory-row" onClick={() => onSelect(m.id)}>
							<span className="type-badge">{m.type}</span>
							<span className="title">{m.title}</span>
							<span className="meta">{new Date(m.createdAt).toLocaleDateString()}</span>
							<button className="delete-btn" onClick={e => handleDelete(e, m.id)} title="Eliminar">
								<Trash2 size={14} />
							</button>
						</div>
					))}
				</div>
			)}

			<style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
		</div>
	);
}
